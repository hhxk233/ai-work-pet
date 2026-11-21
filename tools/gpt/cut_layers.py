"""Cut the GPT dragon girl's layers for PetEngine from the approved front drawing and the five layer plates.
usage: python3 cut_layers.py <art_in dir: gpt_canonical.png plus plates/ or drafts/layers/> <out tex dir> [debug dir]

Where each layer comes from
  head (blank face), eyes, open mouth   the approved drawing; only the skin under the eyes and mouth is from plate_blankface
  body, legs, skirt_back                plate_body, split by region so the boots can step behind the front panels
  wing_l, wing_r, tail                  plate_wings_tail
  hair_back                             plate_backhair
  closed eyes, closed mouth             plate_face_parts, scaled to the drawing's face
Textures keep the drawing's resolution; tex/manifest.json places them in the 1024-unit model space
(model = (drawing - (CX, SOLE)) * S + (500, 905))."""
import sys, os, json
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from keylib import key, over, save, on

src, out = sys.argv[1], sys.argv[2]; dbg = sys.argv[3] if len(sys.argv) > 3 else None
os.makedirs(out, exist_ok=True)
if dbg: os.makedirs(dbg, exist_ok=True)
PL = {'body': 'plate_body_attempt03', 'wt': 'plate_wings_tail_attempt03', 'hair': 'plate_backhair_attempt03', 'blank': 'plate_blankface_attempt01', 'parts': 'plate_face_parts_attempt02'}
CX, SOLE, S = 762.0, 961.0, 828.0 / 916.0             # drawing x of the body axis, y of the soles, drawing px -> model units
can = key(os.path.join(src, 'gpt_canonical.png'))
pdir = next(d for d in (os.path.join(src, 'plates'), os.path.join(src, 'drafts', 'layers')) if os.path.isdir(d))
P = {k: key(os.path.join(pdir, v + '.png')) for k, v in PL.items()}
H, W = can.shape[:2]; yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
man = {}
def blur(m, s): return cv2.GaussianBlur(m.astype(np.float32), (0, 0), s)
def dil(m, k): return cv2.dilate(m.astype(np.uint8), np.ones((k, k), np.uint8)) > 0
def close(m, k): return cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((k, k), np.uint8)) > 0
def fill(m):
    f = m.astype(np.uint8).copy(); h2 = np.zeros((m.shape[0] + 2, m.shape[1] + 2), np.uint8); cv2.floodFill(f, h2, (0, 0), 1); return m | (f == 0)
def bleed(rgba):
    """Push colour into transparent texels next to opaque ones, so warped edges never pick up a dark fringe."""
    rgb = rgba[..., :3].astype(np.uint8).copy(); al = rgba[..., 3]; hole = (al < 8).astype(np.uint8)
    if hole.any() and hole.mean() < 0.97:
        f = cv2.inpaint(rgb, hole, 3, cv2.INPAINT_NS); near = dil(al >= 8, 9); rgb[(hole > 0) & near] = f[(hole > 0) & near]
    return np.dstack([rgb, np.clip(al, 0, 255).astype(np.uint8)])
def emit(name, rgba, pad=3):
    a = rgba[..., 3]; ys, xs = np.where(a > 4)
    x0, x1, y0, y1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W), max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
    Image.fromarray(bleed(rgba[y0:y1, x0:x1]), 'RGBA').save(os.path.join(out, name + '.png'), optimize=True)
    man[name] = dict(x=round((x0 - CX) * S + 500, 2), y=round((y0 - SOLE) * S + 905, 2), w=round((x1 - x0) * S, 2), h=round((y1 - y0) * S, 2))
    if dbg: on(rgba, (120, 150, 190)).save(os.path.join(dbg, name + '.jpg'), quality=88)
    return rgba

