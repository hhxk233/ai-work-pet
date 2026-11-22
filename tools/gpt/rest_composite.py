"""Flat picture of the layered model at rest (eyes open, closed-mouth smile), at the drawing's resolution.
usage: python3 rest_composite.py <tex dir> <out.png> [--green]
Used as the size and style reference for pose sheets, and later to line pose sprites up with the model."""
import sys, os, json
import numpy as np
from PIL import Image
tex, out = sys.argv[1], sys.argv[2]; green = '--green' in sys.argv
CX, SOLE, S = 762.0, 961.0, 828.0 / 916.0
man = json.load(open(os.path.join(tex, 'manifest.json')))
c = Image.new('RGBA', (1536, 1024), (0, 177, 64, 255) if green else (0, 0, 0, 0))
for n in ['hair_back', 'wing_l', 'wing_r', 'tail', 'skirt_back', 'leg_l', 'leg_r', 'body', 'head', 'eye_l', 'eye_r', 'mouth_smile']:
    im = Image.open(os.path.join(tex, n + '.png')).convert('RGBA'); m = man[n]
    c.alpha_composite(im, (round((m['x'] - 500) / S + CX), round((m['y'] - 905) / S + SOLE)))
(c.convert('RGB') if green else c).save(out)
