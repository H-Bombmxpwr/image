import os
from xml.sax.saxutils import escape

W, H = 128, 128
BG  = (14, 18, 28)       # dark background
FG  = (124, 92, 255)     # brand purple
INK = (230, 237, 243)    # ink

def rgb(c):
    return f"rgb({c[0]},{c[1]},{c[2]})"

# Geometry to match your Pillow version
pad = 16
stroke_w = 6
r = 20

# In Pillow, the outline stroke is centered on the rect edge.
# SVG behaves the same, so keep identical box coords.
x0, y0 = pad, pad
x1, y1 = W - pad, H - pad
rect_w = x1 - x0
rect_h = y1 - y0

text = "IL"

# Choose a font stack similar to your Pillow tries.
# (SVG viewers will pick the first available.)
font_family = "Arial, 'DejaVu Sans', 'Helvetica Neue', Helvetica, sans-serif"
font_size = 64
font_weight = 700  # bold-ish

svg = f"""<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <rect x="0" y="0" width="{W}" height="{H}" fill="{rgb(BG)}"/>

  <rect x="{x0}" y="{y0}" width="{rect_w}" height="{rect_h}"
        rx="{r}" ry="{r}"
        fill="none"
        stroke="{rgb(FG)}"
        stroke-width="{stroke_w}"/>

  <text x="{W/2}" y="{H/2}"
        fill="{rgb(INK)}"
        font-family="{escape(font_family)}"
        font-size="{font_size}"
        font-weight="{font_weight}"
        text-anchor="middle"
        dominant-baseline="central">{escape(text)}</text>
</svg>
"""

out_path = "static/images/icon.svg"
os.makedirs(os.path.dirname(out_path), exist_ok=True)
with open(out_path, "w", encoding="utf-8") as f:
    f.write(svg)

print(f"Wrote {out_path}")
