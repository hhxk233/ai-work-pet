"""Check a two-figure pose sheet for the GPT pet (flat green, 1536x1024).
usage: python check_pose_sheet.py sheet.png [sheet2.png ...]
PASS needs: the right canvas, two separate figures, each inside its own half with at least 10 px of green around it,
and no loose pieces (a floating prop, a sparkle, a crumb). For each figure it also prints the height and the
width of the head band over the height. On the template that ratio is 0.66; a plain standing figure under 0.63
has a head that is too small for its body. Raised arms, spread wings, crouching, sitting and lying change the
ratio, so for those compare the head with the template by eye."""
import sys
import numpy as np, cv2
from PIL import Image
for path in sys.argv[1:]:
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32); H, W = im.shape[:2]
    fg = ((im[..., 1] - np.maximum(im[..., 0], im[..., 2])) < 12).astype(np.uint8)
    num, lab, st, cen = cv2.connectedComponentsWithStats(fg, connectivity=8)
    order = sorted(range(1, num), key=lambda q: -st[q, cv2.CC_STAT_AREA]); bad = []
    if (W, H) != (1536, 1024): bad.append(f'canvas is {W}x{H}, not 1536x1024')
    if len(order) < 2 or st[order[1], cv2.CC_STAT_AREA] < 0.15 * st[order[0], cv2.CC_STAT_AREA]:
        print(f'{path}  FAIL: only one figure found; the two figures touch, or one is missing'); continue
    loose = [int(st[q, cv2.CC_STAT_AREA]) for q in order[2:] if st[q, cv2.CC_STAT_AREA] > 120]
    if loose: bad.append(f'{len(loose)} loose piece(s), largest {max(loose)} px')
    out = []
    for i, q in enumerate(sorted(order[:2], key=lambda q: cen[q][0])):
        x, y, w, h = st[q, 0], st[q, 1], st[q, 2], st[q, 3]; m = lab[y:y + h, x:x + w] == q
        band = m[int(h * 0.2):int(h * 0.5)]; xs = np.where(band.any(0))[0]; r = (xs.max() - xs.min()) / h
        lo, hi = (0, W // 2) if i == 0 else (W // 2, W)
        if x < lo + 10 or x + w > hi - 10: bad.append(f'figure {i + 1} leaves its half (x {x}..{x + w})')
        if y < 10 or y + h > H - 10: bad.append(f'figure {i + 1} touches the top or bottom')
        out.append(f'figure {i + 1}: height {h}, width {w}, lowest point y={y + h}, head band {r:.2f}')
    print(f'{path}  ' + '; '.join(out) + '  ' + ('PASS' if not bad else 'FAIL: ' + '; '.join(bad)))
