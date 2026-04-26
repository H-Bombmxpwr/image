"""AI-powered background removal using rembg (lazy-loaded)."""
from PIL import Image
import importlib.util
import io
import os

HAS_REMBG = (
    importlib.util.find_spec("rembg") is not None and
    importlib.util.find_spec("onnxruntime") is not None
)
_remove_fn = None
_new_session_fn = None
_session = None

def _load_rembg_symbols():
    global _remove_fn, _new_session_fn
    if _remove_fn is not None and _new_session_fn is not None:
        return _remove_fn, _new_session_fn

    try:
        from rembg import new_session, remove
    except ModuleNotFoundError as exc:
        missing = exc.name or "required dependency"
        raise RuntimeError(f"AI background removal is unavailable: missing {missing}.") from exc
    except Exception as exc:
        raise RuntimeError(f"AI background removal could not be initialized: {exc}") from exc

    _remove_fn = remove
    _new_session_fn = new_session
    return _remove_fn, _new_session_fn


def _get_session():
    global _session
    if _session is None:
        _, new_session = _load_rembg_symbols()
        model_name = os.environ.get("REMBG_MODEL", "isnet-general-use")
        _session = new_session(model_name)
    return _session

def remove_bg_ai(img: Image.Image) -> Image.Image:
    """Remove background using AI (rembg library)."""
    if not HAS_REMBG:
        raise RuntimeError("AI background removal is unavailable: install rembg and onnxruntime.")

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    buf = io.BytesIO()
    img.save(buf, format="PNG")

    remove, _ = _load_rembg_symbols()
    output = remove(
        buf.getvalue(),
        session=_get_session(),
        alpha_matting=os.environ.get("REMBG_ALPHA_MATTING", "1") != "0",
        alpha_matting_foreground_threshold=int(os.environ.get("REMBG_FG_THRESHOLD", "240")),
        alpha_matting_background_threshold=int(os.environ.get("REMBG_BG_THRESHOLD", "10")),
        alpha_matting_erode_size=int(os.environ.get("REMBG_ERODE_SIZE", "10")),
        post_process_mask=os.environ.get("REMBG_POST_PROCESS_MASK", "1") != "0",
    )

    result = Image.open(io.BytesIO(output))
    result.load()
    return result
