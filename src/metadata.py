# src/metadata.py
from PIL import Image, ExifTags
import piexif

def _sanitize(o):
    # make everything JSON-serializable
    if isinstance(o, bytes):
        try:
            return o.decode("utf-8", "ignore")
        except Exception:
            return o.hex()
    if isinstance(o, (list, tuple)):
        return [_sanitize(x) for x in o]
    if isinstance(o, dict):
        return {str(_sanitize(k)): _sanitize(v) for k, v in o.items()}
    # PIL "IFDRational"
    if hasattr(o, "numerator") and hasattr(o, "denominator"):
        try:
            return f"{o.numerator}/{o.denominator}"
        except Exception:
            return float(o)  # best-effort
    return o

def read_metadata(img: Image.Image) -> dict:
    out = {}
    # EXIF
    try:
        exif = img.getexif()
        if exif:
            for tag_id, val in exif.items():
                tag = ExifTags.TAGS.get(tag_id, str(tag_id))
                out[tag] = _sanitize(val)
    except Exception:
        pass
    # carry over a few useful info keys (e.g., PNG tEXt chunks)
    try:
        if img.info:
            for k, v in img.info.items():
                if isinstance(v, (str, bytes)):
                    out[f"INFO:{k}"] = _sanitize(v)
    except Exception:
        pass
    return out

def write_metadata(img: Image.Image, updates: dict):
    """
    Returns (img_copy, merged_dict, exif_bytes)
    - merged_dict is JSON-safe
    - exif_bytes can be passed to Pillow's save
    """
    img2 = img.copy()
    merged = read_metadata(img2)
    # merge shallow updates into our JSON-safe dict
    for k, v in (updates or {}).items():
        if v is None:
            merged.pop(k, None)
        else:
            merged[str(k)] = v

    # Try to rebuild EXIF using piexif for JPEG/TIFF/WEBP/HEIF
    exif_bytes = None
    try:
        fmt = (img2.format or "PNG").upper()
        if fmt in ("JPEG", "TIFF", "WEBP", "HEIF"):
            # map friendly keys back to numeric tags where possible
            reverse = {v: k for k, v in ExifTags.TAGS.items()}
            zeroth = {}
            for k, v in merged.items():
                if k in reverse:
                    val = v
                    if isinstance(val, (list, dict)):
                        val = str(val)
                    zeroth[reverse[k]] = val
            exif_bytes = piexif.dump({
                "0th": zeroth, "Exif": {}, "GPS": {}, "1st": {}, "thumbnail": None
            })
    except Exception:
        # keep original EXIF if any
        exif_bytes = img.info.get("exif", None)

    if exif_bytes is None:
        # if we couldn't rebuild, at least preserve original
        exif_bytes = img.info.get("exif", None)

    return img2, merged, exif_bytes
