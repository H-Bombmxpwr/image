from PIL import Image

try:
    Resampling = Image.Resampling
except AttributeError:
    # Older PIL versions
    class Resampling:
        NEAREST = Image.NEAREST
        BILINEAR = Image.BILINEAR
        BICUBIC = Image.BICUBIC
        LANCZOS = Image.ANTIALIAS
