import base64
import io
import json
import os
import time
from flask import Flask, render_template, request, jsonify, send_file
from PIL import Image

from src.io_utils import b64_to_image, exif_to_dict, fmt_size, image_to_dataurl, stats_for
from src.ops import convert_img, remove_background
from src.gif_ops import (
    HAS_GIF, resize_gif, trim_gif, extract_gif_frames,
    change_gif_speed, reverse_gif, gif_to_frames_zip,
    gif_info, optimize_gif, pingpong_gif, poster_frame,
)
from src.seam import HAS_SEAM, SEAM_BACKEND, seam_carve
from src.bg_remove import HAS_REMBG, remove_bg_ai
from src.exporter import prepare_download
from src.heif_support import register_heif

register_heif()

app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev-key-change-in-prod")
app.config["MAX_CONTENT_LENGTH"] = 32 * 1024 * 1024
app.config["ASSET_VERSION"] = (
    os.environ.get("RAILWAY_DEPLOYMENT_ID")
    or os.environ.get("RAILWAY_GIT_COMMIT_SHA")
    or os.environ.get("SOURCE_COMMIT")
    or str(int(time.time()))
)


@app.context_processor
def inject_asset_version():
    return {"asset_version": app.config["ASSET_VERSION"]}


def _open_uploaded_image(field: str = "image"):
    upload = request.files.get(field)
    if upload is None:
        raise ValueError("No uploaded image provided")
    raw = upload.read()
    image = Image.open(io.BytesIO(raw))
    image.load()
    return image, raw


@app.get("/")
def index():
    return render_template("index.html", has_seam=HAS_SEAM, has_rembg=HAS_REMBG, has_gif=HAS_GIF)


@app.get("/help")
def help_page():
    return render_template("help.html", has_seam=HAS_SEAM, seam_backend=SEAM_BACKEND, has_rembg=HAS_REMBG)


@app.get("/about")
def about_page():
    return render_template("about.html")


@app.get("/health")
def health_check():
    return "ok", 200


@app.post("/api/inspect_upload")
def api_inspect_upload():
    img, raw = _open_uploaded_image()
    meta = stats_for(img)
    meta["file_size"] = len(raw)
    meta["file_size_str"] = fmt_size(len(raw))
    return jsonify({"meta": meta, "exif": exif_to_dict(img)})


@app.post("/api/convert")
def api_convert():
    d = request.json
    img = b64_to_image(d["image"])
    return jsonify({"img": convert_img(img, d.get("to", "png"), int(d.get("quality", 92)))})


@app.post("/api/background_remove")
def api_background_remove():
    d = request.json
    img = b64_to_image(d["image"])
    out = remove_background(img, float(d.get("tolerance", 18.0)))
    return jsonify({"img": image_to_dataurl(out, "PNG")})


@app.post("/api/background_remove_ai")
def api_background_remove_ai():
    if not HAS_REMBG:
        return jsonify({"error": "Local AI background removal is not available. Install rembg and onnxruntime on the server."}), 400
    d = request.json
    img = b64_to_image(d["image"])
    try:
        out = remove_bg_ai(img)
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception:
        app.logger.exception("AI background removal failed")
        return jsonify({"error": "AI background removal failed on the server."}), 500
    return jsonify({"img": image_to_dataurl(out, "PNG")})


@app.post("/api/seam_carve")
def api_seam():
    if not HAS_SEAM:
        return jsonify({"error": "Seam carving is not available."}), 400
    d = request.json
    img = b64_to_image(d["image"])
    out = seam_carve(
        img,
        int(d.get("target_width", img.width)),
        int(d.get("target_height", img.height)),
        d.get("order", "width-first"),
        d.get("energy_mode", "backward"),
    )
    return jsonify({"img": image_to_dataurl(out)})


@app.post("/api/gif/resize")
def api_gif_resize():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    return jsonify({
        "img": resize_gif(
            d["image"],
            int(d.get("width", 0)),
            int(d.get("height", 0)),
            bool(d.get("keep_aspect", True)),
        )
    })


@app.post("/api/gif/trim")
def api_gif_trim():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    return jsonify({"img": trim_gif(d["image"], int(d.get("start_frame", 0)), int(d.get("end_frame", -1)))})


@app.post("/api/gif/speed")
def api_gif_speed():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    return jsonify({"img": change_gif_speed(d["image"], float(d.get("speed_factor", 1.0)))})


@app.post("/api/gif/reverse")
def api_gif_reverse():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    return jsonify({"img": reverse_gif(request.json["image"])})


@app.post("/api/gif/pingpong")
def api_gif_pingpong():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    return jsonify({"img": pingpong_gif(request.json["image"])})


@app.post("/api/gif/optimize")
def api_gif_optimize():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    return jsonify({
        "img": optimize_gif(
            d["image"],
            int(d.get("colors", 128)),
            int(d.get("frame_step", 1)),
        )
    })


@app.post("/api/gif/poster")
def api_gif_poster():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    return jsonify({"img": poster_frame(d["image"], int(d.get("frame", 0)))})


@app.post("/api/gif/frames_zip")
def api_gif_frames_zip():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    raw = gif_to_frames_zip(request.json["image"])
    payload = "data:application/zip;base64," + base64.b64encode(raw).decode("ascii")
    return jsonify({"zip": payload})


@app.post("/api/gif/info")
def api_gif_info():
    if not HAS_GIF:
        return jsonify({"error": "GIF support is not available."}), 400
    d = request.json
    info = gif_info(d["image"])
    info["frames"] = extract_gif_frames(d["image"], max_frames=10)
    return jsonify(info)


@app.post("/api/export")
def api_export():
    if request.files.get("image"):
        img, _ = _open_uploaded_image()
        fmt_key = (request.form.get("format") or "png").lower()
        quality = int(request.form.get("quality", 92))
        metadata_raw = request.form.get("metadata") or "{}"
        try:
            metadata = json.loads(metadata_raw)
        except Exception:
            metadata = {}
    else:
        d = request.json
        img = b64_to_image(d["image"])
        fmt_key = (d.get("format") or "png").lower()
        quality = int(d.get("quality", 92))
        metadata = d.get("metadata", {})

    buf, mime = prepare_download(img, fmt_key, quality, metadata)
    buf.seek(0)
    return send_file(buf, mimetype=mime, as_attachment=True, download_name=f"edited.{fmt_key}")


IS_PRODUCTION = os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("PRODUCTION")

if IS_PRODUCTION:
    app.config["SEND_FILE_MAX_AGE_DEFAULT"] = 86400

    @app.after_request
    def _cache_static(resp):
        if request.path.startswith("/static/"):
            resp.headers["Cache-Control"] = "public, max-age=86400"
        return resp
else:
    app.config.update(TEMPLATES_AUTO_RELOAD=True, SEND_FILE_MAX_AGE_DEFAULT=0)

    @app.after_request
    def _no_cache(resp):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=not IS_PRODUCTION)
