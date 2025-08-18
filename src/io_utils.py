import base64, io
from PIL import Image, ImageStat, ExifTags
from .compat import Resampling

ALLOWED_EXPORT = {
    "jpeg": ("JPEG", "image/jpeg"),
    "jpg":  ("JPEG", "image/jpeg"),
    "png":  ("PNG",  "image/png"),
    "webp": ("WEBP", "image/webp"),
    "bmp":  ("BMP",  "image/bmp"),
    "tiff": ("TIFF", "image/tiff"),
}

def b64_to_image(data_url: str) -> Image.Image:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    return img

def image_to_dataurl(img: Image.Image, fmt="PNG", quality=92) -> str:
    buf = io.BytesIO()
    save_kwargs = {}
    if fmt.upper() == "JPEG":
        if img.mode in ("RGBA", "LA"):
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

def exif_to_dict(img: Image.Image):
    try:
        exif = img.getexif()
        if not exif: return {}
        out = {}
        for tag_id, value in exif.items():
            tag = ExifTags.TAGS.get(tag_id, tag_id)
            if isinstance(value, bytes):
                try: value = value.decode(errors="ignore")
                except Exception: value = str(value)
            out[str(tag)] = value
        keep = ["DateTime","Model","Make","LensModel","FNumber","ExposureTime","ISOSpeedRatings","FocalLength"]
        slim = {k: out[k] for k in keep if k in out}
        if "GPSInfo" in out: slim["GPSInfo"] = str(out["GPSInfo"])
        return slim or out
    except Exception:
        return {}

def stats_for(img: Image.Image):
    fmt = (img.format or "").upper()
    mode = img.mode
    w, h = img.size
    stat = ImageStat.Stat(img.convert("RGB"))
    mean = tuple(int(x) for x in stat.mean)
    return {"format": fmt, "mode": mode, "width": w, "height": h, "mean_rgb": mean}

def dataurl_bytes(data_url: str) -> int:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    pad = data_url.count("=")
    return (len(data_url) * 3)//4 - pad

def fmt_size(num_bytes: int) -> str:
    units = ["B","KB","MB","GB"]
    s = float(num_bytes)
    for u in units:
        if s < 1024 or u == "GB":
            return f"{s:.1f} {u}"
        s /= 1024

def resample_from_name(name: str):
    name = (name or "").lower()
    return {
        "nearest": Resampling.NEAREST,
        "bilinear": Resampling.BILINEAR,
        "bicubic": Resampling.BICUBIC,
        "lanczos": Resampling.LANCZOS,
    }.get(name, Resampling.LANCZOS)
