# src/images.py
import base64, io
from PIL import Image, ImageOps

# Map formats (now includes HEIC/HEIF)
ALLOWED_EXPORT = {
    "jpeg": ("JPEG", "image/jpeg"),
    "jpg":  ("JPEG", "image/jpeg"),
    "png":  ("PNG",  "image/png"),
    "webp": ("WEBP", "image/webp"),
    "bmp":  ("BMP",  "image/bmp"),
    "tiff": ("TIFF", "image/tiff"),
    "heic": ("HEIF", "image/heif"),
    "heif": ("HEIF", "image/heif"),
}

def b64_to_image(data_url: str) -> Image.Image:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    return img

def image_to_dataurl(img: Image.Image, fmt="PNG", quality=92, exif_bytes=None):
    buf = io.BytesIO()
    save_kwargs = {}
    F = fmt.upper()

    if F == "JPEG":
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs["quality"] = int(quality)
        save_kwargs["optimize"] = True

    if F in ("WEBP", "HEIF"):
        save_kwargs["quality"] = int(quality)

    if exif_bytes and F in ("JPEG", "TIFF", "WEBP", "HEIF"):
        save_kwargs["exif"] = exif_bytes

    img.save(buf, format=F, **save_kwargs)
    mime = next((m for k, (f, m) in ALLOWED_EXPORT.items() if f == F), "image/png")
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def dataurl_size_bytes(data_url: str) -> int:
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    pad = data_url.count("=")
    return (len(data_url) * 3) // 4 - pad

def stats(img: Image.Image):
    from PIL import ImageStat
    fmt = (img.format or "").upper()
    mode = img.mode
    w, h = img.size
    stat = ImageStat.Stat(img.convert("RGB"))
    mean = tuple(int(x) for x in stat.mean)
    return {"format": fmt, "mode": mode, "width": w, "height": h, "mean_rgb": mean}

def resample_from_name(name: str):
    try:
        Resampling = Image.Resampling
    except AttributeError:
        class Resampling:
            NEAREST = Image.NEAREST
            BILINEAR = Image.BILINEAR
            BICUBIC  = Image.BICUBIC
            LANCZOS  = Image.ANTIALIAS
    key = (name or "lanczos").lower()
    return {
        "nearest": Resampling.NEAREST,
        "bilinear": Resampling.BILINEAR,
        "bicubic": Resampling.BICUBIC,
        "lanczos": Resampling.LANCZOS,
    }.get(key, Resampling.LANCZOS)
