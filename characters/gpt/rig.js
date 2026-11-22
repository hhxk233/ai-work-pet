/* GPT「白龙娘」— rig description for PetEngine.
 * Model space is 1024×1024 units; tex/manifest.json places each texture in it (textures keep the drawing's
 * resolution, so they are a little larger than their model-space size).
 * Everything character-specific lives here: layer order, bones, skin weights, deformers, springs.
 * What she has that DeepSeek does not: two wings, a heavy tail lying on the ground, a long dress with an
 * opening at the front (so the legs sit between the inside of the skirt and its front panels), horns, an ear tassel.
 */
(function (g) {
  'use strict';
  const { chainWeights, mix, sstep, clamp, lerp } = g.PetEngine;
  const D2R = Math.PI / 180;

  // ---- landmarks (model units) ----------------------------------------------------------------
  const HEAD_C = [503, 338], HEAD_R = [250, 222];            // ellipsoid used for the pseudo-3D turn
  const HAIR_X = [212, 330, 500, 668, 786], HAIR_Y = [548, 652, 756, 866];
  const TAIL = [[562, 696], [600, 780], [660, 850], [740, 870], [790, 830], [802, 780], [800, 738]];   // root (hidden) ... ground ... the curl at the tip
  const AHOGE = [[482, 164], [474, 114], [552, 104]];
  const WING_L = [[412, 602], [300, 600], [150, 716]], WING_R = [[598, 602], [706, 600], [852, 716]];
  const TASSEL = [[670, 436], [670, 476], [670, 514]];

  const bones = [
    { name: 'root', px: 500, py: 905 },
    { name: 'legL', parent: 'root', px: 459, py: 800 }, { name: 'legR', parent: 'root', px: 545, py: 850 },
    { name: 'hip', parent: 'root', px: 500, py: 770 },
    { name: 'skirtL', parent: 'hip', px: 360, py: 700 }, { name: 'skirtC', parent: 'hip', px: 500, py: 720 }, { name: 'skirtR', parent: 'hip', px: 640, py: 700 },
    // the tail lies on the ground, so it hangs off the root, not the hips: it must not lift when she bobs
    { name: 'tail0', parent: 'root', px: TAIL[0][0], py: TAIL[0][1] }, { name: 'tail1', parent: 'tail0', px: TAIL[1][0], py: TAIL[1][1] },
    { name: 'tail2', parent: 'tail1', px: TAIL[2][0], py: TAIL[2][1] }, { name: 'tail3', parent: 'tail2', px: TAIL[3][0], py: TAIL[3][1] },
    { name: 'tail4', parent: 'tail3', px: TAIL[4][0], py: TAIL[4][1] }, { name: 'tail5', parent: 'tail4', px: TAIL[5][0], py: TAIL[5][1] },
    { name: 'chest', parent: 'hip', px: 500, py: 660 },
    { name: 'wingL0', parent: 'chest', px: WING_L[0][0], py: WING_L[0][1] }, { name: 'wingL1', parent: 'wingL0', px: WING_L[1][0], py: WING_L[1][1] },
    { name: 'wingR0', parent: 'chest', px: WING_R[0][0], py: WING_R[0][1] }, { name: 'wingR1', parent: 'wingR0', px: WING_R[1][0], py: WING_R[1][1] },
    { name: 'head', parent: 'chest', px: 500, py: 504 },
    { name: 'earL', parent: 'head', px: 318, py: 440 }, { name: 'earR', parent: 'head', px: 690, py: 432 },
    { name: 'tassel0', parent: 'head', px: TASSEL[0][0], py: TASSEL[0][1] }, { name: 'tassel1', parent: 'tassel0', px: TASSEL[1][0], py: TASSEL[1][1] },
    { name: 'ahoge0', parent: 'head', px: AHOGE[0][0], py: AHOGE[0][1] }, { name: 'ahoge1', parent: 'ahoge0', px: AHOGE[1][0], py: AHOGE[1][1] },
  ];
  const springs = [];
  // five hair strands, three segments each; long loose waves: they hang and lag well behind the head
  HAIR_X.forEach((x, c) => {
    for (let k = 0; k < 3; k++) {
      bones.push({ name: 'hair' + c + k, parent: k ? 'hair' + c + (k - 1) : 'head', px: x, py: HAIR_Y[k] });
      const outer = (c === 0 || c === 4) ? 1 : (c === 2 ? 0.5 : 0.8);
      // Her hair is long and heavy: stiff, well damped and all strands alike, so it sways as one mass. Strands with
      // different stiffness or wind drift out of phase and the hair reads as jelly.
      springs.push({ bone: 'hair' + c + k, tx: x, ty: HAIR_Y[k + 1], k: (120 - k * 22) / outer, c: 13 - k * 1.5, hang: k === 0 ? 0.7 : 0.3, limit: 0.12 + k * 0.04, wind: 0.35 + k * 0.2 });
    }
  });
  springs.push(
    { bone: 'skirtL', tx: 300, ty: 880, k: 130, c: 11, hang: 0.5, limit: 0.16, wind: 0.3 },
    { bone: 'skirtC', tx: 500, ty: 885, k: 160, c: 12, hang: 0.5, limit: 0.10, wind: 0.15 },
    { bone: 'skirtR', tx: 700, ty: 880, k: 130, c: 11, hang: 0.5, limit: 0.16, wind: 0.3 },
    // the thick part of the tail is a rigid weight on the ground; only the last bend gives a little and the curl is free
    { bone: 'tail4', tx: TAIL[5][0], ty: TAIL[5][1], k: 220, c: 16, limit: 0.05 },
    { bone: 'tail5', tx: TAIL[6][0], ty: TAIL[6][1], k: 85, c: 6.5, limit: 0.5 },
    { bone: 'earL', tx: 240, ty: 426, k: 300, c: 14, limit: 0.25 },
    { bone: 'earR', tx: 768, ty: 418, k: 300, c: 14, limit: 0.25 },
    { bone: 'tassel0', tx: TASSEL[1][0], ty: TASSEL[1][1], k: 120, c: 6, hang: 0.9, limit: 0.35 },
    { bone: 'tassel1', tx: TASSEL[2][0], ty: TASSEL[2][1], k: 90, c: 5, hang: 0.9, limit: 0.5 },
    // her ahoge is a tight curl: more than a small swing bends it into a corner
    { bone: 'ahoge0', tx: AHOGE[1][0], ty: AHOGE[1][1], k: 230, c: 8.5, limit: 0.17 },
    { bone: 'ahoge1', tx: AHOGE[2][0], ty: AHOGE[2][1], k: 170, c: 7, limit: 0.2 },
  );

  // ---- skin weights -----------------------------------------------------------------------------
  const one = n => [[n, 1]];
  function hairBind(x, y) {
    let c = 0; while (c < HAIR_X.length - 2 && x > HAIR_X[c + 1]) c++;
    const u = clamp((x - HAIR_X[c]) / (HAIR_X[c + 1] - HAIR_X[c]), 0, 1), us = u * u * (3 - 2 * u);
    const col = k => chainWeights(HAIR_X[k], y, HAIR_Y.map(v => [HAIR_X[k], v]), [0, 1, 2].map(i => 'hair' + k + i), 'head');
    return mix(col(c), 1 - us, col(c + 1), us);
  }
  function bodyBind(x, y) {
    const up = sstep(735, 610, y);                       // chest vs hip
    const base = [['chest', up], ['hip', 1 - up]];
    const sk = sstep(705, 885, y) * 0.9;                 // the frilled hem follows the skirt springs
    if (sk <= 0) return base;
    const l = sstep(520, 380, x), r = sstep(480, 620, x), c = Math.max(0, 1 - l - r);
    return mix(base, 1 - sk, [['skirtL', l], ['skirtC', c], ['skirtR', r]], sk);
  }
  // a wing is one rigid plate turning on its root: bending it in the middle reads as rubber
  const wingBind = (J, a) => (x, y) => { const d = Math.hypot(x - J[0][0], y - J[0][1]), w = sstep(10, 60, d); return mix(one(a), w, one('chest'), 1 - w); };
  const tailBind = (x, y) => chainWeights(x, y, TAIL, ['tail0', 'tail1', 'tail2', 'tail3', 'tail4', 'tail5'], 'root');
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  const AHOGE_POLY = [[452, 152], [454, 110], [476, 88], [520, 78], [552, 84], [568, 112], [560, 126], [500, 140], [492, 152], [488, 170], [474, 162]];
  function headBind(x, y) {
    if (x < 322 && y > 396 && y < 470) { const w = sstep(326, 262, x); if (w > 0) return [['earL', w], ['head', 1 - w]]; }
    if (x > 690 && y > 392 && y < 462) { const w = sstep(694, 752, x) * sstep(686, 700, x); if (w > 0) return [['earR', w], ['head', 1 - w]]; }
    if (x > 652 && x < 690 && y > 440) { const w = sstep(440, 462, y); return mix(chainWeights(x, y, TASSEL, ['tassel0', 'tassel1'], 'head'), w, one('head'), 1 - w); }
    if (inPoly(x, y, AHOGE_POLY)) {
      const d = Math.hypot(x - AHOGE[0][0], y - AHOGE[0][1]); const w = sstep(6, 34, d);
      return mix(chainWeights(x, y, AHOGE, ['ahoge0', 'ahoge1'], 'head'), w, one('head'), 1 - w);
    }
    return one('head');
  }

  // ---- whole-figure pose sprites (none yet; same binding idea as DeepSeek) ----------------------
  // A drawn pose is one image. It used to be bound to the skeleton region by region like DeepSeek's (hair to the
  // hair springs, hem to the skirt springs, a band to the tail), but her hair, wings and skirt fill most of the
  // picture, so every spring bent the drawing somewhere: hands, props and frills wobbled like jelly. Now a pose
  // moves almost as one piece: the hips carry it, the head nods it a little, the soles stay on the ground, and
  // only the curl at the very tip of the tail keeps its own motion.
  const TAIL_CURL = (x, y) => x > 770 && y > 715 && y < 860;
  function tipBind(x, y, base) {
    if (!TAIL_CURL(x, y)) return base;
    const w = sstep(770, 800, x) * sstep(715, 735, y) * sstep(860, 840, y);
    return mix(base, 1 - w, chainWeights(x, y, TAIL, ['tail0', 'tail1', 'tail2', 'tail3', 'tail4', 'tail5'], 'root'), w);
  }
  function standBind(x, y) {
    const up = sstep(560, 460, y) * 0.45, gr = sstep(866, 896, y);
    return tipBind(x, y, mix(one('head'), up, mix(one('hip'), 1 - gr, one('root'), gr), 1 - up));
  }
  // Sitting: the same, lower down; whatever touches the ground (skirt, laptop, tail) stays on it.
  function sitBind(x, y) {
    const up = sstep(640, 560, y) * 0.35, gr = sstep(820, 885, y);
    return tipBind(x, y, mix(one('head'), up, mix(one('hip'), 1 - gr, one('root'), gr), 1 - up));
  }
  function lieBind(x, y) { const gr = sstep(800, 880, y); return mix(one('hip'), 1 - gr, one('root'), gr); }

  // ---- rest-space deformers ---------------------------------------------------------------------
  function head3d(x, y, yaw, pitch, o) {
    const u = (x - HEAD_C[0]) / HEAD_R[0], v = (y - HEAD_C[1]) / HEAD_R[1]; const r2 = u * u + v * v;
    const z = r2 < 1 ? (1 - r2) * (0.55 + 0.45 * (1 - r2)) : 0;
    const ca = Math.cos(yaw), sa = Math.sin(yaw), cb = Math.cos(pitch), sb = Math.sin(pitch);
    const x1 = u * ca + z * sa, z1 = -u * sa + z * ca, y1 = v * cb - z1 * sb;
    o[0] = HEAD_C[0] + x1 * HEAD_R[0]; o[1] = HEAD_C[1] + y1 * HEAD_R[1];
  }
  const tmp = [0, 0];
  function headDeform(L, P) {
    const yaw = P.headX * 0.2, pitch = P.headY * 0.16, r = L.rest, o = L.pre, a = L.aux;
    for (let k = 0; k < L.n; k++) { head3d(r[2 * k], r[2 * k + 1], yaw, pitch, tmp); const w = a[k]; o[2 * k] = lerp(r[2 * k], tmp[0], w); o[2 * k + 1] = lerp(r[2 * k + 1], tmp[1], w); }
  }
  function eyeDeform(cy, key) {
    return (L, P) => {
      const yaw = P.headX * 0.2, pitch = P.headY * 0.16, r = L.rest, o = L.pre; const s = lerp(0.12, 1, clamp(P[key], 0, 1));
      for (let k = 0; k < L.n; k++) { head3d(r[2 * k], cy + (r[2 * k + 1] - cy) * s, yaw, pitch, tmp); o[2 * k] = tmp[0]; o[2 * k + 1] = tmp[1]; }
    };
  }
  function mouthDeform(cx, cy) {
    return (L, P) => {
      const yaw = P.headX * 0.2, pitch = P.headY * 0.16, r = L.rest, o = L.pre; const s = lerp(0.3, 1, clamp(P.mouth, 0, 1)), sx = lerp(0.8, 1, clamp(P.mouth, 0, 1));
      for (let k = 0; k < L.n; k++) { head3d(cx + (r[2 * k] - cx) * sx, cy + (r[2 * k + 1] - cy) * s, yaw, pitch, tmp); o[2 * k] = tmp[0]; o[2 * k + 1] = tmp[1]; }
    };
  }
  const EXT = () => g.GPT_EXT || '.png';
  const T = (n, m) => Object.assign({ name: n, file: n + EXT() }, g.GPT_TEX[n], m);

  const rig = {
    name: 'gpt', size: 1024, view: { x: 50, y: -40, w: 900, h: 990 }, ground: 905,
    params: { headX: 0, headY: 0, headZ: 0, headTx: 0, headTy: 0, bodyZ: 0, lean: 0, bob: 0, breath: 0, eyeL: 1, eyeR: 1, mouth: 0,
      legL: 0, legR: 0, legLx: 0, legRx: 0, jump: 0, squash: 0, tail: 0, wingL: 0, wingR: 0, earL: 0, earR: 0, wind: 0 },
    bones, springs,
    build() {
      const F = g.GPT_TEX._face, eyeCy = e => F[e].y0 + (F[e].y1 - F[e].y0) * 0.62;
      const face = { bind: () => one('head'), aux: () => 1, deform: headDeform };
      this.layers = [
        T('hair_back', { z: 0, step: 26, bind: hairBind, aux: (x, y) => sstep(610, 505, y), deform: headDeform }),
        T('wing_l', { z: 0.5, step: 18, bind: wingBind(WING_L, 'wingL0') }), T('wing_r', { z: 0.6, step: 18, bind: wingBind(WING_R, 'wingR0') }),
        T('tail', { z: 1, step: 16, bind: tailBind }),
        T('skirt_back', { z: 1.5, step: 30, bind: () => one('hip') }),
        T('leg_l', { z: 2, step: 26, bind: () => one('legL') }), T('leg_r', { z: 3, step: 26, bind: () => one('legR') }),
        T('body', { z: 4, step: 20, bind: bodyBind }),
        T('head', { z: 10, step: 22, bind: headBind, aux: () => 1, deform: headDeform }),
        T('eye_l', { z: 11, step: 14, bind: () => one('head'), deform: eyeDeform(eyeCy('eye_l'), 'eyeL') }), T('eye_r', { z: 11.1, step: 14, bind: () => one('head'), deform: eyeDeform(eyeCy('eye_r'), 'eyeR') }),
        T('eye_l_closed', Object.assign({ z: 11.2, step: 14 }, face)), T('eye_r_closed', Object.assign({ z: 11.3, step: 14 }, face)),
        T('mouth_smile', Object.assign({ z: 12, step: 12 }, face)), T('mouth_open', { z: 12.1, step: 12, bind: () => one('head'), deform: mouthDeform(F.mouth_open.cx, F.mouth_open.cy) }),
      ];
      this.rigLayers = this.layers.map(l => l.name);
      const PO = g.GPT_POSES || {};
      this.sprites = Object.keys(PO);
      for (const n of this.sprites) {
        const p = PO[n], sit = p.kind !== 'stand', lie = p.kind === 'lie';
        this.layers.push({ name: n, file: 'poses/' + n + EXT(), x: p.x, y: p.y, w: p.w, h: p.h, z: 30, step: 24, alpha: 0,
          bind: lie ? lieBind : sit ? sitBind : standBind, aux: () => 0, deform: headDeform });   // no dome warp on a drawing: it bends hands and props near the face
      }
      return this;
    },
    // parameters -> bone transforms and layer visibility
    pose(pet, P) {
      const B = n => pet.bones[pet.boneIx[n]], Ly = pet.layerIx;
      const root = B('root'); root.ty = -P.jump; root.sy = 1 - P.squash; root.sx = 1 + P.squash * 0.55;
      const hip = B('hip'); hip.ty = P.bob; hip.rot = P.bodyZ * 0.35 * D2R; hip.tx = P.lean * 0.4;
      const chest = B('chest'); chest.rot = P.bodyZ * 0.65 * D2R; chest.tx = P.lean * 0.6; chest.sy = 1 + 0.014 * P.breath; chest.sx = 1 + 0.010 * P.breath;
      const head = B('head'); head.rot = P.headZ * D2R; head.tx = P.headTx; head.ty = P.headTy - 1.2 * P.breath + 10 * Math.max(0, P.headY) + 0.3 * Math.abs(P.headZ);   // chin stays tucked over the collar
      B('legL').ty = -P.legL; B('legL').tx = P.legLx; B('legR').ty = -P.legR; B('legR').tx = P.legRx;
      B('tail4').rot = P.tail * 0.18 * D2R; B('tail5').rot = P.tail * 1.5 * D2R;
      B('wingL0').rot = P.wingL * 1.3 * D2R; B('wingR0').rot = -P.wingR * 1.3 * D2R;   // positive = wing tips lift
      B('earL').rot = P.earL * D2R; B('earR').rot = P.earR * D2R;
      pet.wind = P.wind;
      if (Ly) {
        Ly.eye_l.alpha = sstep(0.10, 0.30, P.eyeL); Ly.eye_l_closed.alpha = 1 - sstep(0.16, 0.36, P.eyeL);
        Ly.eye_r.alpha = sstep(0.10, 0.30, P.eyeR); Ly.eye_r_closed.alpha = 1 - sstep(0.16, 0.36, P.eyeR);
        Ly.mouth_open.alpha = sstep(0.05, 0.35, P.mouth); Ly.mouth_smile.alpha = 1 - sstep(0.15, 0.4, P.mouth);
        const ps = pet.poseState || { cur: 'rig', prev: null, u: 1 }; let resort = false;
        const rigOn = ps.cur === 'rig' || (ps.prev === 'rig' && ps.u < 0.72 && !ps.cut);
        for (const n of this.rigLayers) Ly[n].visible = rigOn;
        for (const n of this.sprites) {
          const L = Ly[n]; let a = 0, z = 30;
          if (n === ps.cur) { a = (ps.prev && !ps.cut) ? sstep(0, 0.7, ps.u) : 1; z = 31; } else if (n === ps.prev && ps.u < 1 && !ps.cut) a = 1 - sstep(0.45, 1, ps.u);
          L.alpha = a; if (L.z !== z) { L.z = z; resort = true; }
        }
        if (resort) pet.layers.sort((a, b) => a.z - b.z);
      }
    },
  };
  g.GPTRig = rig;
})(typeof window !== 'undefined' ? window : globalThis);
