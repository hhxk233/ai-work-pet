/* AI 桌宠 site companion: 大肥鱼 (DeepSeek) and 白龙娘 (GPT), switchable. Drop-in replacement for the earlier
 * widget: the site keeps loading `pet/widget.js`.
 * Self-contained: builds its own shadow tree, loads the engine and the chosen character relative to this file.
 * Behaviour chosen for a reading site:
 *   - loads only after the page is idle, so it never delays comics or charts
 *   - loads only the pet that is shown; another pet is fetched the first time the visitor switches to it
 *   - the choice of pet, and folding her away, are remembered
 *   - on phones, on comic reader pages and with reduced-motion it starts folded into a small button
 *   - only the character's body takes pointer events; the empty canvas around her never blocks the page
 */
(() => {
  if (document.querySelector('ai-pet-companion, deepseek-companion')) return;
  const base = new URL('.', document.currentScript.src);
  const PETS = {
    deepseek: { name: '大肥鱼', dir: 'characters/deepseek/', ext: 'DEEPSEEK_EXT', loader: 'loadDeepSeek', view: 60,
      acts: [['rice', '吃白米饭'], ['laptop', '电脑开工'], ['typing', '敲键盘'], ['think', '想一想'], ['wave', '挥手'], ['stretch', '伸懒腰'], ['whale', '抱鲸鱼'], ['rest', '休息'], ['jump', '跳一下']] },
    gpt: { name: '白龙娘', dir: 'characters/gpt/', ext: 'GPT_EXT', loader: 'loadGPT', view: 50,
      acts: [['cookie', '吃小饼干'], ['laptop', '笔记本'], ['mug', '喝一口'], ['think', '想一想'], ['wave', '挥手'], ['pout', '吃醋'], ['pillow', '白龙抱枕'], ['stretch', '伸懒腰'], ['sleep', '晚安'], ['jump', '跳一下']] },
  };
  const K_HIDE = 'deepseek-pet-hidden', K_OPEN = 'deepseek-pet-open', K_PET = 'ai-pet-choice';   // the first two keep the old widget's choices
  const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const set = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
  const reader = () => /^#\/episode\//.test(location.hash);
  const small = () => innerWidth < 620;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let cur = PETS[get(K_PET)] ? get(K_PET) : 'deepseek';

  const host = document.createElement('ai-pet-companion');
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
    button:hover,button[aria-pressed="true"],button[aria-checked="true"]{background:#e4edfb}
    .menu{position:fixed;display:flex;flex-direction:column;min-width:128px;padding:5px;border-radius:14px}
    .menu button{text-align:left;border-radius:9px}
    .menu .who{font-size:12px;color:#6d7fa3;padding:4px 11px 2px}
    .fold{position:fixed;right:14px;bottom:12px;border-radius:999px;padding:9px 14px}
    @media(max-width:620px){.dock{right:8px;bottom:8px} button{padding:7px 9px;font-size:12px} .fold{right:8px;bottom:8px}}
  </style>
  <div class="stage"></div><div class="hit"></div>
  <nav class="dock"><button data-auto aria-pressed="true">自己逛</button><button data-menu>动作</button><button data-pets>换桌宠</button><button data-fold>收起</button></nav>
  <div class="menu" role="menu" hidden></div>
  <button class="fold" hidden></button>`;
  const $ = s => root.querySelector(s), stage = $('.stage'), hit = $('.hit'), dock = $('.dock'), menu = $('.menu'), fold = $('.fold');
  const label = () => { const n = PETS[cur].name;
    hit.setAttribute('aria-label', `${n}桌宠，点一下会跳，可拖动，右键或长按选动作`); dock.setAttribute('aria-label', n);
    dock.querySelector('[data-fold]').setAttribute('aria-label', `收起${n}`); fold.textContent = n; fold.setAttribute('aria-label', `展开${n}桌宠`); };
  label();

  const loadScript = n => new Promise((ok, no) => { const s = document.createElement('script'); s.src = new URL(n, base); s.onload = ok; s.onerror = no; document.head.append(s); });
  let engine = null; const apps = {}, loading = {};
  const VW = 900, VH = 990, dpr = Math.min(2, devicePixelRatio || 1);
  let H, W, S;
  const size = () => { H = small() ? 170 : 230; W = H * VW / VH; S = H / VH;
    for (const k in apps) { const c = apps[k].canvas; c.style.width = W + 'px'; c.style.height = H + 'px'; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    hit.style.width = W * 0.5 + 'px'; hit.style.height = H * 0.86 + 'px'; };

  async function boot(key) {                      // one canvas and one WebGL context per pet, made the first time she is shown
    const P = PETS[key];
    engine = engine || (async () => { await loadScript('engine/pet-engine.js'); await loadScript('engine/director.js'); })();
    await engine;
    window[P.ext] = '.webp';
    for (const f of ['rig.js', 'motions.js', 'load.js']) await loadScript(P.dir + f);
    const canvas = document.createElement('canvas'); canvas.hidden = true; stage.append(canvas);
    apps[key] = { canvas }; size();
    const { pet, director } = await window[P.loader](canvas, new URL(P.dir, base).href);
    return Object.assign(apps[key], { pet, director });
  }
  const getApp = key => apps[key] && apps[key].pet ? Promise.resolve(apps[key]) : (loading[key] = loading[key] || boot(key));

  // ---- one loop drives whichever pet is shown
  let app = null, x = null, auto = true, idle = 0, next = 6, walkLeft = 0, press = null, raf = 0, last = 0, on = false;
  const act = a => { menu.hidden = true; idle = 0; if (!app) return; app.director.halt(); walkLeft = 0; app.director.play(a); };
  const openMenu = (px, py, html) => { menu.innerHTML = html; menu.hidden = false; const r = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(px, innerWidth - r.width - 8)) + 'px'; menu.style.top = Math.max(8, Math.min(py - r.height, innerHeight - r.height - 8)) + 'px'; };
  const actsMenu = () => PETS[cur].acts.map(a => `<button role="menuitem" data-act="${a[0]}">${a[1]}</button>`).join('');
  const petsMenu = () => '<div class="who">换一个桌宠</div>' + Object.keys(PETS).map(k => `<button role="menuitemradio" aria-checked="${k === cur}" data-pet="${k}">${PETS[k].name}</button>`).join('');
  menu.onclick = e => { const b = e.target.closest('[data-act]'), p = e.target.closest('[data-pet]'); if (b) act(b.dataset.act); if (p) { menu.hidden = true; switchTo(p.dataset.pet); } };
  const fromDock = (btn, html) => { if (menu.hidden || menu.dataset.kind !== btn) { const r = dock.getBoundingClientRect(); menu.dataset.kind = btn; openMenu(r.left, r.top - 6, html); } else menu.hidden = true; };
  dock.querySelector('[data-menu]').onclick = e => { e.stopPropagation(); fromDock('acts', actsMenu()); };
  dock.querySelector('[data-pets]').onclick = e => { e.stopPropagation(); fromDock('pets', petsMenu()); };
  dock.querySelector('[data-auto]').onclick = e => { auto = !auto; e.currentTarget.setAttribute('aria-pressed', auto); if (!auto && app) { app.director.halt(); walkLeft = 0; } };
  hit.addEventListener('pointerdown', e => { if (e.button === 2 || !app) return; hit.setPointerCapture(e.pointerId); press = { px: e.clientX, py: e.clientY, x0: x, moved: false, v: 0, timer: setTimeout(() => { if (press && !press.moved) { menu.dataset.kind = 'acts'; openMenu(press.px, press.py, actsMenu()); press = null; } }, 520) }; });
  hit.addEventListener('pointermove', e => { if (!press) return; const dx = e.clientX - press.px; if (!press.moved && Math.hypot(dx, e.clientY - press.py) > 5) { press.moved = true; clearTimeout(press.timer); hit.classList.add('drag'); app.director.halt(); walkLeft = 0; } if (press.moved) { const nx = press.x0 + dx; press.v = nx - x; x = nx; } });
  const up = () => { if (!press) return; clearTimeout(press.timer); hit.classList.remove('drag'); if (!press.moved && app && !app.director.busy) act('jump'); press = null; };
  hit.addEventListener('pointerup', up); hit.addEventListener('pointercancel', up);
  hit.addEventListener('contextmenu', e => { e.preventDefault(); menu.dataset.kind = 'acts'; openMenu(e.clientX, e.clientY, actsMenu()); });
  addEventListener('pointerdown', e => { if (!e.composedPath().includes(menu) && !e.composedPath().includes(dock)) menu.hidden = true; });
  addEventListener('resize', size);
  const frame = now => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now; const { pet, director } = app;
    if (walkLeft > 0) { walkLeft -= dt; if (walkLeft <= 0) director.halt(); }
    else if (auto && !press && !director.busy && director.walkW === 0) { idle += dt; if (idle > next) { idle = 0; next = 7 + Math.random() * 9; const r = Math.random();
      if (r < 0.5) { const mid = x + W / 2; director.walk(mid < innerWidth * 0.3 ? 1 : mid > innerWidth * 0.8 ? -1 : (Math.random() < 0.5 ? -1 : 1)); walkLeft = 1.4 + Math.random() * 2; }
      else { const A = PETS[cur].acts; director.play(A[Math.floor(Math.random() * A.length)][0]); } } }
    director.update(pet, dt);
    if (press && press.moved) { pet.P.lean += Math.max(-14, Math.min(14, press.v * 1.4)); press.v *= 0.8; }
    pet.update(dt); pet.draw();
    x += director.vx * S * dt; const lo = -W * 0.2, hi = innerWidth - W * 0.8;
    if (x < lo) { x = lo; if (director.walkTarget) director.walk(1); } if (x > hi) { x = hi; if (director.walkTarget) director.walk(-1); }
    app.canvas.style.transform = `translate3d(${x}px,0,0)`; hit.style.transform = `translate3d(${x + W * 0.25}px,0,0)`;
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (on) return; on = true; last = performance.now(); raf = requestAnimationFrame(frame); };
  const stop = () => { on = false; cancelAnimationFrame(raf); };

  async function switchTo(key) {
    if (!PETS[key]) return; cur = key; set(K_PET, key); label();
    if (!fold.hidden) return;                     // folded: the new pet is loaded when she is opened
    try {
      const a = await getApp(key); if (cur !== key) return;
      if (app && app !== a) { app.canvas.hidden = true; app.director.halt(); }
      app = a; app.canvas.hidden = false; walkLeft = 0; idle = 0; press = null; app.director.play('happy');
      window.petCompanion = { pet: app.pet, director: app.director, name: key, switchTo };
    } catch (e) { console.error('Pet failed to load', key, e); }
  }
  async function show(byUser) {
    fold.hidden = true; if (byUser) { set(K_HIDE, null); set(K_OPEN, '1'); }
    try {
      const a = await getApp(cur); if (app && app !== a) app.canvas.hidden = true; app = a;
      size(); if (x == null) x = Math.max(8, innerWidth - W - (small() ? 70 : 230));
      app.canvas.hidden = hit.hidden = dock.hidden = false; start();
      window.petCompanion = { pet: app.pet, director: app.director, name: cur, switchTo };
    } catch (e) { console.error('Companion failed to load', e); host.remove(); }
  }
  function hide(byUser) { stop(); if (app) app.canvas.hidden = true; hit.hidden = dock.hidden = true; menu.hidden = true; fold.hidden = false; if (byUser) { set(K_HIDE, '1'); set(K_OPEN, null); } }
  dock.querySelector('[data-fold]').onclick = () => hide(true); fold.onclick = () => show(true);

  // start folded where she would be in the way, unless the visitor opened her before
  const wantFolded = () => get(K_HIDE) === '1' || (get(K_OPEN) !== '1' && (small() || reader() || calm()));
  const begin = () => { document.body.append(host); if (wantFolded()) hide(false); else show(false); };
  addEventListener('hashchange', () => { if (get(K_OPEN) !== '1' && get(K_HIDE) !== '1') { if (reader() || small()) hide(false); else show(false); } });
  const idleStart = () => (window.requestIdleCallback ? requestIdleCallback(begin, { timeout: 2500 }) : setTimeout(begin, 600));
  if (document.readyState === 'complete') idleStart(); else addEventListener('load', idleStart, { once: true });
})();
