import io
from PIL import Image
from .io_utils import ALLOWED_EXPORT

def prepare_download(img: Image.Image, fmt_key: str, quality: int):
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
    return buf, mime
