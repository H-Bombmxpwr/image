from flask import Flask, render_template, request, jsonify, send_file
import io
import os

from src.io_utils import (
    b64_to_image, image_to_dataurl, dataurl_bytes, fmt_size,
    stats_for, exif_to_dict, write_exif, ALLOWED_EXPORT
)
from src.ops import (
    rotate_img, flip_img, resize_img, crop_img,
    apply_filters, apply_adjust, hist_equalize, remove_background, convert_img,
    auto_enhance, vignette_img, add_border, add_watermark
)
from src.gif_ops import (
    HAS_GIF, resize_gif, trim_gif, extract_gif_frames,
    change_gif_speed, reverse_gif, gif_to_frames_zip
)
from src.seam import HAS_SEAM, SEAM_BACKEND, seam_carve
from src.bg_remove import HAS_REMBG, remove_bg_ai
from src.exporter import prepare_download
from src.heif_support import register_heif

register_heif()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-key-change-in-prod")
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024  # 32 MB upload limit

# ---------- pages ----------
@app.get("/")
def index():
    return render_template("index.html", has_seam=HAS_SEAM, has_rembg=HAS_REMBG, has_gif=HAS_GIF)

@app.get("/help")
def help_page():
    return render_template("help.html", has_seam=HAS_SEAM, seam_backend=SEAM_BACKEND, has_rembg=HAS_REMBG)

@app.get("/about")
def about_page():
    return render_template("about.html")

# ---------- api ----------
@app.post("/api/inspect")
def api_inspect():
    data_url = request.json["image"]
    img = b64_to_image(data_url)
    size_bytes = dataurl_bytes(data_url)
    meta = stats_for(img)
    meta["file_size"] = size_bytes
    meta["file_size_str"] = fmt_size(size_bytes)
    return jsonify({"meta": meta, "exif": exif_to_dict(img)})

@app.post("/api/convert")
def api_convert():
    d = request.json
    img = b64_to_image(d["image"])
    to = d.get("to", "png")
    quality = int(d.get("quality", 92))
    return jsonify({"img": convert_img(img, to, quality)})

@app.post("/api/rotate")
def api_rotate():
    d = request.json
    img = b64_to_image(d["image"])
    out = rotate_img(img, float(d.get("degrees", 0)), bool(d.get("expand", True)))
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/flip")
def api_flip():
    d = request.json
    img = b64_to_image(d["image"])
    out = flip_img(img, d.get("axis", "h"))
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/resize")
def api_resize():
    d = request.json
    img = b64_to_image(d["image"])
    out = resize_img(
        img,
        int(d.get("width") or img.width),
        int(d.get("height") or img.height),
        bool(d.get("keep_aspect", True)),
        d.get("method"),
    )
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/crop")
def api_crop():
    d = request.json
    img = b64_to_image(d["image"])
    out = crop_img(
        img,
        float(d["x"]), float(d["y"]), float(d["width"]), float(d["height"]),
        float(d.get("rotate", 0))
    )
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/filters")
def api_filters():
    d = request.json
    img = b64_to_image(d["image"])
    out = apply_filters(img, d)
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/adjust")
def api_adjust():
    d = request.json
    img = b64_to_image(d["image"])
    out = apply_adjust(img,
        float(d.get("brightness", 1.0)),
        float(d.get("contrast", 1.0)),
        float(d.get("saturation", 1.0)),
        float(d.get("gamma", 1.0)),
        float(d.get("hue", 0.0)),
        float(d.get("temperature", 0.0)),
    )
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/histeq")
def api_hist_eq():
    img = b64_to_image(request.json["image"])
    out = hist_equalize(img)
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/background_remove")
def api_background_remove():
    d = request.json
    img = b64_to_image(d["image"])
    out = remove_background(img, float(d.get("tolerance", 18.0)))
    return jsonify({"img": image_to_dataurl(out, "PNG")})

@app.post("/api/background_remove_ai")
def api_background_remove_ai():
    if not HAS_REMBG:
        return jsonify({"error": "AI background removal not available (rembg not installed)"}), 400
    d = request.json
    img = b64_to_image(d["image"])
    out = remove_bg_ai(img)
    return jsonify({"img": image_to_dataurl(out, "PNG")})

