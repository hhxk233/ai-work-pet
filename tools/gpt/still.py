"""One still of the harness with given raw parameters. usage: still.py out.png '<json params>' [--page=harness.html]"""
import sys, json, asyncio
from playwright.async_api import async_playwright
out, params = sys.argv[1], json.loads(sys.argv[2]); page = 'harness.html'
for a in sys.argv[3:]:
    if a.startswith('--page='): page = a[7:]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
        pg = await b.new_page(viewport=dict(width=1280, height=720))
        await pg.goto(f'http://127.0.0.1:8123/{page}?x=360'); await pg.wait_for_function('window.ready===true', timeout=20000)
        await pg.evaluate('p=>{ cap.pet.resetSprings(); for(let i=0;i<3;i++) cap.raw(p); }', params)
        await pg.screenshot(path=out, clip=dict(x=0, y=0, width=1280, height=720)); await b.close()
asyncio.run(main())
