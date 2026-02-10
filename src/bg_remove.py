"""AI-powered background removal using rembg (lazy-loaded)."""
from PIL import Image
import io

HAS_REMBG = False
_remove_fn = None

try:
    import importlib
    importlib.import_module("rembg")
    HAS_REMBG = True
except ImportError:
    pass
except Exception:
    pass

def _get_remove():
    global _remove_fn
    if _remove_fn is None:
        from rembg import remove
        _remove_fn = remove
    return _remove_fn

def remove_bg_ai(img: Image.Image) -> Image.Image:
    """Remove background using AI (rembg library)."""
    if not HAS_REMBG:
        raise RuntimeError("rembg not installed")

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    remove = _get_remove()
    output = remove(buf.getvalue())

    result = Image.open(io.BytesIO(output))
    result.load()
    return result
