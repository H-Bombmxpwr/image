from PIL import Image, ImageOps, ImageFilter, ImageEnhance, ImageDraw, ImageFont
import numpy as np
from .compat import Resampling
from .io_utils import image_to_dataurl, resample_from_name, ALLOWED_EXPORT


def _rgb_to_hsv(arr):
    """Vectorized RGB [0-1 float] to HSV conversion (NumPy)."""
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    maxc = np.maximum(np.maximum(r, g), b)
    minc = np.minimum(np.minimum(r, g), b)
    v = maxc
    s = np.where(maxc != 0, (maxc - minc) / maxc, 0.0)
    diff = maxc - minc
    diff_safe = np.where(diff == 0, 1.0, diff)
    rc = (maxc - r) / diff_safe
    gc = (maxc - g) / diff_safe
    bc = (maxc - b) / diff_safe
    h = np.where(r == maxc, bc - gc,
        np.where(g == maxc, 2.0 + rc - bc, 4.0 + gc - rc))
    h = (h / 6.0) % 1.0
    h = np.where(diff == 0, 0.0, h)
    return np.stack([h, s, v], axis=-1)


def _hsv_to_rgb(arr):
    """Vectorized HSV to RGB [0-1 float] conversion (NumPy)."""
    h, s, v = arr[..., 0], arr[..., 1], arr[..., 2]
    i = (h * 6.0).astype(np.int32)
    f = h * 6.0 - i
    p = v * (1.0 - s)
    q = v * (1.0 - s * f)
    t = v * (1.0 - s * (1.0 - f))
    i_mod = i % 6
    r = np.choose(i_mod, [v, q, p, p, t, v])
    g = np.choose(i_mod, [t, v, v, q, p, p])
    b = np.choose(i_mod, [p, p, t, v, v, q])
    return np.stack([r, g, b], axis=-1)

def convert_img(img: Image.Image, to_key: str, quality: int):
    """Convert image to a different format."""
    fmt, _ = ALLOWED_EXPORT.get((to_key or "png").lower(), ("PNG", "image/png"))
    return image_to_dataurl(img, fmt, quality)

def rotate_img(img: Image.Image, degrees: float, expand: bool):
    """Rotate image by degrees (clockwise positive)."""
    # Preserve alpha channel if present
    if img.mode == "RGBA":
        return img.rotate(-degrees, expand=expand, resample=Resampling.BICUBIC, fillcolor=(0, 0, 0, 0))
    return img.rotate(-degrees, expand=expand, resample=Resampling.BICUBIC)

def flip_img(img: Image.Image, axis: str):
    """Flip image horizontally or vertically."""
    return ImageOps.mirror(img) if axis == "h" else ImageOps.flip(img)

def resize_img(img: Image.Image, w: int, h: int, keep_aspect: bool, method_name: str):
    """Resize image with optional aspect ratio preservation."""
    rs = resample_from_name(method_name)
    if keep_aspect:
        return ImageOps.contain(img, (w, h), method=rs)
    return img.resize((w, h), resample=rs)

def crop_img(img: Image.Image, x: float, y: float, w: float, h: float, degrees: float = 0.0):
    """Crop image with optional rotation."""
    if abs(degrees) > 1e-3:
        img = img.rotate(-degrees, expand=True, resample=Resampling.BICUBIC)
    box = (int(x), int(y), int(x + w), int(y + h))
    box = (max(0, box[0]), max(0, box[1]), min(img.width, box[2]), min(img.height, box[3]))
    return img.crop(box)

