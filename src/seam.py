from PIL import Image
import numpy as np

HAS_SEAM = True
SEAM_BACKEND = "seam-carving"

try:
    import seam_carving  # pip install seam-carving
except Exception:
    try:
        from skimage import transform, filters, color, img_as_ubyte
        HAS_SEAM = True
        SEAM_BACKEND = "scikit-image"
    except Exception:
        HAS_SEAM = False
        SEAM_BACKEND = "none"

def seam_carve(img: Image.Image, target_w: int, target_h: int, order: str, energy_mode: str) -> Image.Image:
    if SEAM_BACKEND == "seam-carving":
        dst = seam_carving.resize(np.array(img.convert("RGB")), (target_w, target_h),
                                  energy_mode=energy_mode, order=order)
        return Image.fromarray(dst)

    # scikit-image fallback (only seam-removal; enlarge via normal resize)
    from skimage import transform, filters, color, img_as_ubyte
    arr = np.array(img.convert("RGB")) / 255.0
    gray = color.rgb2gray(arr)
    energy = filters.sobel(gray)

    if target_w < img.width:
        num = img.width - target_w
        carved = transform.seam_carve(arr, energy, 'vertical', num)
        return Image.fromarray(img_as_ubyte(carved))
    else:
        # simple high-quality enlarge
        return img.resize((target_w, target_h), Image.Resampling.LANCZOS)
