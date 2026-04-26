"""AI-powered background removal using rembg (lazy-loaded)."""
from PIL import Image
import io
import os

HAS_REMBG = False
_remove_fn = None
_session = None

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


def _get_session():
    global _session
    if _session is None:
        from rembg import new_session
        model_name = os.environ.get("REMBG_MODEL", "u2net")
        _session = new_session(model_name)
    return _session

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
    output = remove(buf.getvalue(), session=_get_session())

    result = Image.open(io.BytesIO(output))
    result.load()
    return result