def apply_filters(img: Image.Image, d: dict):
    """Apply multiple filters to an image."""
    # Convert to RGB for most operations
    original_mode = img.mode
    alpha = None
    
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        img = img.convert("RGB")
    elif img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    
    # Apply filters in order
    if d.get("grayscale"):
        img = ImageOps.grayscale(img).convert("RGB")
    
    if d.get("invert"):
        img = ImageOps.invert(img)
    
    if d.get("sepia"):
        g = ImageOps.grayscale(img)
        img = ImageOps.colorize(g, (20, 10, 0), (255, 240, 192))
    
    if d.get("gaussian"):
        radius = float(d.get("gaussian_radius", 1.5))
        img = img.filter(ImageFilter.GaussianBlur(radius))
    
    if d.get("median"):
        size = int(d.get("median_size", 3))
        if size % 2 == 0:
            size += 1  # Must be odd
        img = img.filter(ImageFilter.MedianFilter(size=size))
    
    if d.get("sharpen"):
        img = img.filter(ImageFilter.UnsharpMask(radius=2.0, percent=150, threshold=3))
    
    if d.get("edge"):
        img = img.filter(ImageFilter.FIND_EDGES)
    
    if d.get("emboss"):
        img = img.filter(ImageFilter.EMBOSS)
    
    if d.get("contour"):
        img = img.filter(ImageFilter.CONTOUR)
    
    if d.get("smooth"):
        img = img.filter(ImageFilter.SMOOTH_MORE)
    
    if d.get("detail"):
        img = img.filter(ImageFilter.DETAIL)
    
    posterize_bits = int(d.get("posterize", 0))
    if posterize_bits > 0:
        bits = max(1, min(8, posterize_bits))
        img = ImageOps.posterize(img, bits)
    
    pixelate_size = int(d.get("pixelate", 1))
    if pixelate_size > 1:
        small = img.resize(
            (max(1, img.width // pixelate_size), max(1, img.height // pixelate_size)),
            Resampling.NEAREST
        )
        img = small.resize(img.size, Resampling.NEAREST)
    
    solarize_threshold = int(d.get("solarize", 0))
    if solarize_threshold > 0:
        img = ImageOps.solarize(img, threshold=solarize_threshold)
    
    # Restore alpha if present
    if alpha is not None:
        img = img.convert("RGBA")
        img.putalpha(alpha)
    
    return img

def apply_adjust(img: Image.Image, b: float, c: float, s: float, g: float, 
                 hue: float = 0.0, temperature: float = 0.0):
    """Apply brightness, contrast, saturation, gamma, hue, and temperature adjustments."""
    original_mode = img.mode
    alpha = None
    
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")
    
    # Basic adjustments
    if abs(b - 1) > 1e-3:
        img = ImageEnhance.Brightness(img).enhance(b)
    
    if abs(c - 1) > 1e-3:
        img = ImageEnhance.Contrast(img).enhance(c)
    
    if abs(s - 1) > 1e-3:
        img = ImageEnhance.Color(img).enhance(s)
    
    # Gamma correction
    if abs(g - 1) > 1e-3:
        lut = [min(255, int((i / 255.0) ** (1.0 / g) * 255 + 0.5)) for i in range(256)]
        img = img.point(lut * 3)
    
    # Hue shift (vectorized)
    if abs(hue) > 1e-3:
        arr = np.array(img, dtype=np.float32) / 255.0
        hsv = _rgb_to_hsv(arr)
        hsv[:, :, 0] = (hsv[:, :, 0] + hue / 360.0) % 1.0
        arr = _hsv_to_rgb(hsv)
        img = Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8))
    
    # Temperature adjustment (warm/cool)
    if abs(temperature) > 1e-3:
        arr = np.array(img, dtype=np.float32)
        # Warm: increase red, decrease blue
        # Cool: decrease red, increase blue
        temp_factor = temperature / 100.0
        arr[:, :, 0] = np.clip(arr[:, :, 0] + temp_factor * 30, 0, 255)  # Red
        arr[:, :, 2] = np.clip(arr[:, :, 2] - temp_factor * 30, 0, 255)  # Blue
        img = Image.fromarray(arr.astype(np.uint8))
    
    # Restore alpha
    if alpha is not None:
        img = img.convert("RGBA")
        img.putalpha(alpha)
    
    return img

def hist_equalize(img: Image.Image):
    """Apply histogram equalization preserving color via YCbCr."""
    alpha = None
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        img = img.convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    ycbcr = img.convert("YCbCr")
    y, cb, cr = ycbcr.split()
    y = ImageOps.equalize(y)
    result = Image.merge("YCbCr", (y, cb, cr)).convert("RGB")

    if alpha is not None:
        result = result.convert("RGBA")
        result.putalpha(alpha)
    return result

