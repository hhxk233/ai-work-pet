"""Clean the lower edge of the head layer's chin.

The v04 head layer was cut where the collar bow overlapped the chin, so the edge kept fragments of the
bow outline, had a brown outline on one side only and a hard cut on the other. Once the head turns or
tilts, that edge is exposed above the collar. This rebuilds the edge as one smooth curve with a single
continuous outline, as in the approved front view.

The torso layer comes from the approved front view with the head masked out, and on the viewer's left the
mask stopped just short of the chin outline, so a short brown stroke was left lying on the collar frill. It
stays with the body when the head moves and reads as a stray line under the chin. It is recoloured to the
navy of the frill outlines so it becomes the top edge of the frill.

usage: fix_chin.py <tex dir> [head|body]   (rewrites head.png and/or body.png in place; run once on the
       output of prep_layers.py; default both)
"""
import sys, json, os
import numpy as np
from PIL import Image

tex = sys.argv[1]; which = sys.argv[2] if len(sys.argv) > 2 else 'both'
if which in ('body', 'both'):
    mb = json.load(open(os.path.join(tex, 'manifest.json')))['body']
    bim = np.asarray(Image.open(os.path.join(tex, 'body.png')).convert('RGBA')).astype(np.float64)
    n = 0
    for (xa, xb) in ((394, 454), (526, 538)):                       # the two leftover stretches; the bow gem between them is gold and must stay
        reg = bim[0:574 - mb['y'], xa - mb['x']:xb - mb['x']]
        lum = reg[..., :3].mean(-1); brown = (reg[..., 3] > 0) & (reg[..., 0] - reg[..., 2] > -4) & (lum < 150)
        reg[brown, 0] = lum[brown] * 0.80; reg[brown, 1] = lum[brown] * 0.86; reg[brown, 2] = lum[brown] * 1.34; n += int(brown.sum())
    Image.fromarray(np.clip(bim, 0, 255).round().astype(np.uint8)).save(os.path.join(tex, 'body.png'))
    print('torso: recoloured', n, 'pixels of leftover chin outline')
if which == 'body': sys.exit()
man = json.load(open(os.path.join(tex, 'manifest.json')))['head']
OX, OY = man['x'], man['y']
im = np.asarray(Image.open(os.path.join(tex, 'head.png')).convert('RGBA')).astype(np.float64)
H, W = im.shape[:2]
X0, X1 = 370, 600                       # model-space span of the exposed chin, between the two side locks
LINE = np.array([84., 46., 46.])        # outline colour sampled from the surviving stretch

def bottom(x):
    ys = np.where(im[:, x - OX, 3] > 128)[0]
    return ys.max() + OY

# fit the curve through the stretches of edge that were not damaged by the bow
xs = [x for x in range(X0, X1 + 1, 2) if x <= 448 or 478 <= x <= 494 or x >= 538]
co = np.polyfit(np.array(xs) - 485.0, [bottom(x) for x in xs], 4)
yc = lambda x: np.polyval(co, x - 485.0)

def skin(x):
    c = int(round(yc(x))) - OY
    px = im[c - 17:c - 10, x - OX]
    px = px[(px[:, 3] > 200) & (px[:, 2] - px[:, 0] < 15) & (px[:, :3].sum(1) > 560)]
    return np.median(px[:, :3], 0) if len(px) else None

cols = {x: skin(x) for x in range(X0 - 6, X1 + 7)}
last = None
for x in sorted(cols):                   # fill gaps, then smooth along x
    if cols[x] is None: cols[x] = last
    last = cols[x]
for x in sorted(cols, reverse=True):
    if cols[x] is None: cols[x] = last
    last = cols[x]
sm = {x: np.mean([cols[k] for k in range(x - 5, x + 6) if k in cols], 0) for x in range(X0, X1 + 1)}

out = im.copy()
for x in range(X0, X1 + 1):
    y0 = yc(x); slope = np.polyval(np.polyder(co), x - 485.0); cosv = 1 / np.hypot(1, slope)
    edge = min(1.0, (x - X0 + 1) / 5.0, (X1 - x + 1) / 5.0)       # hand over to the existing edge at both ends
    for ty in range(int(y0) - 12 - OY, H):
        y = ty + OY; p = out[ty, x - OX]
        hair = (x < 380 or x > 592) and p[3] > 60 and p[2] - p[0] > 22   # a side lock crossing the band: leave it
        if hair: continue
        w = np.clip((y - (y0 - 10)) / 5.0, 0, 1) * edge            # repaint the band just above the curve
        col = p[:3] * (1 - w) + sm[x] * w if p[3] > 0 else sm[x]
        d = (y - (y0 - 1.3)) * cosv                                # distance to the outline's centre line
        ln = np.clip(1.75 - abs(d), 0, 1) * 0.92 * edge
        col = col * (1 - ln) + LINE * ln
        a = np.clip(y0 + 0.5 - y, 0, 1)
        a = a * edge + (p[3] / 255.0) * (1 - edge)
        out[ty, x - OX] = [col[0], col[1], col[2], 255 * a]
Image.fromarray(np.clip(out, 0, 255).round().astype(np.uint8)).save(os.path.join(tex, 'head.png'))
print('chin edge rebuilt, lowest point y=%.1f' % yc(485))
