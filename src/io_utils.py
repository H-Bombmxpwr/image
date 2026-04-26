import base64
import io
import json
from PIL import Image, ImageStat, ExifTags, PngImagePlugin
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

EXIF_TEXT_TAGS = {
    "title": 270,
    "description": 270,
    "make": 271,
    "model": 272,
    "software": 305,
    "datetime": 306,
    "artist": 315,
    "copyright": 33432,
    "comment": 37510,
}


def b64_to_image(data_url: str) -> Image.Image:
    """Convert a base64 data URL to a PIL Image."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    img.load()
    return img


def normalize_metadata(metadata: dict | None) -> dict:
    """Coerce metadata values to simple export-friendly strings."""
    clean = {}
    for key, value in (metadata or {}).items():
        if value is None:
            continue
        if isinstance(value, (dict, list, tuple)):
            clean[str(key)] = json.dumps(value, ensure_ascii=True)
        else:
            clean[str(key)] = str(value)
    return clean


def _json_safe(value):
    """Convert metadata values into JSON-safe primitives."""
    if value is None or isinstance(value, (bool, int, float, str)):
        return value

    if isinstance(value, bytes):
        try:
            return value.decode(errors="ignore")
        except Exception:
            return f"<binary: {len(value)} bytes>"

    if isinstance(value, tuple):
        return [_json_safe(item) for item in value]

    if isinstance(value, list):
        return [_json_safe(item) for item in value]

    if isinstance(value, dict):
        safe = {}
        for key, item in value.items():
            safe[str(key)] = _json_safe(item)
        return safe

    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


def _prepare_exif(img: Image.Image, metadata: dict) -> bytes | None:
    metadata = normalize_metadata(metadata)
    if not metadata:
      return None

    exif = img.getexif()
    for key, value in metadata.items():
        tag = EXIF_TEXT_TAGS.get(key.lower())
        if tag is None:
            continue
        exif[tag] = value

    extra = {k: v for k, v in metadata.items() if k.lower() not in EXIF_TEXT_TAGS}
    if extra:
        payload = json.dumps(extra, ensure_ascii=True)
        exif[37510] = payload
        if 270 not in exif:
            exif[270] = payload

    try:
        return exif.tobytes()
    except Exception:
        return None


def _prepare_pnginfo(metadata: dict) -> PngImagePlugin.PngInfo | None:
    metadata = normalize_metadata(metadata)
    if not metadata:
        return None

    pnginfo = PngImagePlugin.PngInfo()
    for key, value in metadata.items():
        pnginfo.add_text(key, value)
    return pnginfo


def _save_with_metadata(img: Image.Image, buf: io.BytesIO, fmt: str, quality: int, metadata: dict | None = None):
    save_kwargs = {}
    fmt_upper = fmt.upper()
    metadata = normalize_metadata(metadata)

    if fmt_upper == "JPEG":
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

    elif fmt_upper == "WEBP":
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if "A" in img.mode else "RGB")
        save_kwargs["quality"] = int(quality)
        save_kwargs["method"] = 6

    elif fmt_upper == "PNG":
        save_kwargs["optimize"] = True
        pnginfo = _prepare_pnginfo(metadata)
        if pnginfo:
            save_kwargs["pnginfo"] = pnginfo

    elif fmt_upper == "GIF":
        if img.mode not in ("P", "L"):
            img = img.convert("P", palette=Image.ADAPTIVE, colors=256)
        if metadata.get("comment"):
            save_kwargs["comment"] = metadata["comment"].encode("utf-8", errors="ignore")

    if fmt_upper in {"JPEG", "WEBP", "TIFF"}:
        exif_bytes = _prepare_exif(img, metadata)
        if exif_bytes:
            save_kwargs["exif"] = exif_bytes

    img.save(buf, format=fmt, **save_kwargs)


def image_to_dataurl(img: Image.Image, fmt="PNG", quality=92) -> str:
    """Convert a PIL Image to a base64 data URL."""
    buf = io.BytesIO()
    _save_with_metadata(img, buf, fmt, quality)
    mime = next((m for _, (f, m) in ALLOWED_EXPORT.items() if f == fmt.upper()), "image/png")
    return f"data:{mime};base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def exif_to_dict(img: Image.Image) -> dict:
    """Extract EXIF and embedded textual metadata into a readable dictionary."""
    result = {}

    try:
        exif = img.getexif()
        if exif:
            for tag_id, value in exif.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                result[tag_name] = _json_safe(value)

            for ifd_id in ExifTags.IFD:
                try:
                    ifd = exif.get_ifd(ifd_id)
                    if not ifd:
                        continue
                    ifd_name = ifd_id.name
                    for tag_id, value in ifd.items():
                        tag_name = GPSTAGS.get(tag_id, str(tag_id)) if ifd_id == ExifTags.IFD.GPSInfo else TAGS.get(tag_id, str(tag_id))
                        result[f"{ifd_name}:{tag_name}"] = _json_safe(value)
                except Exception:
                    continue

        for key, value in getattr(img, "info", {}).items():
            if key in {"exif", "icc_profile"}:
                continue
            result[f"info:{key}"] = _json_safe(value)

        return result
    except Exception as exc:
        return {"error": str(exc)}


def write_exif(img: Image.Image, metadata: dict) -> Image.Image:
    """Bake supported metadata into an image and re-open it."""
    try:
        buf = io.BytesIO()
        fmt = (img.format or "PNG").upper()
        _save_with_metadata(img, buf, fmt, 92, metadata)
        buf.seek(0)
        out = Image.open(buf)
        out.load()
        return out
    except Exception:
        return img


def stats_for(img: Image.Image) -> dict:
    """Get statistics for an image."""
    fmt = (img.format or "").upper()
    mode = img.mode
    width, height = img.size

    try:
        stat_img = img.convert("RGB")
        stat = ImageStat.Stat(stat_img)
        mean = tuple(int(x) for x in stat.mean)
    except Exception:
        mean = (0, 0, 0)

    return {
        "format": fmt,
        "mode": mode,
        "width": width,
        "height": height,
        "mean_rgb": mean,
        "is_animated": getattr(img, "is_animated", False),
        "frame_count": getattr(img, "n_frames", 1),
        "loop": getattr(img, "info", {}).get("loop"),
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
    size = float(num_bytes)
    for unit in units:
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} GB"


def resample_from_name(name: str):
    """Get PIL resampling mode from string name."""
    name = (name or "").lower()
    return {
        "nearest": Resampling.NEAREST,
        "bilinear": Resampling.BILINEAR,
        "bicubic": Resampling.BICUBIC,
        "lanczos": Resampling.LANCZOS,
    }.get(name, Resampling.LANCZOS)
