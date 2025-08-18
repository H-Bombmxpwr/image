from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageStat, ExifTags
import io, base64, os, json
import numpy as np

app = Flask(__name__)
app.config["SECRET_KEY"] = "dev-key"

# Optional seam carving
HAS_SEAM = True
SEAM_BACKEND = "seam-carving"
try:
    import seam_carving  # pip install seam-carving
except Exception:
    try:
        # Fallback via scikit-image if present
        from skimage import transform, filters, color, img_as_ubyte
        HAS_SEAM = True
        SEAM_BACKEND = "scikit-image"
    except Exception:
        HAS_SEAM = False
        SEAM_BACKEND = "none"

# Pillow resampling names
try:
    Resampling = Image.Resampling
except AttributeError:
    class Resampling:
        NEAREST = Image.NEAREST
        BILINEAR = Image.BILINEAR
        BICUBIC = Image.BICUBIC
        LANCZOS = Image.ANTIALIAS

ALLOWED_EXPORT = {
    "jpeg": ("JPEG", "image/jpeg"),
    "jpg":  ("JPEG", "image/jpeg"),
    "png":  ("PNG",  "image/png"),
    "webp": ("WEBP", "image/webp"),
    "bmp":  ("BMP",  "image/bmp"),
    "tiff": ("TIFF", "image/tiff")
}

# ---------- helpers ----------
def _b64_to_image(data_url: str) -> Image.Image:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    return img

