/* 大肥鱼 site companion (v05). Drop-in replacement for the v04 widget: the site keeps loading `pet/widget.js`.
 * Self-contained: builds its own shadow tree, loads the engine and character relative to this file.
 * Behaviour chosen for a reading site:
 *   - loads only after the page is idle, so it never delays comics or charts
 *   - on phones, on comic reader pages and with reduced-motion it starts folded into a small button
 *   - only the character's body takes pointer events; the empty canvas around her never blocks the page
 */
(() => {
  if (document.querySelector('deepseek-companion')) return;
  const base = new URL('.', document.currentScript.src);
  const K_HIDE = 'deepseek-pet-hidden', K_OPEN = 'deepseek-pet-open';
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const reader = () => /^#\/episode\//.test(location.hash);
  const small = () => innerWidth < 620;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const host = document.createElement('deepseek-companion');
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1000';
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<style>
    :host{font:13px/1.5 system-ui,"PingFang SC","Microsoft YaHei",sans-serif;color:#22304f}
    *{box-sizing:border-box} [hidden]{display:none!important}
    canvas{position:fixed;left:0;bottom:0;pointer-events:none}
    .hit{position:fixed;bottom:0;pointer-events:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none}
    .hit.drag{cursor:grabbing}
    .dock,.menu,.fold{pointer-events:auto;background:rgba(255,255,255,.92);border:1px solid #d5e0f0;box-shadow:0 6px 20px rgba(40,60,110,.12)}
    .dock{position:fixed;right:14px;bottom:12px;display:flex;gap:2px;padding:3px;border-radius:999px}
    button{font:inherit;color:inherit;background:transparent;border:0;border-radius:999px;padding:7px 11px;cursor:pointer}
    button:hover,button[aria-pressed="true"]{background:#e4edfb}
    .menu{position:fixed;display:flex;flex-direction:column;min-width:128px;padding:5px;border-radius:14px}
    .menu button{text-align:left;border-radius:9px}
    .fold{position:fixed;right:14px;bottom:12px;border-radius:999px;padding:9px 14px}
    @media(max-width:620px){.dock{right:8px;bottom:8px} button{padding:7px 9px;font-size:12px} .fold{right:8px;bottom:8px}}
  </style>
  <canvas></canvas><div class="hit" aria-label="大肥鱼桌宠，点一下会跳，可拖动，右键或长按选动作"></div>
  <nav class="dock" aria-label="大肥鱼"><button data-auto aria-pressed="true">自己逛</button><button data-menu>动作</button><button data-fold aria-label="收起桌宠">收起</button></nav>
  <div class="menu" role="menu" hidden></div>
  <button class="fold" hidden aria-label="展开大肥鱼桌宠">大肥鱼</button>`;
  const $ = s => root.querySelector(s), canvas = $('canvas'), hit = $('.hit'), dock = $('.dock'), menu = $('.menu'), fold = $('.fold');
  const ACTS = [['rice', '吃白米饭'], ['laptop', '电脑开工'], ['typing', '敲键盘'], ['think', '想一想'], ['wave', '挥手'], ['stretch', '伸懒腰'], ['whale', '抱鲸鱼'], ['rest', '休息'], ['jump', '跳一下']];
  menu.innerHTML = ACTS.map(a => `<button role="menuitem" data-act="${a[0]}">${a[1]}</button>`).join('');

  const loadScript = n => new Promise((ok, no) => { const s = document.createElement('script'); s.src = new URL(n, base); s.onload = ok; s.onerror = no; document.head.append(s); });
  let app = null, loading = null;

  async function boot() {
    window.DEEPSEEK_EXT = '.webp';
    await loadScript('engine/pet-engine.js'); await loadScript('engine/director.js'); await loadScript('characters/deepseek/rig.js'); await loadScript('characters/deepseek/motions.js'); await loadScript('characters/deepseek/load.js');
    const VW = 900, VH = 990, dpr = Math.min(2, devicePixelRatio || 1);
    let H, W, S; const size = () => { H = small() ? 170 : 230; W = H * VW / VH; S = H / VH; canvas.style.width = W + 'px'; canvas.style.height = H + 'px'; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); hit.style.width = W * 0.5 + 'px'; hit.style.height = H * 0.86 + 'px'; };
    size();
    const { pet, director } = await window.loadDeepSeek(canvas, new URL('characters/deepseek/', base).href);
    let x = Math.max(8, innerWidth - W - (small() ? 70 : 230)), auto = true, idle = 0, next = 6, walkLeft = 0, press = null, raf = 0, last = 0, on = false;
    const act = a => { menu.hidden = true; idle = 0; director.halt(); walkLeft = 0; director.play(a); };
    const openMenu = (px, py) => { menu.hidden = false; const r = menu.getBoundingClientRect(); menu.style.left = Math.max(8, Math.min(px, innerWidth - r.width - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(py - r.height, innerHeight - r.height - 8)) + 'px'; };
    menu.onclick = e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); };
    dock.querySelector('[data-menu]').onclick = e => { e.stopPropagation(); if (menu.hidden) { const r = dock.getBoundingClientRect(); openMenu(r.left, r.top - 6); } else menu.hidden = true; };
    dock.querySelector('[data-auto]').onclick = e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); if (!auto) { director.halt(); walkLeft = 0; } };
    hit.addEventListener('pointerdown', e => { if (e.button === 2) return; hit.setPointerCapture(e.pointerId); press = { px: e.clientX, py: e.clientY, x0: x, moved: false, v: 0, timer: setTimeout(() => { if (press && !press.moved) { openMenu(press.px, press.py); press = null; } }, 520) }; });
    hit.addEventListener('pointermove', e => { if (!press) return; const dx = e.clientX - press.px; if (!press.moved && Math.hypot(dx, e.clientY - press.py) > 5) { press.moved = true; clearTimeout(press.timer); hit.classList.add('drag'); director.halt(); walkLeft = 0; } if (press.moved) { const nx = press.x0 + dx; press.v = nx - x; x = nx; } });
    const up = () => { if (!press) return; clearTimeout(press.timer); hit.classList.remove('drag'); if (!press.moved && !director.busy) act('jump'); press = null; };
    hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
    hit.addEventListener('contextmenu', e => { e.preventDefault(); openMenu(e.clientX, e.clientY); });
    addEventListener('pointerdown', e => { if (!e.composedPath().includes(menu) && !e.composedPath().includes(dock)) menu.hidden = true; });
    addEventListener('resize', size);
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
      if (walkLeft > 0) { walkLeft -= dt; if (walkLeft <= 0) director.halt(); }
      else if (auto && !press && !director.busy && director.walkW === 0) { idle += dt; if (idle > next) { idle = 0; next = 7 + Math.random() * 9; const r = Math.random();
        if (r < 0.5) { const mid = x + W / 2; director.walk(mid < innerWidth * 0.3 ? 1 : mid > innerWidth * 0.8 ? -1 : (Math.random() < 0.5 ? -1 : 1)); walkLeft = 1.4 + Math.random() * 2; }
        else director.play(ACTS[Math.floor(Math.random() * ACTS.length)][0]); } }
      director.update(pet, dt);
      if (press && press.moved) { pet.P.lean += Math.max(-14, Math.min(14, press.v * 1.4)); press.v *= 0.8; }
      pet.update(dt); pet.draw();
      x += director.vx * S * dt; const lo = -W * 0.2, hi = innerWidth - W * 0.8;
      if (x < lo) { x = lo; if (director.walkTarget) director.walk(1); } if (x > hi) { x = hi; if (director.walkTarget) director.walk(-1); }
      canvas.style.transform = `translate3d(${x}px,0,0)`; hit.style.transform = `translate3d(${x + W * 0.25}px,0,0)`;
      raf = requestAnimationFrame(frame);
    };
    return { start() { if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); }, stop() { on = false; cancelAnimationFrame(raf); }, pet, director };
  }

  async function show(byUser) {
    fold.hidden = true; if (byUser) { set(K_HIDE, null); set(K_OPEN, '1'); }
    try { app = app || await (loading = loading || boot()); canvas.hidden = hit.hidden = dock.hidden = false; app.start(); window.petCompanion = app; }
    catch (e) { console.error('Companion failed to load', e); host.remove(); }
  }
  function hide(byUser) { if (app) app.stop(); canvas.hidden = hit.hidden = dock.hidden = true; menu.hidden = true; fold.hidden = false; if (byUser) { set(K_HIDE, '1'); set(K_OPEN, null); } }
  dock.querySelector('[data-fold]').onclick = () => hide(true); fold.onclick = () => show(true);

  // start folded where she would be in the way, unless the visitor opened her before
  const wantFolded = () => get(K_HIDE) === '1' || (get(K_OPEN) !== '1' && (small() || reader() || calm()));
  const begin = () => { document.body.append(host); if (wantFolded()) hide(false); else show(false); };
  addEventListener('hashchange', () => { if (get(K_OPEN) !== '1' && get(K_HIDE) !== '1') { if (reader() || small()) hide(false); else show(false); } });
  const idleStart = () => (window.requestIdleCallback ? requestIdleCallback(begin, { timeout: 2500 }) : setTimeout(begin, 600));
  if (document.readyState === 'complete') idleStart(); else addEventListener('load', idleStart, { once: true });
})();
