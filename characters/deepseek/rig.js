/* DeepSeek「大肥鱼」— rig description for PetEngine v05.
 * Model space is the 1024×1024 canvas of the registered layer set (tex/manifest.json holds each crop's offset).
 * Everything character-specific lives here: layer order, bones, skin weights, deformers, springs.
 * Another character = another folder with its own rig.js / motions.js; nothing here is shared by coordinate.
 */
(function (g) {
  'use strict';
  const { chainWeights, mix, sstep, clamp, lerp } = g.PetEngine;
  const D2R = Math.PI / 180;

  // ---- landmarks (model px) -------------------------------------------------------------------
  const HEAD_C = [490, 392], HEAD_R = [268, 252];           // ellipsoid used for the pseudo-3D turn
  const SH_L = [438, 582], WR_L = [392, 648], SH_R = [538, 580], WR_R = [592, 644];
  const HAIR_X = [215, 322, 500, 678, 790], HAIR_Y = [596, 684, 766, 850];
  const TAIL = [[650, 852], [712, 858], [770, 838], [818, 798], [848, 756]];
  const AHOGE = [[494, 152], [440, 88], [338, 146]];

  const bones = [
    { name: 'root', px: 500, py: 905 },
    { name: 'legL', parent: 'root', px: 440, py: 850 }, { name: 'legR', parent: 'root', px: 548, py: 850 },
    { name: 'hip', parent: 'root', px: 500, py: 800 },
    { name: 'skirtL', parent: 'hip', px: 390, py: 735 }, { name: 'skirtC', parent: 'hip', px: 500, py: 745 }, { name: 'skirtR', parent: 'hip', px: 612, py: 735 },
    { name: 'tail0', parent: 'hip', px: TAIL[0][0], py: TAIL[0][1] }, { name: 'tail1', parent: 'tail0', px: TAIL[1][0], py: TAIL[1][1] },
    { name: 'tail2', parent: 'tail1', px: TAIL[2][0], py: TAIL[2][1] }, { name: 'tail3', parent: 'tail2', px: TAIL[3][0], py: TAIL[3][1] },
    { name: 'chest', parent: 'hip', px: 500, py: 705 },
    { name: 'armL', parent: 'chest', px: SH_L[0], py: SH_L[1] }, { name: 'handL', parent: 'armL', px: WR_L[0], py: WR_L[1] },
    { name: 'armR', parent: 'chest', px: SH_R[0], py: SH_R[1] }, { name: 'handR', parent: 'armR', px: WR_R[0], py: WR_R[1] },
    { name: 'head', parent: 'chest', px: 490, py: 562 },
    { name: 'earL', parent: 'head', px: 252, py: 452 }, { name: 'earR', parent: 'head', px: 712, py: 430 },
    { name: 'bow', parent: 'head', px: 706, py: 372 },
    { name: 'ahoge0', parent: 'head', px: AHOGE[0][0], py: AHOGE[0][1] }, { name: 'ahoge1', parent: 'ahoge0', px: AHOGE[1][0], py: AHOGE[1][1] },
  ];
  const springs = [];
  // five hair strands, three segments each; they hang (mostly ignore head roll) and lag behind movement
  HAIR_X.forEach((x, c) => {
    for (let k = 0; k < 3; k++) {
      bones.push({ name: 'hair' + c + k, parent: k ? 'hair' + c + (k - 1) : 'head', px: x, py: HAIR_Y[k] });
      const outer = (c === 0 || c === 4) ? 1 : (c === 2 ? 0.55 : 0.8);
      springs.push({ bone: 'hair' + c + k, tx: x, ty: HAIR_Y[k + 1], k: (70 - k * 14) / outer, c: 7.5 - k * 1.2, hang: k === 0 ? 0.7 : 0.25, limit: 0.34 + k * 0.08, wind: 0.6 + k * 0.5 + (c % 2) * 0.25 });
    }
  });
  springs.push(
    { bone: 'skirtL', tx: 335, ty: 852, k: 150, c: 11, hang: 0.5, limit: 0.22, wind: 0.3 },
    { bone: 'skirtC', tx: 500, ty: 862, k: 170, c: 12, hang: 0.5, limit: 0.16, wind: 0.2 },
    { bone: 'skirtR', tx: 668, ty: 852, k: 150, c: 11, hang: 0.5, limit: 0.22, wind: 0.3 },
    { bone: 'tail0', tx: TAIL[1][0], ty: TAIL[1][1], k: 150, c: 12, limit: 0.25 },
    { bone: 'tail1', tx: TAIL[2][0], ty: TAIL[2][1], k: 110, c: 9, limit: 0.35 },
    { bone: 'tail2', tx: TAIL[3][0], ty: TAIL[3][1], k: 85, c: 7.5, limit: 0.45 },
    { bone: 'tail3', tx: TAIL[4][0], ty: TAIL[4][1], k: 70, c: 6.5, limit: 0.5 },
    { bone: 'earL', tx: 160, ty: 502, k: 260, c: 13, limit: 0.3 },
    { bone: 'earR', tx: 828, ty: 468, k: 260, c: 13, limit: 0.3 },
    { bone: 'bow', tx: 745, ty: 340, k: 300, c: 14, limit: 0.25 },
    { bone: 'ahoge0', tx: AHOGE[1][0], ty: AHOGE[1][1], k: 190, c: 7, limit: 0.35 },
    { bone: 'ahoge1', tx: AHOGE[2][0], ty: AHOGE[2][1], k: 120, c: 5, limit: 0.55 },
  );

  // ---- skin weights -----------------------------------------------------------------------------
  const one = n => [[n, 1]];
  function hairBind(x, y) {
    // which strand(s): hat functions between column centres
    let c = 0; while (c < HAIR_X.length - 2 && x > HAIR_X[c + 1]) c++;
    const u = clamp((x - HAIR_X[c]) / (HAIR_X[c + 1] - HAIR_X[c]), 0, 1), us = u * u * (3 - 2 * u);
    const col = k => chainWeights(HAIR_X[k], y, HAIR_Y.map(v => [HAIR_X[k], v]), [0, 1, 2].map(i => 'hair' + k + i), 'head');
    return mix(col(c), 1 - us, col(c + 1), us);
  }
  function bodyBind(x, y) {
    const up = sstep(760, 650, y);                       // chest vs hip
    const base = [['chest', up], ['hip', 1 - up]];
    const sk = sstep(742, 862, y) * 0.9;                 // skirt hem follows the skirt springs
    if (sk <= 0) return base;
    const l = sstep(520, 400, x), r = sstep(480, 600, x), c = Math.max(0, 1 - l - r);
    return mix(base, 1 - sk, [['skirtL', l], ['skirtC', c], ['skirtR', r]], sk);
  }
  function sleeveBind(sh, wr, arm, hand) {
    const dx = wr[0] - sh[0], dy = wr[1] - sh[1], l2 = dx * dx + dy * dy;
    return (x, y) => {
      const t = ((x - sh[0]) * dx + (y - sh[1]) * dy) / l2;
      const wc = (1 - sstep(-0.25, 0.3, t)) * 0.7, wh = sstep(0.5, 1.0, t);
      return [['chest', wc], [hand, wh * (1 - wc)], [arm, (1 - wh) * (1 - wc)]];
    };
  }
  function inPoly(x, y, p) { let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) c = !c; } return c; }
  const AHOGE_POLY = [[320, 160], [322, 60], [520, 60], [522, 136], [500, 168], [468, 150], [420, 128], [372, 140], [345, 168]];
  function headBind(x, y) {
    // ears: weight grows from the root outwards
    if (x < 262 && y > 400) { const w = sstep(268, 205, x) * sstep(395, 430, y); if (w > 0) return [['earL', w], ['head', 1 - w]]; }
    if (x > 700 && y > 385 && y < 520) { const w = sstep(698, 762, x) * sstep(385, 412, y); if (w > 0) return [['earR', w], ['head', 1 - w]]; }
    if (x > 690 && y > 320 && y < 400) { const w = sstep(694, 722, x) * sstep(400, 384, y) * sstep(318, 330, y); if (w > 0) return [['bow', w], ['head', 1 - w]]; }
    if (inPoly(x, y, AHOGE_POLY)) {
      const d = Math.hypot(x - AHOGE[0][0], y - AHOGE[0][1]); const w = sstep(6, 34, d);
      return mix(chainWeights(x, y, AHOGE, ['ahoge0', 'ahoge1'], 'head'), w, one('head'), 1 - w);
    }
    return one('head');
  }

  // ---- whole-figure pose sprites ---------------------------------------------------------------
  // A drawn pose (bowl in hand, laptop open, fist at chin) is one image. It is bound to the same skeleton
  // by region, so it breathes, sways and its hair/tail swing exactly like the layered idle model.
  // No limb is ever rotated around a joint: a different arm pose is a different drawing.
  function standBind(x, y) {
    const up = sstep(640, 548, y), dx = Math.abs(x - 495);
    const edge = 176 + 60 * sstep(690, 850, y);                    // half-width of the body column (wider over the skirt)
    const wh = sstep(edge, edge + 70, dx) * (1 - up);              // long hair at the sides
    let lower = mix(bodyBind(x, y), 1 - wh, hairBind(x, y), wh);
    if (x > 640 && y > 740) { const tw = sstep(640, 700, x) * sstep(740, 790, y); if (tw > 0) lower = mix(lower, 1 - tw, chainWeights(x, y, TAIL, ['tail0', 'tail1', 'tail2', 'tail3'], 'hip'), tw); }
    const wf = sstep(852, 886, y) * (1 - wh); if (wf > 0) lower = mix(lower, 1 - wf, one('root'), wf);   // shoes stay planted
    return mix(one('head'), up, lower, 1 - up);
  }
  function sitBind(x, y) {
    const up = sstep(690, 585, y); let lower = one('hip');
    if (x > 700 && y > 600) { const w = sstep(700, 770, x) * 0.75; lower = mix(lower, 1 - w, hairBind(790, y), w); }   // only the free hair and tail on the right swing; laptop and hands stay put
    return mix(one('head'), up * 0.6, lower, 1 - up * 0.6);
  }

  // ---- rest-space deformers ---------------------------------------------------------------------
  // pseudo-3D: treat the head as a dome and rotate it; rim barely moves, centre slides -> reads as a turn
  function head3d(x, y, yaw, pitch, o) {
    const u = (x - HEAD_C[0]) / HEAD_R[0], v = (y - HEAD_C[1]) / HEAD_R[1]; const r2 = u * u + v * v;
    const z = r2 < 1 ? (1 - r2) * (0.55 + 0.45 * (1 - r2)) + 0.0 : 0;       // smooth dome, flat outside the rim
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
  function mouthDeform(L, P) {
    const yaw = P.headX * 0.2, pitch = P.headY * 0.16, r = L.rest, o = L.pre; const s = lerp(0.3, 1, clamp(P.mouth, 0, 1)), cy = 512, cx = 487, sx = lerp(0.8, 1, clamp(P.mouth, 0, 1));
    for (let k = 0; k < L.n; k++) { head3d(cx + (r[2 * k] - cx) * sx, cy + (r[2 * k + 1] - cy) * s, yaw, pitch, tmp); o[2 * k] = tmp[0]; o[2 * k + 1] = tmp[1]; }
  }
  const T = (n, m) => Object.assign({ name: n, file: n + '.png' }, g.DEEPSEEK_TEX[n], m);

  const rig = {
    name: 'deepseek', size: 1024, view: { x: 60, y: -40, w: 900, h: 990 }   /* extra headroom so a jump is never clipped */, ground: 905,
    params: { headX: 0, headY: 0, headZ: 0, headTx: 0, headTy: 0, bodyZ: 0, lean: 0, bob: 0, breath: 0, eyeL: 1, eyeR: 1, mouth: 0,
      armL: 0, armR: 0, handL: 0, handR: 0, handLx: 0, handLy: 0, handRx: 0, handRy: 0,
      legL: 0, legR: 0, legLx: 0, legRx: 0, jump: 0, squash: 0, tail: 0, earL: 0, earR: 0, wind: 0 },
    bones, springs,
    build() {
      this.layers = [
        T('hair_back', { z: 0, step: 26, bind: hairBind, aux: (x, y) => sstep(640, 560, y), deform: headDeform }),
        T('tail', { z: 1, step: 16, bind: (x, y) => chainWeights(x, y, TAIL, ['tail0', 'tail1', 'tail2', 'tail3'], 'hip') }),
        T('leg_l', { z: 2, step: 24, bind: () => one('legL') }), T('leg_r', { z: 3, step: 24, bind: () => one('legR') }),
        T('body', { z: 4, step: 20, bind: bodyBind }),
        T('neck', { z: 3.9, step: 26, bind: (x, y) => { const w = sstep(575, 530, y) * 0.6; return [['head', w], ['chest', 1 - w]]; } }),
        T('head', { z: 10, step: 22, bind: headBind, aux: () => 1, deform: headDeform }),
        T('eye_l', { z: 11, step: 14, bind: () => one('head'), deform: eyeDeform(476, 'eyeL') }), T('eye_r', { z: 11.1, step: 14, bind: () => one('head'), deform: eyeDeform(459, 'eyeR') }),
        T('eye_l_closed', { z: 11.2, step: 14, bind: () => one('head'), aux: () => 1, deform: headDeform }), T('eye_r_closed', { z: 11.3, step: 14, bind: () => one('head'), aux: () => 1, deform: headDeform }),
        T('mouth_smile', { z: 12, step: 12, bind: () => one('head'), aux: () => 1, deform: headDeform }), T('mouth_open', { z: 12.1, step: 12, bind: () => one('head'), deform: mouthDeform }),
      ];
      this.rigLayers = this.layers.map(l => l.name);
      const PO = g.DEEPSEEK_POSES || {};
      this.sprites = Object.keys(PO);
      for (const n of this.sprites) {
        const p = PO[n], sit = p.kind !== 'stand', lie = p.kind === 'lie';
        this.layers.push({ name: n, file: 'poses/' + n + '.png', x: p.x, y: p.y, w: p.w, h: p.h, z: 30, step: 24, alpha: 0,
          bind: lie ? () => one('hip') : sit ? sitBind : standBind, aux: sit ? () => 0 : (x, y) => sstep(640, 548, y) * 0.8, deform: headDeform });
      }
      return this;
    },
    // parameters -> bone transforms and layer visibility
    pose(pet, P) {
      const B = n => pet.bones[pet.boneIx[n]], Ly = pet.layerIx;
      const root = B('root'); root.ty = -P.jump; root.sy = 1 - P.squash; root.sx = 1 + P.squash * 0.55;
      const hip = B('hip'); hip.ty = P.bob; hip.rot = P.bodyZ * 0.35 * D2R; hip.tx = P.lean * 0.4;
      const chest = B('chest'); chest.rot = P.bodyZ * 0.65 * D2R; chest.tx = P.lean * 0.6; chest.sy = 1 + 0.016 * P.breath; chest.sx = 1 + 0.012 * P.breath;
      const head = B('head'); head.rot = P.headZ * D2R; head.tx = P.headTx; head.ty = P.headTy - 1.4 * P.breath + 12 * Math.max(0, P.headY) + 0.35 * Math.abs(P.headZ);   // chin stays tucked over the collar
      B('legL').ty = -P.legL; B('legL').tx = P.legLx; B('legL').rot = -P.legL * 0.012; B('legR').ty = -P.legR; B('legR').tx = P.legRx; B('legR').rot = P.legR * 0.012;
      const aL = B('armL'), aR = B('armR'), hL = B('handL'), hR = B('handR');
      aL.rot = P.armL * D2R; aR.rot = P.armR * D2R;   // kept at 0 by the motions: arms are never swung around the shoulder
      hL.rot = P.handL * D2R; hL.tx = P.handLx; hL.ty = P.handLy; hR.rot = P.handR * D2R; hR.tx = P.handRx; hR.ty = P.handRy;
      B('tail0').rot = P.tail * 0.5 * D2R; B('tail1').rot = P.tail * 0.6 * D2R; B('tail2').rot = P.tail * 0.7 * D2R; B('tail3').rot = P.tail * 0.8 * D2R;
      B('earL').rot = P.earL * D2R; B('earR').rot = P.earR * D2R;
      pet.wind = P.wind;
      if (Ly) {
        Ly.eye_l.alpha = sstep(0.10, 0.30, P.eyeL); Ly.eye_l_closed.alpha = 1 - sstep(0.16, 0.36, P.eyeL);
        Ly.eye_r.alpha = sstep(0.10, 0.30, P.eyeR); Ly.eye_r_closed.alpha = 1 - sstep(0.16, 0.36, P.eyeR);
        Ly.mouth_open.alpha = sstep(0.05, 0.35, P.mouth); Ly.mouth_smile.alpha = 1 - sstep(0.15, 0.4, P.mouth);
        // which drawing is on screen: the layered model ('rig') or one pose sprite, with a short dissolve between them
        const ps = pet.poseState || { cur: 'rig', prev: null, u: 1 }; let resort = false;
        const rigOn = ps.cur === 'rig' || (ps.prev === 'rig' && ps.u < 0.72 && !ps.cut);
        for (const n of this.rigLayers) Ly[n].visible = rigOn;
        for (const n of this.sprites) {
          const L = Ly[n]; let a = 0, z = 30;
          if (n === ps.cur) { a = (ps.prev && !ps.cut) ? sstep(0, 0.7, ps.u) : 1; z = 31; } else if (n === ps.prev && ps.u < 1 && !ps.cut) a = 1 - sstep(0.45, 1, ps.u);   // cut = hard switch, no double image
          L.alpha = a; if (L.z !== z) { L.z = z; resort = true; }
        }
        if (resort) pet.layers.sort((a, b) => a.z - b.z);
      }
    },
  };
  g.DeepSeekRig = rig;
})(typeof window !== 'undefined' ? window : globalThis);
