"""Browser build of the GPT pet: copy the scripts and convert textures to WebP at one pixel per model unit.
usage: python3 tools/gpt/build_web.py            (run from the repository root; writes web/characters/gpt/)
Layers at quality 92, pose sprites at 90, the same settings as DeepSeek's web build."""
import os, json, shutil
from PIL import Image
src, out = 'characters/gpt', 'web/characters/gpt'
shutil.rmtree(out, ignore_errors=True); os.makedirs(out + '/tex/poses')
for f in ('rig.js', 'motions.js', 'load.js'): shutil.copy(f'{src}/{f}', f'{out}/{f}')
man = json.load(open(f'{src}/tex/manifest.json')); json.dump(man, open(f'{out}/tex/manifest.json', 'w'), indent=1)
for n, m in man.items():
    if n.startswith('_'): continue
    im = Image.open(f'{src}/tex/{n}.png').convert('RGBA').resize((max(1, round(m['w'])), max(1, round(m['h']))), Image.LANCZOS)
    im.save(f'{out}/tex/{n}.webp', quality=92, method=6)
poses = json.load(open(f'{src}/tex/poses/poses.json')); json.dump(poses, open(f'{out}/tex/poses/poses.json', 'w'), indent=1)
for n, p in poses.items():
    im = Image.open(f'{src}/tex/poses/{n}.png').convert('RGBA').resize((round(p['w']), round(p['h'])), Image.LANCZOS)
    im.save(f'{out}/tex/poses/{n}.webp', quality=90, method=6)
tot = sum(os.path.getsize(os.path.join(r, f)) for r, _, fs in os.walk(out) for f in fs)
print(f'{out}: {len(man) - 1} layers, {len(poses)} poses, {tot / 1e6:.1f} MB')
