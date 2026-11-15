"""Pull the older pose sprites (rice*, laptop*, cut from the v04 key-pose sheets) onto the palette of the
idle model, so a switch between the model and those sprites does not change the hair colour.

Measured on the crown of the hair (cv2 Lab, 0-255): the idle model sits at L 120, b 99.7; the rice sheet at
L 142, b 101.9; the laptop sheet at L 129, b 100.9. Skin and whites already agree, so only blue pixels move.

usage: match_colour.py <poses dir>      (run once, after cut_poses.py / upscale.py; not idempotent)
"""
import sys, os
import numpy as np, cv2
from PIL import Image

SHIFT = {'rice': (-20.0, -2.0), 'laptop': (-8.5, -1.2)}    # (dL, db) for blue pixels
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    key = next((k for k in SHIFT if f.startswith(k) and f.endswith('.png')), None)
    if not key: continue
    a = np.asarray(Image.open(os.path.join(d, f)).convert('RGBA'))
    rgb = a[..., :3]; lab = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB).astype(np.float32)
    blue = rgb[..., 2].astype(np.float32) - rgb[..., 0].astype(np.float32)
    w = np.clip((blue - 8) / 16.0, 0, 1); w = w * w * (3 - 2 * w)          # 0 on skin/white/gold, 1 on navy and blue
    dL, db = SHIFT[key]
    lab[..., 0] += dL * w; lab[..., 2] += db * w
    out = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB)
    Image.fromarray(np.dstack([out, a[..., 3]])).save(os.path.join(d, f))
    print(f, 'shifted', dL, db)