@app.post("/api/seam_carve")
def api_seam():
    if not HAS_SEAM:
        return jsonify({"error": "Seam carving module not available"}), 400
    d = request.json
    img = b64_to_image(d["image"])
    out = seam_carve(
        img, int(d.get("target_width", img.width)),
        int(d.get("target_height", img.height)),
        d.get("order", "width-first"),
        d.get("energy_mode", "backward"),
    )
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/auto_enhance")
def api_auto_enhance():
    img = b64_to_image(request.json["image"])
    out = auto_enhance(img)
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/vignette")
def api_vignette():
    d = request.json
    img = b64_to_image(d["image"])
    out = vignette_img(img, float(d.get("strength", 0.5)))
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/border")
def api_border():
    d = request.json
    img = b64_to_image(d["image"])
    out = add_border(img, int(d.get("size", 10)), d.get("color", "#000000"))
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/watermark")
def api_watermark():
    d = request.json
    img = b64_to_image(d["image"])
    out = add_watermark(
        img, 
        d.get("text", ""),
        d.get("position", "bottom-right"),
        float(d.get("opacity", 0.5)),
        d.get("color", "#ffffff")
    )
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/write_metadata")
def api_write_metadata():
    d = request.json
    img = b64_to_image(d["image"])
    metadata = d.get("metadata", {})
    out = write_exif(img, metadata)
    return jsonify({"img": image_to_dataurl(out)})

@app.post("/api/metadata_read")
def api_metadata_read():
    d = request.json
    img = b64_to_image(d["image"])
    return jsonify({"meta": exif_to_dict(img)})

@app.post("/api/metadata_write")
def api_metadata_write():
    d = request.json
    img = b64_to_image(d["image"])
    updates = d.get("updates", {})
    out = write_exif(img, updates)
    return jsonify({"img": image_to_dataurl(out), "meta": exif_to_dict(out)})

@app.post("/api/normalize")
def api_normalize():
    d = request.json
    img = b64_to_image(d["image"])
    return jsonify({"img": image_to_dataurl(img, "PNG")})

# GIF endpoints
@app.post("/api/gif/resize")
def api_gif_resize():
    if not HAS_GIF:
        return jsonify({"error": "GIF support not available"}), 400
    d = request.json
    result = resize_gif(
        d["image"],
        int(d.get("width", 0)),
        int(d.get("height", 0)),
        bool(d.get("keep_aspect", True))
    )
    return jsonify({"img": result})

@app.post("/api/gif/trim")
def api_gif_trim():
    if not HAS_GIF:
        return jsonify({"error": "GIF support not available"}), 400
    d = request.json
    result = trim_gif(
        d["image"],
        int(d.get("start_frame", 0)),
        int(d.get("end_frame", -1))
    )
    return jsonify({"img": result})

@app.post("/api/gif/speed")
def api_gif_speed():
    if not HAS_GIF:
        return jsonify({"error": "GIF support not available"}), 400
    d = request.json
    result = change_gif_speed(d["image"], float(d.get("speed_factor", 1.0)))
    return jsonify({"img": result})

@app.post("/api/gif/reverse")
def api_gif_reverse():
    if not HAS_GIF:
        return jsonify({"error": "GIF support not available"}), 400
    d = request.json
    result = reverse_gif(d["image"])
    return jsonify({"img": result})

@app.post("/api/gif/info")
def api_gif_info():
    if not HAS_GIF:
        return jsonify({"error": "GIF support not available"}), 400
    d = request.json
    frames = extract_gif_frames(d["image"], max_frames=10)
    return jsonify({
        "frame_count": len(frames),
        "frames": frames
    })

@app.post("/api/export")
def api_export():
    d = request.json
    img = b64_to_image(d["image"])
    fmt_key = (d.get("format") or "png").lower()
    quality = int(d.get("quality", 92))
    buf, mime = prepare_download(img, fmt_key, quality)
    buf.seek(0)
    return send_file(buf, mimetype=mime, as_attachment=True, download_name=f"edited.{fmt_key}")


IS_PRODUCTION = os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("PRODUCTION")

if not IS_PRODUCTION:
    app.config.update(
        TEMPLATES_AUTO_RELOAD=True,
        SEND_FILE_MAX_AGE_DEFAULT=0
    )

    @app.after_request
    def _no_cache(resp):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)),
            debug=not IS_PRODUCTION)
