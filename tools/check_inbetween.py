"""Check that an in-between figure keeps everything except the arms, prop and face where its key pose has it.

usage: python check_inbetween.py <new_sheet.png>:<L|R> <key_sheet.png>:<L|R> [more key_sheet.png:<L|R> ...]

Both sheets are flat-green two-figure sheets drawn on art_in/ref/template_2up.png. The script compares the
outline of the new figure with each key figure everywhere outside a box around the arms, and prints the share of
the figure that moved. Measured on the accepted sheets: two figures on the same sheet score about 0.1%, the same
action redrawn on a second sheet about 0.6%, a drawing from a different action 0.7-1.3%. PASS needs 0.8% or less
against at least one of the keys given.

Do not use it for changes of posture (standing to sitting, sitting to lying): there the whole figure moves.
"""
import sys
import numpy as np, cv2
from PIL import Image

def figure(spec):
    path, side = spec.rsplit(':', 1)
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    fg = ((im[..., 1] - np.maximum(im[..., 0], im[..., 2])) < 12).astype(np.uint8)
    half = fg.shape[1] // 2; m = np.zeros_like(fg)
    if side.upper() == 'L': m[:, :half] = fg[:, :half]
    else: m[:, half:] = fg[:, half:]
    num, lab, st, _ = cv2.connectedComponentsWithStats(m, connectivity=8)
    q = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); m = (lab == q)
    if side.upper() == 'R': m = np.roll(m, -half, 1)        # both figures into the left half's coordinates
    return m[:, :half]

def drift(a, b):
    ys, xs = np.where(a | b); x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max(); w, h = x1 - x0, y1 - y0; cx = (x0 + x1) / 2
    box = np.zeros_like(a); box[int(y0 + 0.30 * h):int(y0 + 0.80 * h), int(cx - 0.24 * w):int(cx + 0.24 * w)] = True   # arms, prop, chin
    best = 1.0
    for dx in range(-3, 4):                                    # allow a few pixels of placement error
        for dy in range(-3, 4):
            d = (a ^ np.roll(np.roll(b, dx, 1), dy, 0)) & ~box; best = min(best, d.sum() / max(a.sum(), 1))
    return best

new = figure(sys.argv[1]); ok = False
for key in sys.argv[2:]:
    v = drift(new, figure(key)); ok |= v <= 0.008
    print(f'{sys.argv[1]} vs {key}: {v * 100:.2f}% of the figure moved outside the arm area')
print('PASS' if ok else 'FAIL: hair, dress, tail or feet do not match the key pose; redraw with only the arms, prop and face changed')