def _dataurl_bytes(data_url: str) -> int:
    """Approx bytes from a data URL."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    pad = data_url.count("=")
    return (len(data_url) * 3)//4 - pad

def _fmt_size(num_bytes: int) -> str:
    units = ["B","KB","MB","GB"]
    s = float(num_bytes)
    for u in units:
        if s < 1024 or u == "GB":
            return f"{s:.1f} {u}"
        s /= 1024

def _image_to_dataurl(img: Image.Image, fmt="PNG", quality=92):
    buf = io.BytesIO()
    save_kwargs = {}
    if fmt.upper() == "JPEG":
        if img.mode in ("RGBA", "LA"):
            # Composite alpha on white for JPEG
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs["quality"] = int(quality)
        save_kwargs["optimize"] = True
    if fmt.upper() == "WEBP":
        save_kwargs["quality"] = int(quality)
    img.save(buf, format=fmt, **save_kwargs)
    mime = next((m for k,(f,m) in ALLOWED_EXPORT.items() if f==fmt.upper()), "image/png")
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def _exif_to_dict(img: Image.Image):
    try:
        exif = img.getexif()
        if not exif:
            return {}
        out = {}
        for tag_id, value in exif.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            if isinstance(value, bytes):
                try: value = value.decode(errors="ignore")
                except Exception: value = str(value)
            out[str(tag)] = value
        keep = ["DateTime", "Model", "Make", "LensModel", "FNumber", "ExposureTime",
                "ISOSpeedRatings", "FocalLength"]
        slim = {k: out[k] for k in keep if k in out}
        if "GPSInfo" in out:
            slim["GPSInfo"] = str(out["GPSInfo"])
        return slim or out
    except Exception:
        return {}

def _stats(img: Image.Image):
    fmt = (img.format or "").upper()
    mode = img.mode
    w, h = img.size
    stat = ImageStat.Stat(img.convert("RGB"))
    mean = tuple(int(x) for x in stat.mean)
    return {"format": fmt, "mode": mode, "width": w, "height": h, "mean_rgb": mean}

def _resample(name: str):
    name = (name or "").lower()
    return {
        "nearest": Resampling.NEAREST,
        "bilinear": Resampling.BILINEAR,
        "bicubic": Resampling.BICUBIC,
        "lanczos": Resampling.LANCZOS
    }.get(name, Resampling.LANCZOS)

# ---------- pages ----------
@app.get("/")
def index():
    return render_template("index.html", has_seam=HAS_SEAM)

@app.get("/help")
def help_page():
    return render_template("help.html", has_seam=HAS_SEAM, seam_backend=SEAM_BACKEND)

# ---------- api ----------
@app.post("/api/inspect")
def api_inspect():
    data_url = request.json["image"]
    img = _b64_to_image(data_url)
    size_bytes = _dataurl_bytes(data_url)
    meta = _stats(img)
    meta["file_size"] = size_bytes
    meta["file_size_str"] = _fmt_size(size_bytes)
    return jsonify({"meta": meta, "exif": _exif_to_dict(img)})

@app.post("/api/convert")
def api_convert():
    d = request.json
    img = _b64_to_image(d["image"])
    fmt_key = d.get("to", "png").lower()
    quality = int(d.get("quality", 92))
    fmt, _ = ALLOWED_EXPORT.get(fmt_key, ("PNG", "image/png"))
    return jsonify({"img": _image_to_dataurl(img, fmt, quality)})

@app.post("/api/rotate")
def api_rotate():
    d = request.json
    img = _b64_to_image(d["image"])
    deg = float(d.get("degrees", 0))
    expanded = bool(d.get("expand", True))
    out = img.rotate(-deg, expand=expanded, resample=Resampling.BICUBIC)
    return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/flip")
def api_flip():
    d = request.json
    img = _b64_to_image(d["image"])
    axis = d.get("axis", "h")
    out = ImageOps.mirror(img) if axis == "h" else ImageOps.flip(img)
    return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/resize")
def api_resize():
    d = request.json
    img = _b64_to_image(d["image"])
    w = int(d.get("width") or img.width)
    h = int(d.get("height") or img.height)
    keep_aspect = bool(d.get("keep_aspect", True))
    resamp = _resample(d.get("method"))
    if keep_aspect:
        # Pillow>=10 uses "method" (older versions accepted "resample")
        out = ImageOps.contain(img, (w, h), method=resamp)
    else:
        out = img.resize((w, h), resample=resamp)
    return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/crop")
def api_crop():
    d = request.json
    img = _b64_to_image(d["image"])
    x = float(d["x"]); y = float(d["y"])
    w = float(d["width"]); h = float(d["height"])
    deg = float(d.get("rotate", 0))
    if abs(deg) > 1e-3:
        img = img.rotate(-deg, expand=True, resample=Resampling.BICUBIC)
    box = (int(x), int(y), int(x+w), int(y+h))
    box = (max(0, box[0]), max(0, box[1]), min(img.width, box[2]), min(img.height, box[3]))
    out = img.crop(box)
    return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/filters")
def api_filters():
    d = request.json
    img = _b64_to_image(d["image"])

    if d.get("grayscale"): img = ImageOps.grayscale(img).convert("RGB")
    if d.get("invert"):    img = ImageOps.invert(img.convert("RGB"))
    if d.get("sepia"):
        g = ImageOps.grayscale(img)
        img = ImageOps.colorize(g, (20, 10, 0), (255, 240, 192))

    if d.get("gaussian"): img = img.filter(ImageFilter.GaussianBlur(float(d.get("gaussian_radius", 1.5))))
    if d.get("median"):   img = img.filter(ImageFilter.MedianFilter(size=int(d.get("median_size", 3))))
    if d.get("sharpen"):  img = img.filter(ImageFilter.UnsharpMask(radius=2.0, percent=150, threshold=3))
    if d.get("edge"):     img = img.filter(ImageFilter.FIND_EDGES)
    if d.get("emboss"):   img = img.filter(ImageFilter.EMBOSS)

    if int(d.get("posterize", 0)) > 0:
        img = ImageOps.posterize(img.convert("RGB"), max(1, min(8, int(d["posterize"]))))

    if int(d.get("pixelate", 1)) > 1:
        b = int(d["pixelate"])
        small = img.resize((max(1, img.width//b), max(1, img.height//b)), Resampling.NEAREST)
        img = small.resize(img.size, Resampling.NEAREST)

    return jsonify({"img": _image_to_dataurl(img)})

@app.post("/api/adjust")
def api_adjust():
    d = request.json
    img = _b64_to_image(d["image"])

    b = float(d.get("brightness", 1.0))
    c = float(d.get("contrast",   1.0))
    s = float(d.get("saturation", 1.0))
    g = float(d.get("gamma",      1.0))

    if abs(b-1) > 1e-3: img = ImageEnhance.Brightness(img).enhance(b)
    if abs(c-1) > 1e-3: img = ImageEnhance.Contrast(img).enhance(c)
    if abs(s-1) > 1e-3: img = ImageEnhance.Color(img).enhance(s)
    if abs(g-1) > 1e-3:
        lut = [min(255, int((i/255.0) ** (1.0/g) * 255 + 0.5)) for i in range(256)]
        img = img.point(lut * (3 if img.mode != "RGBA" else 4))

    return jsonify({"img": _image_to_dataurl(img)})

@app.post("/api/histeq")
def api_hist_eq():
    img = _b64_to_image(request.json["image"]).convert("RGB")
    y = ImageOps.grayscale(img)
    y = ImageOps.equalize(y)
    out = Image.merge("RGB", (y,)*3)
    return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/background_remove")
def api_background_remove():
    d = request.json
    img = _b64_to_image(d["image"]).convert("RGBA")
    tol = float(d.get("tolerance", 18.0))
    arr = np.array(img)
    border = np.concatenate([arr[0,:,:3], arr[-1,:,:3], arr[:,0,:3], arr[:,-1,:3]], axis=0)
    bg = border.mean(axis=0)
    rgb = arr[:,:,:3].astype(np.float32)
    dist = np.linalg.norm(rgb - bg, axis=2)
    threshold = (tol/100.0) * 255.0 * 1.5
    alpha = arr[:,:,3].astype(np.float32)
    alpha[dist < threshold] = 0
    out = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)]), "RGBA")
    return jsonify({"img": _image_to_dataurl(out, "PNG")})

@app.post("/api/seam_carve")
def api_seam_carve():
    if not HAS_SEAM:
        return jsonify({"error": "Seam carving module not available"}), 400
    d = request.json
    img = _b64_to_image(d["image"]).convert("RGB")
    target_w = int(d.get("target_width", img.width))
    target_h = int(d.get("target_height", img.height))

    if SEAM_BACKEND == "seam-carving":
        dst = seam_carving.resize(np.array(img), (target_w, target_h),
                                  energy_mode=d.get("energy_mode", "backward"),
                                  order=d.get("order", "width-first"))
        out = Image.fromarray(dst)
        return jsonify({"img": _image_to_dataurl(out)})

    # scikit-image fallback: supports removing seams; for enlarging, use high-quality resize
    from skimage import transform, filters, color, img_as_ubyte
    arr = np.array(img) / 255.0
    gray = color.rgb2gray(arr)
    energy = filters.sobel(gray)

    if target_w < img.width:
        num = img.width - target_w
        carved = transform.seam_carve(arr, energy, 'vertical', num)
        out = Image.fromarray(img_as_ubyte(carved))
        return jsonify({"img": _image_to_dataurl(out)})
    else:
        out = img.resize((target_w, target_h), Resampling.LANCZOS)
        return jsonify({"img": _image_to_dataurl(out)})

@app.post("/api/export")
def api_export():
    d = request.json
    img = _b64_to_image(d["image"])
    fmt_key = (d.get("format") or "png").lower()
    quality = int(d.get("quality", 92))
    fmt, mime = ALLOWED_EXPORT.get(fmt_key, ("PNG", "image/png"))
    buf = io.BytesIO()
    save_kwargs = {}
    if fmt == "JPEG":
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs["quality"] = quality
        save_kwargs["optimize"] = True
    if fmt == "WEBP":
        save_kwargs["quality"] = quality
    img.save(buf, format=fmt, **save_kwargs)
    buf.seek(0)
    return send_file(buf, mimetype=mime, as_attachment=True, download_name=f"edited.{fmt_key}")

@app.get("/about")
def about_page():
    return render_template("about.html")


# app.py (bottom)
if __name__ == "__main__":
    import os
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
