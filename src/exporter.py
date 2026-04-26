import io
from PIL import Image
from .io_utils import ALLOWED_EXPORT, _save_with_metadata


def prepare_download(img: Image.Image, fmt_key: str, quality: int, metadata: dict | None = None):
    """Prepare an image download in the requested format."""
    fmt, mime = ALLOWED_EXPORT.get((fmt_key or "png").lower(), ("PNG", "image/png"))
    buf = io.BytesIO()
    _save_with_metadata(img, buf, fmt, quality, metadata)
    return buf, mime
