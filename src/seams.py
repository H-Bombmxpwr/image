import numpy as np
from PIL import Image, ImageDraw
from skimage import color, filters

def _energy(img_arr):
    gray = color.rgb2gray(img_arr/255.0)
    e = filters.sobel(gray)
    return e

def _find_vertical_seam(energy):
    h, w = energy.shape
    cost = energy.copy()
    back = np.zeros_like(cost, dtype=np.int16)
    for i in range(1, h):
        left = np.roll(cost[i-1], 1)
        right = np.roll(cost[i-1], -1)
        prev = np.vstack([left, cost[i-1], right]).T
        idx = np.argmin(prev, axis=1)
        cost[i] += prev[np.arange(w), idx]
        back[i] = idx-1
    j = np.argmin(cost[-1])
    seam = np.zeros(h, dtype=np.int32)
    seam[-1] = j
    for i in range(h-2, -1, -1):
        seam[i] = seam[i+1] + back[i+1, seam[i+1]]
        seam[i] = max(0, min(seam[i], w-1))
    return seam

def _remove_seam(img_arr, seam):
    h, w, c = img_arr.shape
    out = np.zeros((h, w-1, c), dtype=img_arr.dtype)
    for i in range(h):
        j = seam[i]
        out[i, :, :] = np.concatenate([img_arr[i, :j, :], img_arr[i, j+1:, :]], axis=0)
    return out

def _draw_seam_overlay(img, seam, rgb):
    out = img.copy()
    d = ImageDraw.Draw(out)
    col = tuple(rgb)
    for i, x in enumerate(seam):
        d.point((x, i), fill=col)
    return out

def seam_preview_frames(img: Image.Image, target_w: int, max_frames=60, rgb=(176,11,105)):
    arr = np.array(img.convert("RGB"))
    h, w, _ = arr.shape
    remove_n = max(0, w - target_w)
    if remove_n == 0: return []

    # sample frames across all seams
    frames_idx = np.linspace(1, remove_n, num=min(max_frames, remove_n), dtype=int)
    frames = []
    idx_cursor = 0
    for step in range(1, remove_n+1):
        energy = _energy(arr)
        seam = _find_vertical_seam(energy)
        # capture this seam if matches scheduled frame
        if step == frames_idx[idx_cursor]:
            frame_img = _draw_seam_overlay(Image.fromarray(arr), seam, rgb)
            frames.append(frame_img)
            if idx_cursor < len(frames_idx)-1:
                idx_cursor += 1
        arr = _remove_seam(arr, seam)
    return frames

def seam_carve_final(img: Image.Image, target_w: int):
    # final result using the same simple backward energy
    arr = np.array(img.convert("RGB"))
    h, w, _ = arr.shape
    remove_n = max(0, w - target_w)
    for _ in range(remove_n):
        energy = _energy(arr)
        seam = _find_vertical_seam(energy)
        arr = _remove_seam(arr, seam)
    return Image.fromarray(arr)
