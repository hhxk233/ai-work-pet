"""Cut two-figure pose sheets (flat green, drawn on art_in/ref/template_2up.png) into pose sprites for the GPT pet.
usage: python3 cut_poses.py <sheets dir> <out poses dir>          (rewrites <out>/poses.json)

Most sheets are edits of the template, so a figure keeps the template's place: body axis at x=384 or x=1152,
soles at y=915, 760 px tall. That fixes where the sprite goes in model space; nothing is measured per sprite.
Figures that could not be drawn in place (sitting, lying, the two jump poses) are marked 'free': their lowest
point is put on the ground, and for sitting and jumping the midpoint between the horn tips is put where the
template has it, so the head does not step sideways when the pet sits down.
A sheet is looked up as <name>.png; register it below with the two pose names and their kind (stand, sit, lie)."""
import sys, os, json
import numpy as np, cv2
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from keylib import key
src, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
K = (828.0 / 916.0) / (760.0 / 917.0)        # sheet px -> model units (the template figure is the 917 px rest picture scaled to 760)
AXIS, SOLE = (385.0, 1153.0), 915.0          # the template's axes are 384 and 1152; measured against the model, the heads sit 1 px to the right
SHEETS = {
    'cookie_a': [('cookie0', 'stand'), ('cookie1', 'stand')], 'cookie_b': [('cookie2', 'stand'), ('cookie3', 'stand')],
    'wave': [('wave0', 'stand'), ('wave1', 'stand')], 'pout': [('pout0', 'stand'), ('pout1', 'stand')],
    'mug': [('mug0', 'stand'), ('mug1', 'stand')], 'think': [('think0', 'stand'), ('think1', 'stand')],
    'stretch': [('stretch0', 'stand'), ('stretch1', 'stand')],
    'laptop_a': [('laptop0', 'stand'), ('laptop1', 'sit', 'free')], 'laptop_b': [('laptop2', 'sit', 'free'), ('laptop3', 'sit', 'free')],
    'laptop_open': [('laptop_o0', 'sit', 'free'), ('laptop_o1', 'sit', 'free')],      # closed on the ground, lid part way up
    'pillow': [('pillow0', 'stand'), ('pillow1', 'lie', 'free')], 'sleep': [('sleep0', 'sit', 'free'), ('sleep1', 'lie', 'free')],
    'jump': [('jump0', 'stand', 'free'), ('jump1', 'stand', 'free')],
}
GROUND, HORN_MID = 914, 5.5                   # on the template: lowest row of a figure, and horn-tip midpoint minus the axis
poses = {}
for sheet, figs in SHEETS.items():
    p = os.path.join(src, sheet + '.png')
    if not os.path.exists(p): print('missing', p); continue
    im = key(p); a = im[..., 3]; H, W = a.shape
    n, lab, st, cen = cv2.connectedComponentsWithStats((a > 128).astype(np.uint8), connectivity=8)
    for i, fig in enumerate(figs):
        name, kind, free = fig[0], fig[1], len(fig) > 2
        if name == '-': continue
        cand = [q for q in range(1, n) if (cen[q][0] < W / 2) == (i == 0)]
        q = max(cand, key=lambda q: st[q, cv2.CC_STAT_AREA])
        m = cv2.dilate((lab == q).astype(np.uint8), np.ones((5, 5), np.uint8)) > 0
        x0, y0, w, h = st[q, 0], st[q, 1], st[q, 2], st[q, 3]
        dx = dy = 0.0
        if free:
            dy = GROUND - (y0 + h)
            if kind != 'lie':
                cols = np.where((lab[y0:y0 + 70] == q).any(0))[0]; mid = (cols.min() + cols.max()) / 2
                L, R = cols[cols < mid], cols[cols >= mid]; dx = HORN_MID - (((L.min() + L.max()) / 2 + (R.min() + R.max()) / 2) / 2 - (AXIS[i] - 1))
        x0, y0, x1, y1 = max(x0 - 3, 0), max(y0 - 3, 0), min(x0 + w + 3, W), min(y0 + h + 3, H)
        crop = im[y0:y1, x0:x1].copy(); crop[..., 3] *= m[y0:y1, x0:x1]
        rgb = crop[..., :3].astype(np.uint8); al = crop[..., 3]; hole = (al < 8).astype(np.uint8)       # bleed colour under the edge
        f = cv2.inpaint(rgb, hole, 3, cv2.INPAINT_NS); near = cv2.dilate((al >= 8).astype(np.uint8), np.ones((9, 9), np.uint8)) > 0
        rgb[(hole > 0) & near] = f[(hole > 0) & near]
        Image.fromarray(np.dstack([rgb, np.clip(al, 0, 255).astype(np.uint8)]), 'RGBA').save(os.path.join(out, name + '.png'), optimize=True)
        poses[name] = dict(x=round(float((x0 + dx - AXIS[i]) * K + 500), 2), y=round(float((y0 + dy - SOLE) * K + 905), 2), w=round(float((x1 - x0) * K), 2), h=round(float((y1 - y0) * K), 2), kind=kind)
        print(name, poses[name], ('moved %+.1f, %+.1f px' % (dx, dy)) if free else '')
json.dump(poses, open(os.path.join(out, 'poses.json'), 'w'), indent=1)
