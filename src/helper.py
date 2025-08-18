# src/helper.py
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import os, sys
import numpy as np

# Optional seam carving
HAS_SEAM = True
BACKEND = "seam-carving"
try:
    import seam_carving  # pip install seam-carving
except Exception:
    try:
        from skimage import transform, filters, color, img_as_ubyte  # type: ignore
        BACKEND = "scikit-image"
    except Exception:
        HAS_SEAM = False
        BACKEND = "none"

# ---- paths ----
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "static", "images", "memory.jpg")
OUTDIR = os.path.join(ROOT, "static", "images", "help")
os.makedirs(OUTDIR, exist_ok=True)

def save(img: Image.Image, name: str, fmt="PNG"):
    path = os.path.join(OUTDIR, f"{name}.png" if fmt.upper()=="PNG" else f"{name}.{fmt.lower()}")
    img.save(path, format=fmt)
    print("wrote", os.path.relpath(path, ROOT))

def to_rgb(im: Image.Image) -> Image.Image:
    return im if im.mode == "RGB" else im.convert("RGB")

def main():
    if not os.path.exists(SRC):
        print(f"Missing input image at {SRC}")
        sys.exit(1)

    base = Image.open(SRC)
    base.load()
    base = to_rgb(base)

    # 0. original
    save(base, "00_original")

    # 1. grayscale
    g = ImageOps.grayscale(base).convert("RGB")
    save(g, "01_grayscale")

    # 2. sepia
    sep = ImageOps.colorize(ImageOps.grayscale(base), (20,10,0), (255,240,192))
    save(sep, "02_sepia")

    # 3. invert
    inv = ImageOps.invert(base)
    save(inv, "03_invert")

    # 4. gaussian r=1.5
    ga15 = base.filter(ImageFilter.GaussianBlur(1.5))
    save(ga15, "04_gaussian_1_5")

    # 5. gaussian r=3
    ga3 = base.filter(ImageFilter.GaussianBlur(3.0))
    save(ga3, "05_gaussian_3")

    # 6. median 3x3
    med3 = base.filter(ImageFilter.MedianFilter(size=3))
    save(med3, "06_median_3")

    # 7. sharpen (unsharp)
    sharp = base.filter(ImageFilter.UnsharpMask(radius=2.0, percent=150, threshold=3))
    save(sharp, "07_sharpen")

    # 8. edges
    edge = base.filter(ImageFilter.FIND_EDGES)
    save(edge, "08_edges")

    # 9. emboss
    emb = base.filter(ImageFilter.EMBOSS)
    save(emb, "09_emboss")

    # 10. posterize 4 bits
    post4 = ImageOps.posterize(base, 4)
    save(post4, "10_posterize_4bits")

    # 11. pixelate 8px
    block = 8
    small = base.resize((max(1, base.width//block), max(1, base.height//block)), Image.NEAREST)
    pix = small.resize(base.size, Image.NEAREST)
    save(pix, "11_pixelate_8px")

    # 12. histogram equalization (luma)
    y = ImageOps.grayscale(base)
    y = ImageOps.equalize(y)
    he = Image.merge("RGB", (y,)*3)
    save(he, "12_hist_eq")

    # 13. background removal (simple border color tolerance)
    rgba = base.convert("RGBA")
    arr = np.array(rgba)
    border = np.concatenate([arr[0,:,:3], arr[-1,:,:3], arr[:,0,:3], arr[:,-1,:3]], axis=0)
    bg = border.mean(axis=0)
    rgb = arr[:,:,:3].astype(np.float32)
    dist = np.linalg.norm(rgb - bg, axis=2)
    tol = 18.0
    threshold = (tol/100.0)*255.0*1.5
    alpha = arr[:,:,3].astype(np.float32)
    alpha[dist < threshold] = 0
    out_bg = Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)]), "RGBA")
    save(out_bg, "13_background_remove")

    # 14. rotate +90
    rot = base.rotate(-90, expand=True, resample=Image.BICUBIC)
    save(rot, "14_rotate_90")

    # 15. flip H
    flip = ImageOps.mirror(base)
    save(flip, "15_flip_h")

    # 16. resize half (contain-ish)
    half = ImageOps.contain(base, (base.width//2, base.height//2), method=Image.LANCZOS)
    save(half, "16_resize_half")

    # 17. resize double (lanczos)
    dbl = base.resize((base.width*2, base.height*2), resample=Image.LANCZOS)
    save(dbl, "17_resize_double")

    # 18. adjust brightness/contrast/saturation/gamma
    b = ImageEnhance.Brightness(base).enhance(1.20)
    c = ImageEnhance.Contrast(b).enhance(1.15)
    s = ImageEnhance.Color(c).enhance(1.10)
    # gamma 0.9
    lut = [min(255, int((i/255.0) ** (1.0/0.9) * 255 + 0.5)) for i in range(256)]
    adj = s.point(lut*3)
    save(adj, "18_adjust_b+20_c+15_s+10_g0_9")

    # 19. seam carve to 70% width (if available; else high-quality resize as fallback)
    target_w = int(round(base.width * 0.7))
    if HAS_SEAM and BACKEND == "seam-carving":
        arr = np.array(base)
        carved = seam_carving.resize(arr, (target_w, base.height), energy_mode="backward", order="width-first")
        sc = Image.fromarray(carved)
        save(sc, "19_seamcarve_w70")
    elif HAS_SEAM and BACKEND == "scikit-image":
        from skimage import transform, filters, color, img_as_ubyte  # type: ignore
        arr = np.array(base)/255.0
        gray = color.rgb2gray(arr)
        energy = filters.sobel(gray)
        if target_w < base.width:
            num = base.width - target_w
            out = transform.seam_carve(arr, energy, 'vertical', num)
            sc = Image.fromarray(img_as_ubyte(out))
            save(sc, "19_seamcarve_w70")
        else:
            sc = base.resize((target_w, base.height), resample=Image.LANCZOS)
            save(sc, "19_resize_w70_lanczos")
    else:
        sc = base.resize((target_w, base.height), resample=Image.LANCZOS)
        save(sc, "19_resize_w70_lanczos")

if __name__ == "__main__":
    main()
