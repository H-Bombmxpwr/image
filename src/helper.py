# src/helper.py
from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import io, base64, os
import numpy as np

try:
    import seam_carving
    HAS_SEAM = True
except Exception:
    HAS_SEAM = False

def _to_dataurl(img, fmt="PNG", quality=92):
    buf = io.BytesIO()
    save_kwargs = {}
    if fmt.upper() == "JPEG":
        if img.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            bg.paste(img, mask=img.split()[-1])
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs.update(quality=int(quality), optimize=True)
    if fmt.upper() == "WEBP":
        save_kwargs.update(quality=int(quality))
    img.save(buf, format=fmt, **save_kwargs)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def make_examples(image_path: str, has_seam: bool = False):
    if not os.path.exists(image_path):
        return []

    base = Image.open(image_path)
    base.load()

    ex = []

    def add(label, pil, fmt="PNG"):
        ex.append({"label": label, "img": _to_dataurl(pil, fmt)})

    add("Original", base.copy())

    # Adjust
    add("Brightness ×1.2", ImageEnhance.Brightness(base).enhance(1.2))
    add("Contrast ×1.3", ImageEnhance.Contrast(base).enhance(1.3))
    add("Gamma 0.7", base.point([min(255, int((i/255.0) ** (1/0.7) * 255 + 0.5)) for i in range(256)] * (4 if base.mode=="RGBA" else 3)))

    # Filters
    add("Grayscale", ImageOps.grayscale(base).convert("RGB"))
    g = ImageOps.grayscale(base)
    add("Sepia", ImageOps.colorize(g, (20,10,0), (255,240,192)))
    add("Invert", ImageOps.invert(base.convert("RGB")))
    add("Gaussian σ=1.5", base.filter(ImageFilter.GaussianBlur(1.5)))
    add("Median 3×3", base.filter(ImageFilter.MedianFilter(size=3)))
    add("Unsharp mask", base.filter(ImageFilter.UnsharpMask(radius=2.0, percent=150, threshold=3)))
    add("Edges (Sobel-like)", base.filter(ImageFilter.FIND_EDGES))
    add("Emboss", base.filter(ImageFilter.EMBOSS))
    add("Posterize 4-bit", ImageOps.posterize(base.convert("RGB"), 4))

    # Pixelate
    px = 8
    small = base.resize((max(1, base.width//px), max(1, base.height//px)), Image.NEAREST)
    add("Pixelate ×8", small.resize(base.size, Image.NEAREST))

    # Histogram equalization
    y = ImageOps.equalize(ImageOps.grayscale(base))
    add("Histogram equalization", Image.merge("RGB", (y, y, y)))

    # Resize & rotate
    add("Resize (contain 512×512)", ImageOps.contain(base, (512, 512), method=Image.LANCZOS))
    add("Rotate +90°", base.rotate(-90, expand=True, resample=Image.BICUBIC))

    # Background removal (simple)
    if base.mode != "RGBA":
        work = base.convert("RGBA")
    else:
        work = base.copy()
    arr = np.array(work)
    border = np.concatenate([arr[0,:,:3], arr[-1,:,:3], arr[:,0,:3], arr[:,-1,:3]], axis=0)
    bg = border.mean(axis=0)
    dist = np.linalg.norm(arr[:,:,:3].astype(np.float32) - bg, axis=2)
    alpha = arr[:,:,3].astype(np.float32)
    alpha[dist < 30.0] = 0
    add("Background removal (demo)", Image.fromarray(np.dstack([arr[:,:,:3], alpha.astype(np.uint8)]), "RGBA"))

    # Seam carving (if available)
    if has_seam and HAS_SEAM:
        try:
            src = np.array(base.convert("RGB"))
            target_w = max(20, src.shape[1] - src.shape[1]//5)
            carved = seam_carving.resize(src, (target_w, src.shape[0]), energy_mode="backward", order="width-first")
            add("Seam carving (−20% width)", Image.fromarray(carved))
        except Exception:
            pass

    return ex
