import importlib.util
from PIL import Image
import numpy as np

HAS_SEAM = False
SEAM_BACKEND = "none"

if importlib.util.find_spec("seam_carving") is not None:
    HAS_SEAM = True
    SEAM_BACKEND = "seam-carving"
elif importlib.util.find_spec("skimage") is not None:
    HAS_SEAM = True
    SEAM_BACKEND = "scikit-image"

def seam_carve(img: Image.Image, target_w: int, target_h: int, order: str, energy_mode: str) -> Image.Image:
    """Content-aware resize using seam carving."""
    if SEAM_BACKEND == "seam-carving":
        import seam_carving
        dst = seam_carving.resize(
            np.array(img.convert("RGB")),
            (target_w, target_h),
            energy_mode=energy_mode,
            order=order
        )
        return Image.fromarray(dst)

    # scikit-image fallback (only seam-removal; enlarge via normal resize)
    if SEAM_BACKEND == "scikit-image":
        from skimage import transform, filters, color, img_as_ubyte
        arr = np.array(img.convert("RGB")) / 255.0
        gray = color.rgb2gray(arr)
        energy = filters.sobel(gray)

        if target_w < img.width:
            num = img.width - target_w
            carved = transform.seam_carve(arr, energy, "vertical", num)
            return Image.fromarray(img_as_ubyte(carved))
        return img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    return img.resize((target_w, target_h), Image.Resampling.LANCZOS)
