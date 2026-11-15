"""Check that figures on a green pose sheet have the approved chibi proportions.
usage: python check_proportions.py sheet.png [sheet2.png ...]
Prints, per figure (left to right), ear-span / figure-height. The approved drawing is 0.82.
PASS needs >= 0.79 on an ordinary standing figure. Raised arms, crouching, sitting and lying change the height,
so for those compare the head with the other figure on the same sheet by eye instead."""
import sys
import numpy as np, cv2
from PIL import Image
for path in sys.argv[1:]:
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    spill = im[..., 1] - np.maximum(im[..., 0], im[..., 2]); fg = (spill < 12).astype(np.uint8)
    num, lab, st, cen = cv2.connectedComponentsWithStats(fg, connectivity=8)
    figs = sorted(sorted(range(1, num), key=lambda q: -st[q, cv2.CC_STAT_AREA])[:2], key=lambda q: cen[q][0])
    for i, q in enumerate(figs):
        x, y, w, h = st[q, 0], st[q, 1], st[q, 2], st[q, 3]; m = lab[y:y + h, x:x + w] == q
        band = m[int(h * 0.2):int(h * 0.5)]; xs = np.where(band.any(0))[0]; r = (xs.max() - xs.min()) / h
        print(f'{path}  figure {i + 1}: height {h}px  ear-span/height {r:.3f}  ' + ('PASS' if r >= 0.79 else 'FAIL: head too small for the body (or this pose changes the height)'))