def remove_background(img: Image.Image, tol: float):
    """Remove solid background using border color sampling."""
    arr = np.array(img.convert("RGBA"))
    
    # Sample border pixels
    top = arr[0, :, :3]
    bottom = arr[-1, :, :3]
    left = arr[:, 0, :3]
    right = arr[:, -1, :3]
    border = np.concatenate([top, bottom, left, right], axis=0)
    
    # Calculate mean background color
    bg = border.mean(axis=0)
    
    # Calculate distance from background
    rgb = arr[:, :, :3].astype(np.float32)
    dist = np.linalg.norm(rgb - bg, axis=2)
    
    # Apply threshold
    threshold = (tol / 100.0) * 255.0 * 1.5
    alpha = arr[:, :, 3].astype(np.float32)
    alpha[dist < threshold] = 0
    
    # Create output
    out = np.dstack([rgb.astype(np.uint8), alpha.astype(np.uint8)])
    return Image.fromarray(out, "RGBA")

def auto_enhance(img: Image.Image):
    """Automatically enhance image (auto-contrast, auto-color)."""
    if img.mode == "RGBA":
        alpha = img.split()[-1]
        img = img.convert("RGB")
        img = ImageOps.autocontrast(img, cutoff=1)
        img = img.convert("RGBA")
        img.putalpha(alpha)
    else:
        img = img.convert("RGB")
        img = ImageOps.autocontrast(img, cutoff=1)
    return img

def vignette_img(img: Image.Image, strength: float = 0.5):
    """Add vignette effect to image."""
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    
    w, h = img.size
    arr = np.array(img, dtype=np.float32)
    
    # Create radial gradient
    y, x = np.ogrid[:h, :w]
    cx, cy = w / 2, h / 2
    r = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    r_max = np.sqrt(cx ** 2 + cy ** 2)
    r_norm = r / r_max
    
    # Apply vignette
    vignette = 1 - (r_norm ** 2) * strength
    vignette = np.clip(vignette, 0, 1)
    
    arr[:, :, :3] = arr[:, :, :3] * vignette[:, :, np.newaxis]
    
    return Image.fromarray(arr.astype(np.uint8), "RGBA")

def add_border(img: Image.Image, size: int, color: str):
    """Add a border to the image."""
    # Parse hex color
    color = color.lstrip("#")
    if len(color) == 6:
        rgb = tuple(int(color[i:i+2], 16) for i in (0, 2, 4))
    else:
        rgb = (0, 0, 0)
    
    if img.mode == "RGBA":
        rgb = rgb + (255,)
    
    return ImageOps.expand(img, border=size, fill=rgb)

def add_watermark(img: Image.Image, text: str, position: str = "bottom-right", 
                  opacity: float = 0.5, color: str = "#ffffff"):
    """Add text watermark to image."""
    if not text:
        return img
    
    # Convert to RGBA for transparency
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    
    # Create transparent overlay
    overlay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    
    # Parse color
    color_hex = color.lstrip("#")
    if len(color_hex) == 6:
        rgb = tuple(int(color_hex[i:i+2], 16) for i in (0, 2, 4))
    else:
        rgb = (255, 255, 255)
    
    # Add alpha to color
    alpha = int(opacity * 255)
    rgba = rgb + (alpha,)
    
    # Try to get a font
    font_size = max(12, min(img.width, img.height) // 20)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", font_size)
    except Exception:
        try:
            font = ImageFont.truetype("arial.ttf", font_size)
        except Exception:
            font = ImageFont.load_default()
    
    # Get text size
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    # Calculate position
    padding = 20
    positions = {
        "top-left": (padding, padding),
        "top-right": (img.width - text_w - padding, padding),
        "bottom-left": (padding, img.height - text_h - padding),
        "bottom-right": (img.width - text_w - padding, img.height - text_h - padding),
        "center": ((img.width - text_w) // 2, (img.height - text_h) // 2),
    }
    
    pos = positions.get(position, positions["bottom-right"])
    
    # Draw text
    draw.text(pos, text, font=font, fill=rgba)
    
    # Composite
    return Image.alpha_composite(img, overlay)