# ---------------------------------------------------------------- hair behind, wings, tail
emit('hair_back', P['hair'])
wt = P['wt']; n, lab, st, cen = cv2.connectedComponentsWithStats((wt[..., 3] > 128).astype(np.uint8), connectivity=8)
big = sorted(range(1, n), key=lambda q: -st[q, cv2.CC_STAT_AREA])[:3]
tail_i = max(big, key=lambda q: cen[q][1]); wings = sorted([q for q in big if q != tail_i], key=lambda q: cen[q][0])
for name, q in (('wing_l', wings[0]), ('wing_r', wings[1]), ('tail', tail_i)):
    m = blur(dil(lab == q, 5), 0.8); r = wt.copy(); r[..., 3] *= np.clip(m * 1.4, 0, 1); emit(name, r)

# ---------------------------------------------------------------- body: front panels / legs / what is behind the legs
b = P['body']; rgb = b[..., :3]; fg = b[..., 3] > 128
line = (rgb.mean(2) < 150) & fg
n, lab, st, cen = cv2.connectedComponentsWithStats((fg & ~line).astype(np.uint8), connectivity=4)
def comps(seeds):
    m = np.zeros((H, W), bool)
    for (x, y) in seeds:
        if lab[y, x] == 0: raise SystemExit(f'seed {(x, y)} is on a line or outside the body plate')
        m |= lab == lab[y, x]
    return m
skin = comps([(718, 813)])
bootL = fill(close(comps([(714, 868), (696, 889), (734, 888), (717, 905), (717, 931)]), 9))
bootR = fill(close(comps([(793, 890), (811, 894), (812, 929), (810, 910)]), 9))
inner = comps([(761, 867), (763, 918), (675, 914), (855, 926)])
opening = fill(close(skin | bootL | bootR | inner, 11))
front_core = fg & ~line & ~opening
dist = lambda m: cv2.distanceTransform((~m).astype(np.uint8), cv2.DIST_L2, 5)
dF, dS, dBL, dBR, dI = dist(front_core), dist(skin), dist(bootL), dist(bootR), dist(inner)
cls = np.zeros((H, W), np.uint8)               # 1 front, 2 leg_l, 3 leg_r, 4 inner
cls[front_core] = 1; cls[skin | bootL] = 2; cls[bootR] = 3; cls[inner & ~bootL & ~bootR & ~skin] = 4
rest = fg & (cls == 0)
dLeg = np.minimum(np.minimum(dS, dBL), dBR); nearF = dF <= 7
legcls = np.where(dBR < np.minimum(dS, dBL), 3, 2).astype(np.uint8)
skin_near = (dS <= dBL) & (dS <= dBR)
c = np.ones((H, W), np.uint8)                                   # default: the stroke belongs to the front panels
near_leg = dLeg <= 7
c[near_leg & ~nearF] = legcls[near_leg & ~nearF]                # a leg's own outline
# Where a leg meets a front panel the stroke is the panel's edge, and stays on the panel: the opening's two edges
# above the knee, and the hem lying across the right boot. Everywhere else it is the leg's or the boot's own outline
# (also at the T-joints where that outline runs into a panel edge), so it must travel with the leg.
def top_of(m):
    t = np.full(W, H, np.int32); ys, xs = np.where(m); np.minimum.at(t, xs, ys); return t
above_boot = (yy < top_of(bootL)[None, :] + 1) | (yy < top_of(bootR)[None, :] + 1)
own = near_leg & nearF & np.where(skin_near, (dI <= 5) & (dI <= dF), ~above_boot[...] | (xx < 700))
c[own] = legcls[own]
c[~near_leg & (dI <= 7) & ~nearF] = 4
cls[rest] = c[rest]
soft = lambda m: np.clip(blur(m, 0.7) * 1.5 - 0.25, 0, 1)
body = b.copy(); body[..., 3] *= soft(cls == 1)
# the leg continues under the panels, so a swinging leg never shows its cut edge through the opening
legL = b.copy(); mL = cls == 2
ext = (xx >= 676) & (xx <= 758) & (yy >= 700) & (yy <= 862) & (cls == 1)
rowcol = np.zeros((H, 3), np.float32); have = np.zeros(H, bool)
for y in range(690, 870):
    px = rgb[y][skin[y]]
    if len(px) > 30: rowcol[y] = np.median(px, 0); have[y] = True
