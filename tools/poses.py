"""Render static poses to a contact sheet. usage: poses.py out.jpg '<json list of param dicts>' [cols] [clip]"""
import sys, json, asyncio, io
from playwright.async_api import async_playwright
from PIL import Image
out, poses = sys.argv[1], json.loads(sys.argv[2]); cols = int(sys.argv[3]) if len(sys.argv) > 3 else 4
clip = [float(v) for v in sys.argv[4].split(',')] if len(sys.argv) > 4 else [330, 40, 620, 660]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
        pg = await b.new_page(viewport=dict(width=1280, height=720))
        pg.on('console', lambda m: print('console:', m.text) if m.type == 'error' and '404' not in m.text else None)
        await pg.goto('http://127.0.0.1:8123/harness.html'); await pg.wait_for_function('window.ready===true', timeout=20000)
        ims = []
        for ps in poses:
            for i in range(25): await pg.evaluate('p=>cap.raw(p)', ps)
            ims.append(Image.open(io.BytesIO(await pg.screenshot(clip=dict(x=clip[0], y=clip[1], width=clip[2], height=clip[3])))).convert('RGB'))
        await b.close()
        w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
        sh = Image.new('RGB', (cols * w, rows * h), 'white')
        for i, im in enumerate(ims): sh.paste(im, ((i % cols) * w, (i // cols) * h))
        sh.save(out, quality=88); print(sh.size)
asyncio.run(main())
