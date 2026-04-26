"""GIF manipulation operations."""
import base64
import io
import zipfile
from PIL import Image

HAS_GIF = True


def _b64_to_gif(data_url: str) -> Image.Image:
    """Convert a base64 data URL to a PIL GIF image."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    return Image.open(io.BytesIO(raw))


def _collect_frames(img: Image.Image):
    frames = []
    durations = []
    try:
        frame_total = getattr(img, "n_frames", 1)
        for index in range(frame_total):
            img.seek(index)
            frames.append(img.copy().convert("RGBA"))
            durations.append(img.info.get("duration", 100))
    except EOFError:
        pass
    return frames, durations


def _gif_to_b64(frames: list, durations: list, loop: int = 0, colors: int = 256) -> str:
    """Convert a list of RGBA frames to a GIF data URL."""
    buf = io.BytesIO()
    palette_frames = []
    palette_size = max(16, min(256, int(colors)))

    for frame in frames:
        palette_frames.append(frame.convert("P", palette=Image.ADAPTIVE, colors=palette_size))

    palette_frames[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=palette_frames[1:] if len(palette_frames) > 1 else [],
        duration=durations,
        loop=loop,
        optimize=True,
        disposal=2,
    )

    return "data:image/gif;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def gif_info(data_url: str) -> dict:
    """Return basic animation info for a GIF."""
    img = _b64_to_gif(data_url)
    frame_count = getattr(img, "n_frames", 1)
    durations = []
    try:
        for index in range(frame_count):
            img.seek(index)
            durations.append(img.info.get("duration", 100))
    except EOFError:
        pass

    return {
        "frame_count": frame_count,
        "loop": img.info.get("loop", 0),
        "duration_ms_total": sum(durations),
    }


def extract_gif_frames(data_url: str, max_frames: int = 0) -> list:
    """Extract frames from a GIF as PNG data URLs."""
    img = _b64_to_gif(data_url)
    frames = []
    try:
        frame_count = getattr(img, "n_frames", 1)
        limit = min(frame_count, max_frames) if max_frames > 0 else frame_count
        for index in range(limit):
            img.seek(index)
            frame = img.copy().convert("RGBA")
            buf = io.BytesIO()
            frame.save(buf, format="PNG")
            frames.append("data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii"))
    except EOFError:
        pass
    return frames


def resize_gif(data_url: str, width: int, height: int, keep_aspect: bool = True) -> str:
    """Resize a GIF while preserving animation."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if not frames:
        return data_url

    output = []
    for frame in frames:
        orig_w, orig_h = frame.size
        if keep_aspect:
            if width and not height:
                ratio = width / orig_w
            elif height and not width:
                ratio = height / orig_h
            else:
                ratio = min(width / orig_w, height / orig_h)
            target_w = max(1, int(orig_w * ratio))
            target_h = max(1, int(orig_h * ratio))
        else:
            target_w = max(1, width)
            target_h = max(1, height)
        output.append(frame.resize((target_w, target_h), Image.Resampling.LANCZOS))

    return _gif_to_b64(output, durations, img.info.get("loop", 0))


def trim_gif(data_url: str, start_frame: int, end_frame: int) -> str:
    """Trim a GIF to a specific frame range."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if len(frames) <= 1:
        return data_url

    total = len(frames)
    if end_frame < 0:
        end_frame = total + end_frame + 1
    start_frame = max(0, min(start_frame, total - 1))
    end_frame = max(start_frame + 1, min(end_frame, total))

    return _gif_to_b64(frames[start_frame:end_frame], durations[start_frame:end_frame], img.info.get("loop", 0))


def change_gif_speed(data_url: str, speed_factor: float) -> str:
    """Change GIF playback speed (2.0 = 2x faster, 0.5 = half speed)."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if len(frames) <= 1:
        return data_url

    adjusted = [max(10, int(duration / max(0.05, speed_factor))) for duration in durations]
    return _gif_to_b64(frames, adjusted, img.info.get("loop", 0))


def reverse_gif(data_url: str) -> str:
    """Reverse GIF playback order."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if len(frames) <= 1:
        return data_url

    frames.reverse()
    durations.reverse()
    return _gif_to_b64(frames, durations, img.info.get("loop", 0))


def pingpong_gif(data_url: str) -> str:
    """Append the reverse frames to create a ping-pong animation."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if len(frames) <= 1:
        return data_url

    tail_frames = frames[-2:0:-1]
    tail_durations = durations[-2:0:-1]
    return _gif_to_b64(frames + tail_frames, durations + tail_durations, img.info.get("loop", 0))


def optimize_gif(data_url: str, colors: int = 128, frame_step: int = 1) -> str:
    """Reduce GIF size by shrinking palette and optionally skipping frames."""
    img = _b64_to_gif(data_url)
    frames, durations = _collect_frames(img)
    if not frames:
        return data_url

    step = max(1, int(frame_step))
    if step > 1:
        reduced_frames = []
        reduced_durations = []
        for index in range(0, len(frames), step):
            reduced_frames.append(frames[index])
            reduced_durations.append(sum(durations[index:index + step]))
        frames = reduced_frames
        durations = reduced_durations

    return _gif_to_b64(frames, durations, img.info.get("loop", 0), colors=colors)


def poster_frame(data_url: str, frame: int = 0) -> str:
    """Export a single frame from a GIF as a PNG data URL."""
    img = _b64_to_gif(data_url)
    frame_total = getattr(img, "n_frames", 1)
    frame = max(0, min(int(frame), frame_total - 1))
    img.seek(frame)
    frame_img = img.copy().convert("RGBA")
    buf = io.BytesIO()
    frame_img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def gif_to_frames_zip(data_url: str) -> bytes:
    """Export all GIF frames as a ZIP file of PNGs."""
    img = _b64_to_gif(data_url)
    frames, _ = _collect_frames(img)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as archive:
        for index, frame in enumerate(frames):
            frame_buf = io.BytesIO()
            frame.save(frame_buf, format="PNG")
            archive.writestr(f"frame_{index:04d}.png", frame_buf.getvalue())
    return buf.getvalue()
