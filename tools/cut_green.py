"""Cut two-figure pose sheets drawn on flat green (#00B140) into sprites placed in model space.
usage: cut_green.py <art_in_dir> <out_poses_dir>   (updates <out_poses_dir>/poses.json)"""
import sys, os, json
import numpy as np, cv2
from PIL import Image
src, out = sys.argv[1], sys.argv[2]
EAR, FEET_X, HEAD_X = 675.0, 495.0, 492.0
# sheet -> (reference figure index for scale, [(name, kind), (name, kind)])
SHEETS = {'think': (0, [('think0', 'stand'), ('think1', 'stand')]), 'wave': (1, [('wave0', 'stand'), ('wave1', 'stand')]),
          'stretch': (0, [('stretch0', 'stand'), ('stretch1', 'stand')]), 'whale': (0, [('whale0', 'stand'), ('whale1', 'lie')]),
          'rest': (0, [('rest0', 'sit'), ('rest1', 'lie')]), 'jump': (0, [('jump0', 'stand'), ('jump1', 'stand')])}
pj = os.path.join(out, 'poses.json'); poses = json.load(open(pj)) if os.path.exists(pj) else {}
for old in ('tr1', 'tr2'): poses.pop(old, None)          # superseded by the redrawn think pair
for sheet, (ref, figs) in SHEETS.items():
    im = np.array(Image.open(os.path.join(src, sheet + '.png')).convert('RGB')).astype(np.float32)
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    spill = g - np.maximum(r, b)                                   # how green a pixel is
    a = 1 - np.clip((spill - 6) / 18, 0, 1); a = cv2.GaussianBlur(a, (0, 0), 0.6); a = np.clip((a - 0.15) / 0.7, 0, 1)   # nothing on the character is green, so any green hue is background (also shaded green)
    bgc = np.array([0, 177, 64], np.float32); aa = np.maximum(a, 0.3)[..., None]
    rgb = np.clip((im - (1 - aa) * bgc) / aa, 0, 255)             # remove the green that bled into edge pixels
    gg = np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 12); rgb[..., 1] = np.where(a < 0.999, gg, rgb[..., 1])   # despill edges only
    a[(rgb[..., 1] > rgb[..., 0] + 8) & (rgb[..., 1] > rgb[..., 2] + 8)] = 0      # leftover shaded-green specks
    num, lab, st, cen = cv2.connectedComponentsWithStats((a > 0.5).astype(np.uint8), connectivity=8)
    order = sorted(sorted(range(1, num), key=lambda q: -st[q, cv2.CC_STAT_AREA])[:2], key=lambda q: cen[q][0])
    crops = []
    for q in order:
        m = cv2.dilate((lab == q).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        x0, y0, w, h = st[q, cv2.CC_STAT_LEFT], st[q, cv2.CC_STAT_TOP], st[q, cv2.CC_STAT_WIDTH], st[q, cv2.CC_STAT_HEIGHT]
        x0, y0, x1, y1 = max(x0 - 3, 0), max(y0 - 3, 0), min(x0 + w + 3, im.shape[1]), min(y0 + h + 3, im.shape[0])
        al = (a * m)[y0:y1, x0:x1]; crops.append((np.dstack([rgb[y0:y1, x0:x1], al * 255]).astype(np.uint8), al > 0.5))
    def earspan(mask):
        H = mask.shape[0]; band = mask[int(H * 0.2):int(H * 0.5)]; xs = np.where(band.any(0))[0]; return xs.min(), xs.max()
    sc = 827.0 / 760.0      # round-2 sheets are drawn on art_in/ref/template_2up.png: a 760 px figure there is the 827-unit model
    for (name, kind), (rgba, mask) in zip(figs, crops):
        H, W = mask.shape; w, h = round(W * sc), round(H * sc)
        if kind == 'stand':
            xs = np.where(mask[int(H * 0.955):].any(0))[0]; cx = (xs.min() + xs.max()) / 2; x = round(FEET_X - cx * sc)   # stand on the same spot as the layered model
            ea, eb = earspan(mask); xe = round(HEAD_X - (ea + eb) / 2 * sc)
            if abs(xe - x) > 20: x = xe                              # hair or tail reaches the floor (crouch): trust the ears instead
        else: x = round(500 - w / 2)
        big = cv2.resize(rgba, (w, h), interpolation=cv2.INTER_LANCZOS4)
        Image.fromarray(big).save(os.path.join(out, name + '.png'), optimize=True)
        poses[name] = dict(x=int(x), y=int(906 - h), w=int(w), h=int(h), kind=kind); print(name, poses[name], 'scale', round(sc, 3))
json.dump(poses, open(pj, 'w'), indent=1)
