"""Cut the key-pose figures out of the v04 review sheets (flat cream background) into clean RGBA sprites.
usage: cut_poses.py <review_dir> <out_dir>"""
import sys, os, json
import numpy as np, cv2
from PIL import Image
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
SHEETS = {'rice': ('rice-keyposes.png', 4, 1), 'laptop': ('laptop-keyposes.png', 4, 1), 'tr': ('thinking-running-keyposes.png', 3, 2)}
meta = {}
for key, (fn, nx, ny) in SHEETS.items():
    im = np.array(Image.open(os.path.join(src, fn)).convert('RGB')); H, W = im.shape[:2]; cw, ch = W // nx, H // ny
    for j in range(ny):
        for i in range(nx):
            c = im[j * ch:(j + 1) * ch, i * cw:(i + 1) * cw].astype(np.float32)
            hsv = cv2.cvtColor(c.astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
            bgl = ((hsv[..., 1] < 34) & (hsv[..., 2] > 196)).astype(np.uint8)          # cream paper, panel cards, soft ground shadow
            # flood the outside through a slightly shrunken mask so hairline gaps in the ink do not leak into white clothing
            core = cv2.erode(bgl, np.ones((7, 7), np.uint8))
            num, lab = cv2.connectedComponents(core, connectivity=4)
            border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
            bg = cv2.dilate(np.isin(lab, list(border)).astype(np.uint8), np.ones((9, 9), np.uint8)) & bgl
            # background showing through gaps between hair strands: enclosed, paper-coloured, off to the sides
            paper0 = np.median(c[bg > 0], 0); n3, l3, st3, cen3 = cv2.connectedComponentsWithStats(((bgl > 0) & (bg == 0)).astype(np.uint8), connectivity=4)
            fy, fx = np.where(bg == 0); cx0 = (fx.min() + fx.max()) / 2; fw = fx.max() - fx.min(); fh = fy.max() - fy.min()
            for q in range(1, n3):
                m = l3 == q
                if st3[q, cv2.CC_STAT_AREA] < 12: continue
                side = abs(cen3[q][0] - cx0) > 0.21 * fw and (cen3[q][1] - fy.min()) > 0.36 * fh
                if not side or np.abs(c[m].mean(0) - paper0).max() > 10: continue
                ring = (cv2.dilate(m.astype(np.uint8), np.ones((9, 9), np.uint8)) > 0) & ~m & (c.sum(2) > 210)   # neighbours, ink excluded
                if ring.sum() > 8 and np.median(c[ring][:, 2] - c[ring][:, 0]) > 55: bg[m] = 1                     # surrounded by hair blue
            bg = bg > 0
            fg = (~bg).astype(np.uint8)
            n2, l2, st, _ = cv2.connectedComponentsWithStats(fg, connectivity=8)
            big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); fg = (l2 == big).astype(np.uint8)   # the figure only
            fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
            a = cv2.GaussianBlur(fg.astype(np.float32), (0, 0), 0.8); a = np.clip((a - 0.35) / 0.5, 0, 1)
            # decontaminate the soft edge: remove the paper colour that bled into edge pixels
            paper = np.median(c[bg], 0) if bg.any() else np.array([250, 246, 240], np.float32)
            aa = np.maximum(a, 0.25)[..., None]; rgb = np.clip((c - (1 - aa) * paper) / aa, 0, 255)
            rgb = np.where((a[..., None] > 0.98), c, rgb)
            ys, xs = np.where(a > 0.02); x0, x1, y0, y1 = xs.min() - 2, xs.max() + 3, ys.min() - 2, ys.max() + 3
            x0, y0 = max(x0, 0), max(y0, 0)
            rgba = np.dstack([rgb, a * 255]).astype(np.uint8)[y0:y1, x0:x1]
            name = f'{key}{j * nx + i}'; Image.fromarray(rgba).save(os.path.join(out, name + '.png'))
            meta[name] = dict(w=int(x1 - x0), h=int(y1 - y0))
json.dump(meta, open(os.path.join(out, 'cut.json'), 'w')); print(meta)
