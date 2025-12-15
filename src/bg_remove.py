"""AI-powered background removal using rembg."""
from PIL import Image
import io

HAS_REMBG = False
try:
    from rembg import remove
    HAS_REMBG = True
except ImportError:
    pass

def remove_bg_ai(img: Image.Image) -> Image.Image:
    """Remove background using AI (rembg library)."""
    if not HAS_REMBG:
        raise RuntimeError("rembg not installed")
    
    # Ensure image is in a compatible format
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")
    
    # Convert to bytes for rembg
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    
    # Remove background
    output = remove(buf.getvalue())
    
    # Convert back to PIL Image
    result = Image.open(io.BytesIO(output))
    result.load()
    
    return result