ys_have = np.where(have)[0]
for y in range(690, 870):
    if not have[y]: rowcol[y] = rowcol[ys_have[np.argmin(np.abs(ys_have - y))]]
for y in range(700, 863): legL[y, ext[y], :3] = rowcol[y]
# the panels shade the skin along the opening; that shading must not ride out from under the edge when the leg swings
din = cv2.distanceTransform(skin.astype(np.uint8), cv2.DIST_L2, 5)
wflat = (np.clip(1 - (din - 2) / 7, 0, 1) * (dF <= 14) * skin * (dI > 9))[..., None]
legL[..., :3] = legL[..., :3] * (1 - wflat) + rowcol[:, None, :] * wflat
legL[..., 3] = np.maximum(soft(mL), ext.astype(np.float32)) * 255
legR = b.copy(); mR = cls == 3; aR = soft(mR)
for x in range(W):
    col = np.where(mR[:, x])[0]
    if len(col) == 0: continue
    t = col.min()
    for y in range(max(t - 16, 0), t):
        if cls[y, x] == 1: legR[y, x, :3] = (252, 249, 253); aR[y, x] = 1
legR[..., 3] = aR * 255
# behind the legs: the inside of the skirt, with the legs painted out
unknown = (~(inner & (cls == 4))).astype(np.uint8)
x0, y0, x1, y1 = 640, 690, 900, 965
patch = cv2.inpaint(rgb[y0:y1, x0:x1].astype(np.uint8), unknown[y0:y1, x0:x1], 6, cv2.INPAINT_TELEA)
sb = np.zeros_like(b); sb[y0:y1, x0:x1, :3] = patch
# its lower edge is the back hem: small scallops with an outline, like the frills beside it
hem = 931 + 6 * np.abs(np.sin((xx - 640) * np.pi / 34))
region = dil(opening, 9) & (yy < hem) & (yy > 700)
edge = dil(opening, 9) & (yy >= hem - 2.6) & (yy < hem + 0.6)
sb[edge, :3] = (96, 70, 112)
sb[..., 3] = soft(region | edge) * 255
emit('skirt_back', sb); emit('leg_l', legL); emit('leg_r', legR); emit('body', body)

