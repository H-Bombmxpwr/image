from PIL import Image, ImageOps, ImageFilter, ImageEnhance
import numpy as np
from .compat import Resampling
from .io_utils import image_to_dataurl, resample_from_name, ALLOWED_EXPORT

# Convert (returns dataURL string)
def convert_img(img: Image.Image, to_key: str, quality: int):
    fmt, _ = ALLOWED_EXPORT.get((to_key or "png").lower(), ("PNG", "image/png"))
    return image_to_dataurl(img, fmt, quality)

def rotate_img(img: Image.Image, degrees: float, expand: bool):
    return img.rotate(-degrees, expand=expand, resample=Resampling.BICUBIC)

def flip_img(img: Image.Image, axis: str):
    return ImageOps.mirror(img) if axis == "h" else ImageOps.flip(img)

def resize_img(img: Image.Image, w: int, h: int, keep_aspect: bool, method_name: str):
    rs = resample_from_name(method_name)
    if keep_aspect:
        # Pillow>=10 keyword is "method"
        return ImageOps.contain(img, (w, h), method=rs)
    return img.resize((w, h), resample=rs)

def crop_img(img: Image.Image, x: float, y: float, w: float, h: float, degrees: float = 0.0):
    if abs(degrees) > 1e-3:
        img = img.rotate(-degrees, expand=True, resample=Resampling.BICUBIC)
    box = (int(x), int(y), int(x+w), int(y+h))
    box = (max(0, box[0]), max(0, box[1]), min(img.width, box[2]), min(img.height, box[3]))
    return img.crop(box)

def apply_filters(img: Image.Image, d: dict):
    if d.get("grayscale"): img = ImageOps.grayscale(img).convert("RGB")
    if d.get("invert"):    img = ImageOps.invert(img.convert("RGB"))
    if d.get("sepia"):
        g = ImageOps.grayscale(img)
        img = ImageOps.colorize(g, (20, 10, 0), (255, 240, 192))
    if d.get("gaussian"): img = img.filter(ImageFilter.GaussianBlur(float(d.get("gaussian_radius", 1.5))))
    if d.get("median"):   img = img.filter(ImageFilter.MedianFilter(size=int(d.get("median_size", 3))))
    if d.get("sharpen"):  img = img.filter(ImageFilter.UnsharpMask(radius=2.0, percent=150, threshold=3))
    if d.get("edge"):     img = img.filter(ImageFilter.FIND_EDGES)
    if d.get("emboss"):   img = img.filter(ImageFilter.EMBOSS)
    if int(d.get("posterize", 0)) > 0:
        bits = max(1, min(8, int(d["posterize"])))
        img = ImageOps.posterize(img.convert("RGB"), bits)
    if int(d.get("pixelate", 1)) > 1:
        b = int(d["pixelate"])
        small = img.resize((max(1, img.width//b), max(1, img.height//b)), Resampling.NEAREST)
        img = small.resize(img.size, Resampling.NEAREST)
    return img

def apply_adjust(img: Image.Image, b: float, c: float, s: float, g: float):
    if abs(b-1) > 1e-3: img = ImageEnhance.Brightness(img).enhance(b)
    if abs(c-1) > 1e-3: img = ImageEnhance.Contrast(img).enhance(c)
    if abs(s-1) > 1e-3: img = ImageEnhance.Color(img).enhance(s)
    if abs(g-1) > 1e-3:
        lut = [min(255, int((i/255.0) ** (1.0/g) * 255 + 0.5)) for i in range(256)]
        img = img.point(lut * (3 if img.mode != "RGBA" else 4))
    return img

def hist_equalize(img: Image.Image):
    y = ImageOps.grayscale(img.convert("RGB"))
    y = ImageOps.equalize(y)
    return Image.merge("RGB", (y,)*3)

def remove_background(img: Image.Image, tol: float):
    arr = np.array(img.convert("RGBA"))
    border = np.concatenate([arr[0,:,:3], arr[-1,:,:3], arr[:,0,:3], arr[:,-1,:3]], axis=0)
    bg = border.mean(axis=0)
    rgb = arr[:,:,:3].astype(np.float32)
    dist = np.linalg.norm(rgb - bg, axis=2)
    threshold = (tol/100.0) * 255.0 * 1.5
    alpha = arr[:,:,3].astype(np.float32)
    alpha[dist < threshold] = 0
    out = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, "RGBA")
