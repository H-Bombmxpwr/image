from collections import deque
from PIL import Image, ImageFilter
import numpy as np
from .io_utils import image_to_dataurl, ALLOWED_EXPORT


def convert_img(img: Image.Image, to_key: str, quality: int):
    """Convert image to a different format."""
    fmt, _ = ALLOWED_EXPORT.get((to_key or "png").lower(), ("PNG", "image/png"))
    return image_to_dataurl(img, fmt, quality)


def _flood_background(similar: np.ndarray) -> np.ndarray:
    """Mark only similar pixels that are connected to the image border."""
    height, width = similar.shape
    visited = np.zeros_like(similar, dtype=bool)
    queue = deque()

    def enqueue(x: int, y: int):
        if 0 <= x < width and 0 <= y < height and similar[y, x] and not visited[y, x]:
            visited[y, x] = True
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        enqueue(x + 1, y)
        enqueue(x - 1, y)
        enqueue(x, y + 1)
        enqueue(x, y - 1)

    return visited


def remove_background(img: Image.Image, tol: float):
    """Remove a likely studio/background color with soft edge matting."""
    arr = np.array(img.convert("RGBA"), dtype=np.uint8)
    rgb = arr[:, :, :3].astype(np.float32)

    top = rgb[0, :, :]
    bottom = rgb[-1, :, :]
    left = rgb[:, 0, :]
    right = rgb[:, -1, :]
    border = np.concatenate([top, bottom, left, right], axis=0)

    background_color = np.median(border, axis=0)
    distance = np.linalg.norm(rgb - background_color, axis=2)

    threshold = max(8.0, 12.0 + (tol / 100.0) * 120.0)
    similar = distance <= threshold
    connected_bg = _flood_background(similar)

    soft_lo = threshold * 0.62
    soft_hi = threshold * 1.55
    soft_alpha = np.clip((distance - soft_lo) / max(1.0, soft_hi - soft_lo), 0.0, 1.0) * 255.0

    alpha = arr[:, :, 3].astype(np.float32)
    alpha[connected_bg] = np.minimum(alpha[connected_bg], soft_alpha[connected_bg])

    alpha_img = Image.fromarray(alpha.astype(np.uint8), "L")
    feather = max(0.8, tol / 24.0)
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=feather))
    alpha = np.array(alpha_img, dtype=np.uint8)

    out = np.dstack([rgb.astype(np.uint8), alpha])
    return Image.fromarray(out, "RGBA")