# ---------------------------------------------------------------- head
crgb = can[..., :3]; cfg = can[..., 3] > 128
sk = (crgb[..., 0] > 225) & (crgb[..., 0] - crgb[..., 2] > 9) & (crgb[..., 0] - crgb[..., 1] > 6) & cfg
sk = cv2.morphologyEx(sk.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(sk, connectivity=8)
face = fill(close(lab == lab[500, 700], 31)); faceD = dil(face, 11)
side = np.clip((515 - yy) / (515 - 465), 0, 1); side = side * side * (3 - 2 * side)       # hair below the ears hands over to hair_back
tass = blur((xx > 928) & (xx < 978) & (yy > 390) & (yy < 536), 2)                            # the ear tassel hangs lower than that
hm = np.maximum(np.maximum(side, blur(faceD, 1.0)), tass)
# blank face: skin from the plate where the eyes and mouth are
bl = P['blank']; d = np.abs(bl[..., :3] - crgb).max(2)
feat = (d > 22) & (xx > 600) & (xx < 925) & (yy > 335) & (yy < 512)
feat = cv2.morphologyEx(feat.astype(np.uint8), cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
n, lab, st, cen = cv2.connectedComponentsWithStats(feat, connectivity=8)
keep = np.zeros((H, W), bool)
for q in range(1, n):
    if st[q, cv2.CC_STAT_AREA] > 500: keep |= lab == q
hull = np.zeros((H, W), np.uint8)
n, lab, st, cen = cv2.connectedComponentsWithStats(close(keep, 27).astype(np.uint8), connectivity=8)
for q in range(1, n):                                           # an eye is taken whole: the convex outline of what changed
    pts = cv2.findNonZero((lab == q).astype(np.uint8)); cv2.fillConvexPoly(hull, cv2.convexHull(pts), 1)
region = dil(hull > 0, 11)
if dbg: Image.fromarray((region * 255).astype(np.uint8)).save(os.path.join(dbg, '_feat.png'))
n, lab, st, cen = cv2.connectedComponentsWithStats(region.astype(np.uint8), connectivity=8)
parts = sorted(range(1, n), key=lambda q: -st[q, cv2.CC_STAT_AREA])[:3]
mouth_i = max(parts, key=lambda q: cen[q][1]); eyes = sorted([q for q in parts if q != mouth_i], key=lambda q: cen[q][0])
fm = blur(region, 2.0)[..., None]
head = can.copy(); head[..., :3] = crgb * (1 - fm) + bl[..., :3] * fm; head[..., 3] *= hm
emit('head', head)
info = {}
for name, q in (('eye_l', eyes[0]), ('eye_r', eyes[1]), ('mouth_open', mouth_i)):
    m = lab == q; dd = np.abs(head[..., :3] - crgb).max(2)
    a = np.clip((blur(dil((dd > 14) & m, 3), 1.0) * 1.6), 0, 1) * blur(m, 1.0)
    e = can.copy(); e[..., 3] = a * 255; emit(name, e)
    x, y, w, h = st[q, 0], st[q, 1], st[q, 2], st[q, 3]; ys, xs = np.where((dd > 30) & m)
    info[name] = dict(cx=float(xs.mean()), cy=float(ys.mean()), x0=int(xs.min()), x1=int(xs.max()), y0=int(ys.min()), y1=int(ys.max()))
# closed eyes and closed mouth from the parts plate, scaled so a closed eye is as wide as the open one
pp = P['parts']; pa = pp[..., 3] > 128
n, lab, st, cen = cv2.connectedComponentsWithStats(pa.astype(np.uint8), connectivity=8)
trio = sorted(range(1, n), key=lambda q: -st[q, cv2.CC_STAT_AREA])[:3]
pm = max(trio, key=lambda q: cen[q][1]); pe = sorted([q for q in trio if q != pm], key=lambda q: cen[q][0])
def place(q, cx, cy, width, name):
    x, y, w, h = st[q, 0], st[q, 1], st[q, 2], st[q, 3]; crop = pp[y - 6:y + h + 6, x - 6:x + w + 6].copy()
    crop[..., 3] *= dil(lab[y - 6:y + h + 6, x - 6:x + w + 6] == q, 5)
    k = width / w; nw, nh = max(2, round(crop.shape[1] * k)), max(2, round(crop.shape[0] * k))
    pmul = crop.copy(); pmul[..., :3] *= crop[..., 3:4] / 255                     # premultiply before resampling
    r = cv2.resize(pmul, (nw, nh), interpolation=cv2.INTER_AREA); al = r[..., 3:4]; r[..., :3] = r[..., :3] / np.maximum(al / 255, 1e-3)
    full = np.zeros_like(can); X, Y = int(round(cx - nw / 2)), int(round(cy - nh / 2)); full[Y:Y + nh, X:X + nw] = r
    emit(name, full, pad=2)
for name, q, e in (('eye_l_closed', pe[0], 'eye_l'), ('eye_r_closed', pe[1], 'eye_r')):
    i = info[e]; place(q, (i['x0'] + i['x1']) / 2, i['y0'] + (i['y1'] - i['y0']) * 0.60, (i['x1'] - i['x0']) * 0.98, name)
i = info['mouth_open']; place(pm, i['cx'], i['y0'] + (i['y1'] - i['y0']) * 0.42, (i['x1'] - i['x0']) * 0.62, 'mouth_smile')
man['_face'] = {k: {q: round((v[q] - (CX if q in ('cx', 'x0', 'x1') else SOLE)) * S + (500 if q in ('cx', 'x0', 'x1') else 905), 1) for q in v} for k, v in info.items()}
json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
print(json.dumps(man))
