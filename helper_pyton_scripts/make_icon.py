from PIL import Image, ImageDraw, ImageFont

W, H = 128, 128
BG  = (14, 18, 28, 255)      # dark background
FG  = (124, 92, 255, 255)    # brand purple
INK = (230, 237, 243, 255)   # ink

im = Image.new("RGBA", (W, H), BG)
d  = ImageDraw.Draw(im)

# Rounded rectangle accent
r = 20
d.rounded_rectangle([16, 16, W-16, H-16], r, outline=FG, width=6)

# Load a font
def load_font():
    # Try a few common fonts; fall back to default
    for name, size in [("arial.ttf", 64), ("DejaVuSans-Bold.ttf", 64)]:
        try:
            return ImageFont.truetype(name, size)
        except Exception:
            pass
    return ImageFont.load_default()

font = load_font()
text = "IL"

# Measure text: textbbox is the modern, cross-version way
try:
    bbox = d.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
except Exception:
    # Fallback if textbbox is unavailable (very old Pillow)
    tw, th = d.textlength(text, font=font), font.size

# Center it
x = (W - tw) // 2
y = (H - th) // 2 - 2

d.text((x, y), text, fill=INK, font=font)

out_path = "static/images/icon.png"
im.save(out_path, "PNG")
print(f"Wrote {out_path}")
