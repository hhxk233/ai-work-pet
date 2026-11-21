"""Jelly meter: how much the figure stretches and shears between consecutive frames (rigid motion of any part,
like a wing turning on its root, scores zero). Prints the mean strain per region, in 1/1000 per frame."""
import sys, numpy as np, cv2
from PIL import Image
d, a0, a1 = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
def g(f): return cv2.cvtColor(np.asarray(Image.open('%s/f%05d.jpg' % (d, f)).convert('RGB')), cv2.COLOR_RGB2GRAY)
ref = g(a0)
rgb0 = np.asarray(Image.open('%s/f%05d.jpg' % (d, a0)).convert('RGB')).astype(int)
bg = np.abs(rgb0 - np.median(rgb0[:, :40], 1)[:, None, :]).sum(2) > 14
bg = cv2.morphologyEx(bg.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((15, 15), np.uint8))
ff = bg.copy(); h2 = np.zeros((bg.shape[0] + 2, bg.shape[1] + 2), np.uint8); cv2.floodFill(ff, h2, (0, 0), 1); bg = (bg | (1 - ff)) > 0
ys, xs = np.where(bg); cx = int(np.median(xs)); top = ys.min(); h = ys.max() - top
bgi = cv2.erode(bg.astype(np.uint8), np.ones((31, 31), np.uint8)) > 0             # stay off the silhouette: motion against the static background is not strain
tex = cv2.GaussianBlur(np.abs(cv2.Laplacian(ref, cv2.CV_32F)), (0, 0), 3) > 6      # only where there are lines to track
acc = np.zeros(ref.shape, np.float32); n = 0; prev = ref
for f in range(a0 + 1, a1):
    cur = g(f); fl = cv2.calcOpticalFlowFarneback(prev, cur, None, 0.5, 4, 25, 5, 7, 1.5, 0); prev = cur
    fl = cv2.GaussianBlur(fl, (0, 0), 6)
    ux, uy = np.gradient(fl[..., 0], axis=1), np.gradient(fl[..., 0], axis=0); vx, vy = np.gradient(fl[..., 1], axis=1), np.gradient(fl[..., 1], axis=0)
    s = np.sqrt((ux - vy) ** 2 / 4 + (ux + vy) ** 2 / 4 * 0 + ((uy + vx) / 2) ** 2 + ((ux + vy) / 2) ** 2)
    acc += s; n += 1
acc = acc / n * 1000
def reg(name, y0, y1, x0, x1):
    m = np.zeros_like(bg); m[top + int(h * y0):top + int(h * y1), cx + int(h * x0):cx + int(h * x1)] = True; m &= bgi & tex
    return '%s %5.2f' % (name, acc[m].mean())
print('  '.join([reg('face', 0.30, 0.52, -0.18, 0.18), reg('top', 0.0, 0.25, -0.25, 0.25), reg('hairL', 0.45, 0.95, -0.55, -0.25), reg('hairR', 0.45, 0.95, 0.25, 0.55),
                 reg('wings', 0.55, 0.80, -0.62, -0.30), reg('chest', 0.55, 0.72, -0.15, 0.15), reg('skirt', 0.78, 0.98, -0.25, 0.25)]))
