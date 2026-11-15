/* PetEngine v05 — a small mesh-deformation runtime for layered 2D characters.
 *
 * What it does (the parts v04 lacked):
 *   - every layer is a triangulated grid mesh, not a rigid sprite
 *   - linear-blend skinning to a bone hierarchy (soft joints, no visible seams)
 *   - "pre" deformers in rest space (pseudo-3D head turn, blink squash, breathing)
 *   - spring particles for secondary motion (hair strands, tail, skirt, ears, ahoge)
 * A character is a plain object (see characters/<name>/rig.js); the engine knows nothing about DeepSeek.
 */
(function (global) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---- 2D affine: [a, b, c, d, e, f] => x' = a x + c y + e ; y' = b x + d y + f
  const M = {
    id: () => [1, 0, 0, 1, 0, 0],
    mul(p, q, o) { // o = p * q
      const a = p[0] * q[0] + p[2] * q[1], b = p[1] * q[0] + p[3] * q[1];
      const c = p[0] * q[2] + p[2] * q[3], d = p[1] * q[2] + p[3] * q[3];
      const e = p[0] * q[4] + p[2] * q[5] + p[4], f = p[1] * q[4] + p[3] * q[5] + p[5];
      o[0] = a; o[1] = b; o[2] = c; o[3] = d; o[4] = e; o[5] = f; return o;
    },
    // local transform of a bone: rotate/scale about pivot (px,py), then translate
    local(px, py, rot, sx, sy, tx, ty, o) {
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const a = cs * sx, b = sn * sx, c = -sn * sy, d = cs * sy;
      o[0] = a; o[1] = b; o[2] = c; o[3] = d;
      o[4] = px + tx - (a * px + c * py); o[5] = py + ty - (b * px + d * py); return o;
    },
    ax: (m, x, y) => m[0] * x + m[2] * y + m[4],
    ay: (m, x, y) => m[1] * x + m[3] * y + m[5],
  };

  const VS = `attribute vec2 aPos; attribute vec2 aUV; uniform vec4 uView; varying vec2 vUV;
    void main(){ vUV=aUV; vec2 p=(aPos-uView.xy)/uView.zw; gl_Position=vec4(p.x*2.0-1.0, 1.0-p.y*2.0, 0.0, 1.0); }`;
  const FS = `precision mediump float; varying vec2 vUV; uniform sampler2D uTex; uniform float uAlpha;
    void main(){ gl_FragColor = texture2D(uTex, vUV) * uAlpha; }`;

  function loadImage(url) {
    return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('load ' + url)); im.src = url; });
  }

  class Pet {
    constructor(canvas, rig) {
      this.canvas = canvas; this.rig = rig; this.P = Object.assign({}, rig.params);
      const opt = { premultipliedAlpha: true, antialias: true, alpha: true, preserveDrawingBuffer: true };
      const gl = this.gl = canvas.getContext('webgl2', opt) || canvas.getContext('webgl', opt);
      if (!gl) throw new Error('WebGL unavailable');
      this.gl2 = (typeof WebGL2RenderingContext !== 'undefined') && gl instanceof WebGL2RenderingContext;
      const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const pr = this.prog = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      gl.useProgram(pr);
      this.loc = { pos: gl.getAttribLocation(pr, 'aPos'), uv: gl.getAttribLocation(pr, 'aUV'), view: gl.getUniformLocation(pr, 'uView'), alpha: gl.getUniformLocation(pr, 'uAlpha') };
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      // bones
      this.bones = rig.bones.map((b, i) => Object.assign({ i, rot: 0, sx: 1, sy: 1, tx: 0, ty: 0, phys: 0, L: M.id(), W: M.id() }, b));
      this.boneIx = {}; this.bones.forEach(b => this.boneIx[b.name] = b.i);
      this.bones.forEach(b => { b.p = b.parent == null ? -1 : this.boneIx[b.parent]; if (b.parent != null && !(b.p < b.i)) throw new Error('bone order ' + b.name); });
      this.springs = (rig.springs || []).map(s => Object.assign({ x: null, y: null, vx: 0, vy: 0 }, s, { b: this.boneIx[s.bone] }));
      this.layers = []; this.time = 0;
    }

    async load(base) {
      const gl = this.gl, rig = this.rig;
      const scratch = document.createElement('canvas'); const sctx = scratch.getContext('2d', { willReadFrequently: true });
      for (const def of rig.layers) {
        const img = await loadImage(base + def.file);
        const L = Object.assign({ alpha: 1, visible: true }, def); L.w = def.w || img.width; L.h = def.h || img.height;   // model-space size; texture may be any resolution
        scratch.width = img.width; scratch.height = img.height; sctx.clearRect(0, 0, img.width, img.height); sctx.drawImage(img, 0, 0);
        const A = sctx.getImageData(0, 0, img.width, img.height).data;
        const step = def.step || 22, nx = Math.max(1, Math.ceil(L.w / step)), ny = Math.max(1, Math.ceil(L.h / step));
        const cw = L.w / nx, ch = L.h / ny, kx = img.width / L.w, ky = img.height / L.h;
        const used = new Uint8Array(nx * ny);
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          let hit = 0; const x0 = Math.floor(i * cw * kx), x1 = Math.min(img.width, Math.ceil((i + 1) * cw * kx)), y0 = Math.floor(j * ch * ky), y1 = Math.min(img.height, Math.ceil((j + 1) * ch * ky));
          for (let y = y0; y < y1 && !hit; y += 2) for (let x = x0; x < x1; x += 2) if (A[(y * img.width + x) * 4 + 3] > 6) { hit = 1; break; }
          used[j * nx + i] = hit;
        }
        const vid = new Int32Array((nx + 1) * (ny + 1)).fill(-1); const rest = [], uv = [], idx = [];
        const v = (i, j) => { const k = j * (nx + 1) + i; if (vid[k] < 0) { vid[k] = rest.length / 2; rest.push(L.x + i * cw, L.y + j * ch); uv.push(i * cw / L.w, j * ch / L.h); } return vid[k]; };
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
          // keep a one-cell skirt around opaque cells so bilinear edges are never clipped
          let keep = 0; for (let dj = -1; dj <= 1 && !keep; dj++) for (let di = -1; di <= 1; di++) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < nx && b < ny && used[b * nx + a]) { keep = 1; break; } }
          if (!keep) continue; const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
          if ((i + j) & 1) idx.push(a, b, d, b, c, d); else idx.push(a, b, c, a, c, d);
        }
        L.n = rest.length / 2; L.rest = new Float32Array(rest); L.pre = new Float32Array(rest); L.pos = new Float32Array(rest);
        // skin weights (4 influences)
        L.bi = new Uint16Array(L.n * 4); L.bw = new Float32Array(L.n * 4); L.aux = new Float32Array(L.n);
        for (let k = 0; k < L.n; k++) {
          let list = def.bind(L.rest[2 * k], L.rest[2 * k + 1], this) || [];
          if (def.aux) L.aux[k] = def.aux(L.rest[2 * k], L.rest[2 * k + 1]);
          list = list.filter(e => e[1] > 1e-4).sort((p, q) => q[1] - p[1]).slice(0, 4);
          let s = 0; list.forEach(e => s += e[1]);
          list.forEach((e, q) => { const bi = this.boneIx[e[0]]; if (bi == null) throw new Error('unknown bone ' + e[0]); L.bi[4 * k + q] = bi; L.bw[4 * k + q] = e[1] / s; });
        }
        L.vbo = gl.createBuffer(); L.ubo = gl.createBuffer(); L.ibo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, L.ubo); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW); L.ni = idx.length;
        L.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, L.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        if (this.gl2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); }
        else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        this.layers.push(L);
      }
      this.layers.sort((a, b) => a.z - b.z);
      this.layerIx = {}; this.layers.forEach(l => this.layerIx[l.name] = l);
      this.solveBones(); this.resetSprings();
      return this;
    }

    solveBones(from) {
      const B = this.bones;
      for (let i = from || 0; i < B.length; i++) {
        const b = B[i]; M.local(b.px, b.py, b.rot + b.phys, b.sx, b.sy, b.tx, b.ty, b.L);
        if (b.p < 0) { b.W[0] = b.L[0]; b.W[1] = b.L[1]; b.W[2] = b.L[2]; b.W[3] = b.L[3]; b.W[4] = b.L[4]; b.W[5] = b.L[5]; } else M.mul(B[b.p].W, b.L, b.W);
      }
    }
    resetSprings() { for (const s of this.springs) { const b = this.bones[s.b]; s.x = M.ax(b.W, s.tx, s.ty); s.y = M.ay(b.W, s.tx, s.ty); s.vx = s.vy = 0; b.phys = 0; } }

    /* Spring particles. Each spring owns one bone: a particle chases the bone's rest tip (as carried by the
       parent), and the bone is rotated to point at the particle. `hang` (0..1) keeps the rest direction
       world-aligned instead of following parent rotation (long hair hangs; ears follow). */
    stepSprings(dt) {
      const B = this.bones; const sub = Math.max(1, Math.ceil(dt / (1 / 120))); const h = dt / sub;
      for (let it = 0; it < sub; it++) {
        for (const s of this.springs) {
          const b = B[s.b]; b.phys = 0; M.local(b.px, b.py, b.rot, b.sx, b.sy, b.tx, b.ty, b.L);
          const W = b.p < 0 ? b.L.slice() : M.mul(B[b.p].W, b.L, this._tmp || (this._tmp = M.id())); /* this bone without its own swing */
          const px = M.ax(W, b.px, b.py), py = M.ay(W, b.px, b.py);
          let gx = M.ax(W, s.tx, s.ty) - px, gy = M.ay(W, s.tx, s.ty) - py; // target tip relative to pivot
          const len = Math.hypot(gx, gy) || 1;
          if (s.hang) { const rx = s.tx - b.px, ry = s.ty - b.py, rl = Math.hypot(rx, ry) || 1; const k = s.hang; gx = lerp(gx, rx / rl * len, k); gy = lerp(gy, ry / rl * len, k); const gl2 = Math.hypot(gx, gy) || 1; gx *= len / gl2; gy *= len / gl2; }
          const wx = this.wind ? this.wind * (s.wind || 0) : 0;
          const ax = s.k * (px + gx - s.x) - s.c * s.vx + wx, ay = s.k * (py + gy - s.y) - s.c * s.vy;
          s.vx += ax * h; s.vy += ay * h; s.x += s.vx * h; s.y += s.vy * h;
          // keep length, limit swing
          let dx = s.x - px, dy = s.y - py; const dl = Math.hypot(dx, dy) || 1; dx *= len / dl; dy *= len / dl;
          let ang = Math.atan2(gx * dy - gy * dx, gx * dx + gy * dy); const lim = s.limit || 0.6;
          if (Math.abs(ang) > lim) { ang = clamp(ang, -lim, lim); const cs = Math.cos(ang), sn = Math.sin(ang); dx = gx * cs - gy * sn; dy = gx * sn + gy * cs; s.vx *= 0.5; s.vy *= 0.5; }
          s.x = px + dx; s.y = py + dy;
          // bone rotation relative to how the parent would have carried it
          const cx = M.ax(W, s.tx, s.ty) - px, cy = M.ay(W, s.tx, s.ty) - py;
          b.phys = Math.atan2(cx * dy - cy * dx, cx * dx + cy * dy);
          this.solveBones(s.b); // children (incl. later springs) see the swung parent
        }
      }
    }

    update(dt) {
      dt = Math.min(dt, 1 / 15); this.time += dt;
      this.rig.pose(this, this.P, dt);       // params -> bone locals (+ layer alphas)
      this.solveBones(); this.stepSprings(dt);
      const B = this.bones;
      for (const L of this.layers) {
        if (!L.visible || L.alpha <= 0.003) continue;
        const src = L.deform ? (L.deform(L, this.P, this), L.pre) : L.rest;
        const pos = L.pos, bi = L.bi, bw = L.bw;
        for (let k = 0; k < L.n; k++) {
          const x = src[2 * k], y = src[2 * k + 1]; let ox = 0, oy = 0;
          for (let q = 0; q < 4; q++) { const w = bw[4 * k + q]; if (w === 0) break; const m = B[bi[4 * k + q]].W; ox += w * (m[0] * x + m[2] * y + m[4]); oy += w * (m[1] * x + m[3] * y + m[5]); }
          pos[2 * k] = ox; pos[2 * k + 1] = oy;
        }
      }
    }

    draw() {
      const gl = this.gl, c = this.canvas, v = this.rig.view;
      gl.viewport(0, 0, c.width, c.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(this.prog); gl.uniform4f(this.loc.view, v.x, v.y, v.w, v.h);
      gl.enableVertexAttribArray(this.loc.pos); gl.enableVertexAttribArray(this.loc.uv);
      for (const L of this.layers) {
        if (!L.visible || L.alpha <= 0.003) continue;
        gl.bindBuffer(gl.ARRAY_BUFFER, L.vbo); gl.bufferData(gl.ARRAY_BUFFER, L.pos, gl.DYNAMIC_DRAW); gl.vertexAttribPointer(this.loc.pos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, L.ubo); gl.vertexAttribPointer(this.loc.uv, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, L.ibo); gl.bindTexture(gl.TEXTURE_2D, L.tex);
        gl.uniform1f(this.loc.alpha, L.alpha); gl.drawElements(gl.TRIANGLES, L.ni, gl.UNSIGNED_SHORT, 0);
      }
    }
  }

  /* ---- helpers characters use to describe weights --------------------------------------------- */
  // weights along a chain of joints; bones[k] pivots at joints[k]; `base` owns everything before joint 0
  function chainWeights(x, y, joints, bones, base) {
    let best = 1e9, s = 0;
    for (let k = 0; k < joints.length - 1; k++) {
      const ax = joints[k][0], ay = joints[k][1], bx = joints[k + 1][0], by = joints[k + 1][1];
      const dx = bx - ax, dy = by - ay; let t = ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy);
      const tc = (k === 0 && t < 0) ? Math.max(t, -1) : (k === joints.length - 2 && t > 1) ? t : clamp(t, 0, 1);
      const qx = ax + dx * tc, qy = ay + dy * tc, d = Math.hypot(x - qx, y - qy);
      if (d < best) { best = d; s = k + tc; }
    }
    const out = []; const add = (n, w) => { if (w > 0) out.push([n, w]); };
    if (s < 0) { const w = sstep(-0.6, 0.4, s); add(bones[0], w * 0.5); add(base, 1 - w * 0.5); return out; }
    const k = Math.min(Math.floor(s), bones.length - 1), t = s - k;
    if (t < 0.5) { const wp = 0.5 - 0.5 * sstep(0, 0.5, t); add(k === 0 ? base : bones[k - 1], wp); add(bones[k], 1 - wp); }
    else { const wn = (k + 1 < bones.length) ? 0.5 * sstep(0.5, 1, t) : 0; add(bones[k], 1 - wn); if (wn) add(bones[k + 1], wn); }
    return out;
  }
  function mix(a, wa, b, wb) { const o = []; a.forEach(e => o.push([e[0], e[1] * wa])); b.forEach(e => o.push([e[0], e[1] * wb])); const m = {}; o.forEach(e => m[e[0]] = (m[e[0]] || 0) + e[1]); return Object.keys(m).map(k => [k, m[k]]); }

  /* ---- tiny animation helpers ------------------------------------------------------------------ */
  const ease = {
    lin: t => t, io: t => t * t * (3 - 2 * t), in: t => t * t, out: t => 1 - (1 - t) * (1 - t),
    io3: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  };
  // keys: [[time, value, easeNameIntoThisKey], ...]
  function track(keys, t) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) if (t <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; const u = (t - a[0]) / (b[0] - a[0]); return lerp(a[1], b[1], (ease[b[2] || 'io'])(u)); }
    return keys[keys.length - 1][1];
  }

  global.PetEngine = { Pet, M, chainWeights, mix, ease, track, clamp, lerp, sstep };
})(typeof window !== 'undefined' ? window : globalThis);
