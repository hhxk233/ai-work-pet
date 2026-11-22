"""Measure how far each pose sprite's head sits from a reference sprite's head, in model units.
usage: python3 head_shift.py <poses dir> <reference pose> <pose> [pose ...]
Compares line edges in the band from the horn tips down to the chin. A shift of a few units between two
poses of one action shows as the head stepping sideways or up at the switch."""
import sys, os, json
import numpy as np, cv2
from PIL import Image
d, ref, names = sys.argv[1], sys.argv[2], sys.argv[3:]
P = json.load(open(os.path.join(d, 'poses.json')))
def place(n):
    p = P[n]; im = Image.open(os.path.join(d, n + '.png')).convert('RGBA').resize((round(p['w'] * 2), round(p['h'] * 2)), Image.LANCZOS)
    c = Image.new('RGBA', (2048, 2048), (0, 0, 0, 0)); c.alpha_composite(im, (round(p['x'] * 2), round(p['y'] * 2)))
    a = np.asarray(c).astype(np.float32); g = cv2.cvtColor(a[..., :3].astype(np.uint8), cv2.COLOR_RGB2GRAY)
    e = cv2.Canny(g, 60, 140).astype(np.float32) * (a[..., 3] > 200)
    ys = np.where(a[..., 3].max(1) > 200)[0]; top = ys.min()
    return cv2.GaussianBlur(e, (0, 0), 2), top
R, rt = place(ref)
for n in names:
    E, t = place(n); y0, y1 = max(min(rt, t) - 10, 0), min(rt, t) + 520          # horns to chin, at 2x
    best = (-1, 0, 0)
    for dy in range(-24, 25, 2):
        for dx in range(-24, 25, 2):
            s = float((np.roll(np.roll(E[y0:y1], -dy, 0), -dx, 1) * R[y0:y1]).sum())
            if s > best[0]: best = (s, dx, dy)
    print(f'{n:12s} head vs {ref}: dx={best[1] / 2:+.1f} dy={best[2] / 2:+.1f} model units')
