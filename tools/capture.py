"""Deterministic capture of the harness. usage: capture.py <outdir> <fps> <script-json> [--stills t1,t2,...] [--clip x,y,w,h]"""
import sys, json, asyncio, os, subprocess
from playwright.async_api import async_playwright
out, fps, script = sys.argv[1], int(sys.argv[2]), json.loads(sys.argv[3])
stills = None; rng = None; page = 'harness.html'; clip = dict(x=0, y=0, width=1280, height=720); x0 = 360
for a in sys.argv[4:]:
    if a.startswith('--stills='): stills = [float(v) for v in a[9:].split(',')]
    if a.startswith('--clip='): v = [float(q) for q in a[7:].split(',')]; clip = dict(x=v[0], y=v[1], width=v[2], height=v[3])
    if a.startswith('--x='): x0 = float(a[4:])
    if a.startswith('--page='): page = a[7:]
    if a.startswith('--range='): rng = [int(q) for q in a[8:].split(',')]
dur = script['dur']; ev = sorted(script['events'])
os.makedirs(out, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
        pg = await b.new_page(viewport=dict(width=1280, height=720))
        pg.on('console', lambda m: print('console:', m.text) if m.type == 'error' else None)
        await pg.goto(f'http://127.0.0.1:8123/{page}?x={x0}')
        try: await pg.wait_for_function('window.ready===true', timeout=20000)
        except Exception as e: print('not ready', await pg.evaluate('window.err||document.title')); raise
        n = int(dur * fps); ei = 0; si = 0
        for f in range(n):
            t = f / fps
            while ei < len(ev) and ev[ei][0] <= t + 1e-6: await pg.evaluate('s=>cap.cmd(s)', ev[ei][1]); ei += 1
            await pg.evaluate('dt=>cap.step(dt)', 1 / fps)
            if rng is not None and not (rng[0] <= f <= rng[1]): continue
            if stills is None: await pg.screenshot(path=f'{out}/f{f:05d}.jpg', clip=clip, type='jpeg', quality=93)
            elif si < len(stills) and t >= stills[si] - 1e-6: await pg.screenshot(path=f'{out}/s{si:03d}_{t:.2f}.png', clip=clip); si += 1
        await b.close()
asyncio.run(main())
