"""GIF manipulation operations."""
import base64
import io
from PIL import Image

HAS_GIF = True

def _b64_to_gif(data_url: str) -> Image.Image:
    """Convert base64 data URL to PIL Image (GIF)."""
    if "," in data_url:
        data_url = data_url.split(",", 1)[1]
    raw = base64.b64decode(data_url)
    img = Image.open(io.BytesIO(raw))
    return img

def _gif_to_b64(frames: list, durations: list, loop: int = 0) -> str:
    """Convert list of frames to base64 GIF data URL."""
    buf = io.BytesIO()
    
    # Convert frames to palette mode
    palette_frames = []
    for frame in frames:
        if frame.mode != "P":
            p_frame = frame.convert("P", palette=Image.ADAPTIVE, colors=256)
        else:
            p_frame = frame
        palette_frames.append(p_frame)
    
    # Save as animated GIF
    palette_frames[0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=palette_frames[1:] if len(palette_frames) > 1 else [],
        duration=durations,
        loop=loop,
        optimize=True
    )
    
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/gif;base64,{b64}"

def extract_gif_frames(data_url: str, max_frames: int = 0) -> list:
    """Extract frames from a GIF as base64 data URLs.

    If max_frames > 0, only extract up to that many frames.
    """
    img = _b64_to_gif(data_url)
    frames = []

    try:
        n_frames = getattr(img, "n_frames", 1)
        limit = min(n_frames, max_frames) if max_frames > 0 else n_frames
        for i in range(limit):
            img.seek(i)
            frame = img.copy().convert("RGBA")

            buf = io.BytesIO()
            frame.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            frames.append(f"data:image/png;base64,{b64}")
    except EOFError:
        pass

    return frames

def resize_gif(data_url: str, width: int, height: int, keep_aspect: bool = True) -> str:
    """Resize a GIF while preserving animation."""
    img = _b64_to_gif(data_url)
    
    if not hasattr(img, "n_frames") or img.n_frames <= 1:
        # Single frame, just resize
        if keep_aspect:
            img.thumbnail((width, height), Image.Resampling.LANCZOS)
            new_img = img
        else:
            new_img = img.resize((width, height), Image.Resampling.LANCZOS)
        
        buf = io.BytesIO()
        new_img.save(buf, format="GIF")
        b64 = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/gif;base64,{b64}"
    
    frames = []
    durations = []
    
    try:
        for i in range(img.n_frames):
            img.seek(i)
            frame = img.copy().convert("RGBA")
            
            # Get frame duration
            duration = img.info.get("duration", 100)
            durations.append(duration)
            
            # Resize frame
            if keep_aspect:
                # Calculate new size maintaining aspect ratio
                orig_w, orig_h = frame.size
                ratio = min(width / orig_w, height / orig_h) if width > 0 and height > 0 else 1
                if width > 0 and height == 0:
                    ratio = width / orig_w
                elif height > 0 and width == 0:
                    ratio = height / orig_h
                new_w = int(orig_w * ratio)
                new_h = int(orig_h * ratio)
                frame = frame.resize((new_w, new_h), Image.Resampling.LANCZOS)
            else:
                frame = frame.resize((width, height), Image.Resampling.LANCZOS)
            
            frames.append(frame)
    except EOFError:
        pass
    
    if not frames:
        return data_url
    
    return _gif_to_b64(frames, durations, img.info.get("loop", 0))

def trim_gif(data_url: str, start_frame: int, end_frame: int) -> str:
    """Trim a GIF to a specific frame range."""
    img = _b64_to_gif(data_url)
    
    if not hasattr(img, "n_frames") or img.n_frames <= 1:
        return data_url
    
    n_frames = img.n_frames
    
    # Handle negative indices
    if end_frame < 0:
        end_frame = n_frames + end_frame + 1
    
    # Clamp values
    start_frame = max(0, min(start_frame, n_frames - 1))
    end_frame = max(start_frame + 1, min(end_frame, n_frames))
    
    frames = []
    durations = []
    
    try:
        for i in range(start_frame, end_frame):
            img.seek(i)
            frame = img.copy().convert("RGBA")
            duration = img.info.get("duration", 100)
            frames.append(frame)
            durations.append(duration)
    except EOFError:
        pass
    
    if not frames:
        return data_url
    
    return _gif_to_b64(frames, durations, img.info.get("loop", 0))

def change_gif_speed(data_url: str, speed_factor: float) -> str:
    """Change GIF playback speed (2.0 = 2x faster, 0.5 = half speed)."""
    img = _b64_to_gif(data_url)
    
    if not hasattr(img, "n_frames") or img.n_frames <= 1:
        return data_url
    
    frames = []
    durations = []
    
    try:
        for i in range(img.n_frames):
            img.seek(i)
            frame = img.copy().convert("RGBA")
            duration = img.info.get("duration", 100)
            
            # Adjust duration
            new_duration = max(10, int(duration / speed_factor))
            
            frames.append(frame)
            durations.append(new_duration)
    except EOFError:
        pass
    
    if not frames:
        return data_url
    
    return _gif_to_b64(frames, durations, img.info.get("loop", 0))

def reverse_gif(data_url: str) -> str:
    """Reverse GIF playback order."""
    img = _b64_to_gif(data_url)
    
    if not hasattr(img, "n_frames") or img.n_frames <= 1:
        return data_url
    
    frames = []
    durations = []
    
    try:
        for i in range(img.n_frames):
            img.seek(i)
            frame = img.copy().convert("RGBA")
            duration = img.info.get("duration", 100)
            frames.append(frame)
            durations.append(duration)
    except EOFError:
        pass
    
    if not frames:
        return data_url
    
    # Reverse both frames and durations
    frames.reverse()
    durations.reverse()
    
    return _gif_to_b64(frames, durations, img.info.get("loop", 0))

def gif_to_frames_zip(data_url: str) -> bytes:
    """Export all GIF frames as a ZIP file of PNGs."""
    import zipfile
    
    img = _b64_to_gif(data_url)
    
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        try:
            n_frames = getattr(img, "n_frames", 1)
            for i in range(n_frames):
                img.seek(i)
                frame = img.copy().convert("RGBA")
                
                frame_buf = io.BytesIO()
                frame.save(frame_buf, format="PNG")
                zf.writestr(f"frame_{i:04d}.png", frame_buf.getvalue())
        except EOFError:
            pass
    
    return buf.getvalue()
