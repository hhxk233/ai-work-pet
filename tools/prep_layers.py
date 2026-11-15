"""Prepare DeepSeek textures for the v05 deform engine from the v04 registered 1024 layers.
usage: python3 prep_layers.py <v04_source_layers_dir> <out_tex_dir> <canonical-candidate.png>"""
import sys, json, os
import numpy as np
from PIL import Image
import cv2
src, out = sys.argv[1], sys.argv[2]
names = {'HairBack':'hair_back','Tail':'tail','LegScreenLeft':'leg_l','LegScreenRight':'leg_r','Body':'body','HeadBlank':'head','FaceEyeScreenLOpen':'eye_l','FaceEyeScreenROpen':'eye_r',
 'FaceEyeScreenLClosed':'eye_l_closed','FaceEyeScreenRClosed':'eye_r_closed','FaceMouthOpen':'mouth_open','FaceMouthSmile':'mouth_smile'}
man = {}
_h = np.array(Image.open(os.path.join(src, 'HeadBlank.png')).convert('RGBA'))[484:500, 430:452].reshape(-1, 4)
SKIN = (np.median(_h[_h[:, 3] > 200][:, :3], 0) * np.array([0.985, 0.955, 0.945])).astype(np.uint8)
for k, n in names.items():
    im = np.array(Image.open(os.path.join(src, k + '.png')).convert('RGBA'))
    if n == 'body':
        # The v04 torso had the arms painted out and replaced by oversized sleeves meeting at the collar
        # ("hands growing out of the chest"). Take torso AND arms straight from the approved canonical drawing:
        # shoulders at the sides, fists beside the chest. Arms are never animated separately, so one layer is right.
        S, TX, TY = 0.7207, 54.309, 65.586                      # canonical 1268x1240 -> registered 1024 canvas (fitted on fists/eyes/shoes)
        can = cv2.warpAffine(np.array(Image.open(sys.argv[3]).convert('RGBA')), np.float32([[S, 0, TX], [0, S, TY]]), (1024, 1024), flags=cv2.INTER_AREA)
        rgb = can[..., :3].astype(int); ca = can[..., 3] > 60
        mask = (im[..., 3] > 60) & ca                           # torso + skirt footprint
        headA = np.array(Image.open(os.path.join(src, 'HeadBlank.png')).convert('RGBA'))[..., 3] > 30
        mask &= ~(cv2.dilate(headA.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)   # the canonical chin belongs to the head layer, not the torso
        arms = np.zeros_like(mask)
        for (x0, y0, x1, y1) in ((316, 584, 452, 714), (540, 578, 670, 710)):
            box = np.zeros_like(mask); box[y0:y1, x0:x1] = True
            cand = box & ca & ((rgb[..., 2] - rgb[..., 0]) < 52)  # sleeve navy, skin, cuff white, gold, ink; not hair blue
            cand = cv2.morphologyEx(cand.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
            num, lab, st, _ = cv2.connectedComponentsWithStats(cand, connectivity=8)
            if num > 1: arms |= lab == 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        mask |= cv2.morphologyEx(arms.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8)) > 0
        soft = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 0.7)
        im = can.copy(); im[..., 3] = (np.clip(soft * 1.6 - 0.3, 0, 1) * can[..., 3]).astype(np.uint8)
    if n in ('tail', 'hair_back'):
        # drop stray ink specks left by the v04 cut-out (small islands not attached to the main shape)
        num, lab, st, _ = cv2.connectedComponentsWithStats((im[..., 3] > 24).astype(np.uint8), connectivity=8)
        big = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA]))
        keep = cv2.dilate((lab == big).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        im[~keep, 3] = 0
    a = im[..., 3]
    ys, xs = np.where(a > 4)
    x0, x1, y0, y1 = max(xs.min() - 3, 0), min(xs.max() + 4, 1024), max(ys.min() - 3, 0), min(ys.max() + 4, 1024)
    crop = im[y0:y1, x0:x1].copy()
    # bleed colour into fully transparent texels (avoids dark fringes when the mesh is warped/minified)
    rgb = crop[..., :3]; al = crop[..., 3]
    hole = (al < 8).astype(np.uint8)
    if hole.any():
        filled = cv2.inpaint(rgb, hole, 3, cv2.INPAINT_NS) if hole.mean() < 0.9 else rgb
        near = cv2.dilate((al >= 8).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        rgb[(hole > 0) & near] = filled[(hole > 0) & near]
    Image.fromarray(crop).save(os.path.join(out, n + '.png'), optimize=True)
    man[n] = dict(x=int(x0), y=int(y0), w=int(x1 - x0), h=int(y1 - y0))
# neck: a small skin patch under the chin so looking up / tilting never shows a gap
head = np.array(Image.open(os.path.join(src, 'HeadBlank.png')).convert('RGBA'))
skin = head[484:500, 430:452].reshape(-1, 4); skin = np.median(skin[skin[:, 3] > 200][:, :3], 0) * np.array([0.985, 0.955, 0.945])
nk = np.zeros((84, 104, 4), np.uint8); yy, xx = np.mgrid[0:84, 0:104]
d = np.maximum(np.abs(xx - 52) / 40.0, np.abs(yy - 42) / 40.0); rr = ((np.abs(xx - 52) / 42.0) ** 4 + (np.abs(yy - 40) / 40.0) ** 4)
shade = skin[None, None, :] * (0.965 + 0.035 * (yy[..., None] / 84.0))
nk[..., :3] = np.clip(shade, 0, 255); nk[..., 3] = (np.clip((1 - rr) * 6, 0, 1) * 255).astype(np.uint8)
Image.fromarray(nk).save(os.path.join(out, 'neck.png')); man['neck'] = dict(x=438, y=506, w=104, h=84)
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
print(json.dumps(man))
