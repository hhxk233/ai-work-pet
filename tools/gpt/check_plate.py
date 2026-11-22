"""Check that a layer plate is registered to the approved front drawing: same canvas, and whatever it kept
from the drawing sits on the same pixels.
usage: python check_plate.py <canonical.png> <plate.png> [plate2.png ...]
Prints the canvas size, how far the plate's lines are shifted against the drawing (dx, dy in px), and the share of
the plate's figure pixels that match the drawing in place. PASS needs the same canvas and a shift of at most 4 px.
A low matching share is normal for plates that add hidden parts (back hair) and is printed for information only.
Do not run it on the face-parts plate: those parts are deliberately moved apart."""
import sys
import numpy as np, cv2
from PIL import Image
def load(p):
    im = np.array(Image.open(p).convert('RGB')).astype(np.float32)
    fg = (im[..., 1] - np.maximum(im[..., 0], im[..., 2])) < 12
    return im, fg
can, cfg = load(sys.argv[1])
cgray = cv2.cvtColor(can.astype(np.uint8), cv2.COLOR_RGB2GRAY)
cedge = cv2.GaussianBlur(cv2.Canny(cgray, 60, 140).astype(np.float32), (0, 0), 2)
for path in sys.argv[2:]:
    im, fg = load(path)
    if im.shape != can.shape:
        print(f'{path}  FAIL: canvas {im.shape[1]}x{im.shape[0]}, the drawing is {can.shape[1]}x{can.shape[0]}'); continue
    gray = cv2.cvtColor(im.astype(np.uint8), cv2.COLOR_RGB2GRAY)
    inner = cv2.erode(fg.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0      # ignore the plate's own new outer edge
    edge = cv2.GaussianBlur(cv2.Canny(gray, 60, 140).astype(np.float32) * inner, (0, 0), 2)
    best = (-1, 0, 0)
    for dy in range(-16, 17, 2):
        for dx in range(-16, 17, 2):
            sh = np.roll(np.roll(edge, -dy, 0), -dx, 1); s = float((sh * cedge).sum())
            if s > best[0]: best = (s, dx, dy)
    _, bx, by = best; best = (-1, bx, by)
    for dy in range(by - 2, by + 3):
        for dx in range(bx - 2, bx + 3):
            sh = np.roll(np.roll(edge, -dy, 0), -dx, 1); s = float((sh * cedge).sum())
            if s > best[0]: best = (s, dx, dy)
    _, dx, dy = best
    both = fg & cfg
    same = (np.abs(im - can).max(2) < 40) & both
    share = same.sum() / max(fg.sum(), 1)
    ok = abs(dx) <= 4 and abs(dy) <= 4
    print(f'{path}  canvas ok  shift dx={dx} dy={dy}  matching share {share:.2f}  figure {int(fg.sum())} px  ' + ('PASS' if ok else 'FAIL: the kept parts are not on the same pixels as the drawing'))
