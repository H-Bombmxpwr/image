import io
from PIL import Image
from .io_utils import ALLOWED_EXPORT

def prepare_download(img: Image.Image, fmt_key: str, quality: int):
    """Prepare image for download in specified format."""
    fmt, mime = ALLOWED_EXPORT.get(fmt_key, ("PNG", "image/png"))
    buf = io.BytesIO()
    save_kwargs = {}
    
    if fmt == "JPEG":
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if img.mode in ("RGBA", "LA"):
                bg.paste(img, mask=img.split()[-1])
            else:
                bg.paste(img)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs["quality"] = quality
        save_kwargs["optimize"] = True
        
    if fmt == "WEBP":
        save_kwargs["quality"] = quality
        
    if fmt == "PNG":
        save_kwargs["optimize"] = True
        
    if fmt == "GIF":
        if img.mode not in ("P", "L"):
            img = img.convert("P", palette=Image.ADAPTIVE, colors=256)
    
    img.save(buf, format=fmt, **save_kwargs)
    return buf, mime
