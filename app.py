from flask import Flask, render_template, request, jsonify, send_file
import io, os

from src.io_utils import (
    b64_to_image, image_to_dataurl, dataurl_bytes, fmt_size,
    stats_for, exif_to_dict, ALLOWED_EXPORT
)
from src.ops import (
    rotate_img, flip_img, resize_img, crop_img,
    apply_filters, apply_adjust, hist_equalize, remove_background, convert_img
)
from src.seam import HAS_SEAM, SEAM_BACKEND, seam_carve
from src.exporter import prepare_download

app = Flask(__name__)
app.config["SECRET_KEY"] = "dev-key"

# ---------- pages ----------
@app.get("/")
def index():
    return render_template("index.html", has_seam=HAS_SEAM)

@app.get("/help")
def help_page():
    return render_template("help.html", has_seam=HAS_SEAM, seam_backend=SEAM_BACKEND)

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
        float(d.get("brightness",1.0)),
        float(d.get("contrast",  1.0)),
        float(d.get("saturation",1.0)),
        float(d.get("gamma",     1.0)),
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

@app.post("/api/export")
def api_export():
    d = request.json
    img = b64_to_image(d["image"])
    fmt_key = (d.get("format") or "png").lower()
    quality = int(d.get("quality", 92))
    buf, mime = prepare_download(img, fmt_key, quality)
    buf.seek(0)
    return send_file(buf, mimetype=mime, as_attachment=True, download_name=f"edited.{fmt_key}")


app.config.update(
    TEMPLATES_AUTO_RELOAD=True,        # templates
    SEND_FILE_MAX_AGE_DEFAULT=0        # static files
)

if app.debug:
    @app.after_request
    def _no_cache(resp):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
        resp.headers["Expires"] = "0"
        return resp


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
