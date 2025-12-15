import base64
import io
from PIL import Image, ImageStat, ExifTags
from PIL.ExifTags import TAGS, GPSTAGS
from .compat import Resampling

ALLOWED_EXPORT = {
    "jpeg": ("JPEG", "image/jpeg"),
    "jpg":  ("JPEG", "image/jpeg"),
    "png":  ("PNG",  "image/png"),
    "webp": ("WEBP", "image/webp"),
    "bmp":  ("BMP",  "image/bmp"),
    "tiff": ("TIFF", "image/tiff"),
    "gif":  ("GIF",  "image/gif"),
}

def b64_to_image(data_url: str) -> Image.Image:
    """Convert a base64 data URL to a PIL Image."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    return img

def image_to_dataurl(img: Image.Image, fmt="PNG", quality=92) -> str:
    """Convert a PIL Image to a base64 data URL."""
    buf = io.BytesIO()
    save_kwargs = {}
    
    if fmt.upper() == "JPEG":
        if img.mode in ("RGBA", "LA", "P"):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode == "P":
                img = img.convert("RGBA")
            if img.mode in ("RGBA", "LA"):
                bg.paste(img, mask=img.split()[-1])
            else:
                bg.paste(img)
            img = bg
        elif img.mode != "RGB":
            img = img.convert("RGB")
        save_kwargs["quality"] = int(quality)
        save_kwargs["optimize"] = True
        
    elif fmt.upper() == "WEBP":
        save_kwargs["quality"] = int(quality)
        
    elif fmt.upper() == "PNG":
        save_kwargs["optimize"] = True
        
    elif fmt.upper() == "GIF":
        if img.mode not in ("P", "L"):
            img = img.convert("P", palette=Image.ADAPTIVE, colors=256)
    
    img.save(buf, format=fmt, **save_kwargs)
    mime = next((m for k, (f, m) in ALLOWED_EXPORT.items() if f == fmt.upper()), "image/png")
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")

def exif_to_dict(img: Image.Image) -> dict:
    """Extract EXIF metadata from an image into a readable dictionary."""
    result = {}
    
    try:
        exif = img.getexif()
        if not exif:
            return {}
        
        # Process standard EXIF tags
        for tag_id, value in exif.items():
            tag_name = TAGS.get(tag_id, str(tag_id))
            
            # Handle bytes
            if isinstance(value, bytes):
                try:
                    value = value.decode(errors="ignore")
                except Exception:
                    value = f"<binary: {len(value)} bytes>"
            
            # Handle tuples (like GPS coordinates)
            if isinstance(value, tuple):
                value = ", ".join(str(v) for v in value)
            
            result[tag_name] = value
        
        # Process IFD (Image File Directory) data
        for ifd_id in ExifTags.IFD:
            try:
                ifd = exif.get_ifd(ifd_id)
                if ifd:
                    ifd_name = ifd_id.name
                    for tag_id, value in ifd.items():
                        if ifd_id == ExifTags.IFD.GPSInfo:
                            tag_name = GPSTAGS.get(tag_id, str(tag_id))
                        else:
                            tag_name = TAGS.get(tag_id, str(tag_id))
                        
                        if isinstance(value, bytes):
                            try:
                                value = value.decode(errors="ignore")
                            except Exception:
                                value = f"<binary: {len(value)} bytes>"
                        
                        result[f"{ifd_name}:{tag_name}"] = value
            except Exception:
                continue
        
        # Format GPS coordinates if available
        if "GPSInfo:GPSLatitude" in result and "GPSInfo:GPSLongitude" in result:
            try:
                lat = result.get("GPSInfo:GPSLatitude")
                lon = result.get("GPSInfo:GPSLongitude")
                lat_ref = result.get("GPSInfo:GPSLatitudeRef", "N")
                lon_ref = result.get("GPSInfo:GPSLongitudeRef", "E")
                
                if lat and lon:
                    result["GPS_Coordinates"] = f"{lat} {lat_ref}, {lon} {lon_ref}"
            except Exception:
                pass
        
        return result
        
    except Exception as e:
        return {"error": str(e)}

def write_exif(img: Image.Image, metadata: dict) -> Image.Image:
    """Write EXIF metadata to an image."""
    try:
        from PIL.ExifTags import Base
        
        # Create new EXIF data
        exif = img.getexif()
        
        # Map common metadata names to EXIF tags
        tag_mapping = {
            "artist": Base.Artist,
            "copyright": Base.Copyright,
            "description": Base.ImageDescription,
            "software": Base.Software,
            "datetime": Base.DateTime,
            "make": Base.Make,
            "model": Base.Model,
        }
        
        for key, value in metadata.items():
            key_lower = key.lower()
            if key_lower in tag_mapping:
                exif[tag_mapping[key_lower]] = str(value)
        
        # Save with new EXIF
        buf = io.BytesIO()
        img.save(buf, format=img.format or "PNG", exif=exif)
        buf.seek(0)
        return Image.open(buf)
        
    except Exception:
        return img

def stats_for(img: Image.Image) -> dict:
    """Get statistics for an image."""
    fmt = (img.format or "").upper()
    mode = img.mode
    w, h = img.size
    
    # Handle different image modes for stats
    if mode in ("RGBA", "RGB", "L", "LA"):
        stat_img = img.convert("RGB") if mode != "RGB" else img
        stat = ImageStat.Stat(stat_img)
        mean = tuple(int(x) for x in stat.mean)
    else:
        try:
            stat_img = img.convert("RGB")
            stat = ImageStat.Stat(stat_img)
            mean = tuple(int(x) for x in stat.mean)
        except Exception:
            mean = (0, 0, 0)
    
    # Check if animated
    is_animated = getattr(img, "is_animated", False)
    n_frames = getattr(img, "n_frames", 1)
    
    return {
        "format": fmt,
        "mode": mode,
        "width": w,
        "height": h,
        "mean_rgb": mean,
        "is_animated": is_animated,
        "frame_count": n_frames
    }

def dataurl_bytes(data_url: str) -> int:
    """Calculate the byte size of a base64 data URL."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    pad = data_url.count("=")
    return (len(data_url) * 3) // 4 - pad

def fmt_size(num_bytes: int) -> str:
    """Format byte size as human-readable string."""
    units = ["B", "KB", "MB", "GB"]
    s = float(num_bytes)
    for u in units:
        if s < 1024 or u == "GB":
            return f"{s:.1f} {u}"
        s /= 1024
    return f"{s:.1f} GB"

def resample_from_name(name: str):
    """Get PIL resampling mode from string name."""
    name = (name or "").lower()
    return {
        "nearest": Resampling.NEAREST,
        "bilinear": Resampling.BILINEAR,
        "bicubic": Resampling.BICUBIC,
        "lanczos": Resampling.LANCZOS,
    }.get(name, Resampling.LANCZOS)
