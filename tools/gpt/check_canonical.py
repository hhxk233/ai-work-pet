"""Check the size and placement of a single canonical figure drawn on flat green.
usage: python check_canonical.py image.png [image2.png ...]
Wanted on a 1536x1024 canvas: one figure, 900 px from the horn tips to the shoe soles (880-920 passes),
soles at y=960 (945-975 passes), no wider than 1100 px, at least 15 px of green on every side,
and no patch of green inside the figure. This checks geometry only; it cannot tell whether she is cute."""
import sys
import numpy as np, cv2
from PIL import Image
for path in sys.argv[1:]:
    im = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    H, W = im.shape[:2]
    spill = im[..., 1] - np.maximum(im[..., 0], im[..., 2])          # how green a pixel is
    fg = (spill < 12).astype(np.uint8)
    num, lab, st, cen = cv2.connectedComponentsWithStats(fg, connectivity=8)
    if num < 2: print(f'{path}  FAIL: no figure found'); continue
    order = sorted(range(1, num), key=lambda q: -st[q, cv2.CC_STAT_AREA]); q = order[0]
    x, y, w, h, area = st[q]
    extra = [int(st[k, cv2.CC_STAT_AREA]) for k in order[1:] if st[k, cv2.CC_STAT_AREA] > 150]
    # green enclosed by the figure: background components that do not touch the border
    n2, lab2, st2, _ = cv2.connectedComponentsWithStats((1 - fg).astype(np.uint8), connectivity=4)
    border = set(lab2[0]) | set(lab2[-1]) | set(lab2[:, 0]) | set(lab2[:, -1])
    holes = [int(st2[k, cv2.CC_STAT_AREA]) for k in range(1, n2) if k not in border and st2[k, cv2.CC_STAT_AREA] > 40]
    bgpix = im[spill > 40]; bgsd = float(bgpix[:, 1].std()) if len(bgpix) else 0.0
    margin = min(x, y, W - (x + w), H - (y + h))
    bad = []
    if (W, H) != (1536, 1024): bad.append(f'canvas is {W}x{H}, not 1536x1024')
    if not 880 <= h <= 920: bad.append(f'height {h} (want 900)')
    if not 945 <= y + h <= 975: bad.append(f'soles at y={y + h} (want 960)')
    if w > 1100: bad.append(f'width {w} (limit 1100)')
    if margin < 15: bad.append(f'only {margin} px of green at the nearest edge')
    if extra: bad.append(f'{len(extra)} separate piece(s) beside the figure (marks, sparkles, a detached part?)')
    note = f'; {len(holes)} enclosed green patch(es), largest {max(holes)} px: fine between hair strands, wrong inside clothing' if holes else ''
    print(f'{path}  height {h}  width {w}  soles y={y + h}  centre x={x + w // 2}  margin {margin}  green spread {bgsd:.1f}{note}  '
          + ('PASS' if not bad else 'FAIL: ' + '; '.join(bad)))
