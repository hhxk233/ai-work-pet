/* PetEngine.Director: the part of a pet that is the same for every character.
 *
 *   idle   breath, blinks, gaze drift, slow head and body sway (keeps running underneath every held pose)
 *   walk   feet stepping, bob, lean, and the speed the host should move the pet by (director.vx)
 *   clips  an action is a timeline of drawn poses plus a function returning small parameter overlays.
 *          Every pose switch is a hard cut riding on a squash-and-settle; drawings are never cross-faded.
 *
 * A character supplies its clips, its poses.json and, optionally, two small hooks for motion only it has
 * (a tail, ears, hands). See characters/deepseek/motions.js and load.js.
 */
(function (g) {
  'use strict';
  const { track, ease, clamp, lerp, sstep } = g.PetEngine;
  const TAU = Math.PI * 2;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const win = (a, b, t, f) => sstep(a, a + (f || 0.2), t) * (1 - sstep(b - (f || 0.2), b, t));   // 1 inside [a,b], soft edges
  // a small dip just before a pose change so the switch lands on the way back up
  const dips = (times, t) => { let v = 0; for (const s of times) v += track([[s - 0.16, 0], [s, 1, 'io'], [s + 0.22, 0, 'out']], t) * (t > s - 0.16 && t < s + 0.22 ? 1 : 0); return v; };


  class Director {
    // opts: { clips, poses, seed, idle(o, ctx), walk(ctx), tune }
    //   clips  name -> { dur, poses: [[time, poseName], ...], fn(t) -> params, soft?, cut? }
    //   poses  the character's poses.json (only `kind` is read: stand / sit / lie)
    //   idle   optional: add the character's own idle motion (tail, ears, ...) to the parameter object `o`
    //   walk   optional: return extra walk-cycle parameters for this character
    constructor(opts) {
      opts = opts || {};
      this.clips = opts.clips || {}; this.poses = opts.poses || {}; this.idleExtra = opts.idle || null; this.walkExtra = opts.walk || null;
      this.tune = Object.assign({ breathPeriod: 3.4, walkSpeed: 118, stepRate: 1.55, legLift: 23, legSwing: 7 }, opts.tune);
      this.state = {};                                        // scratch space for the character's idle / walk hooks
      this.r = rng(opts.seed || 7); this.t = 0; this.nextBlink = 1.6; this.blinkT = -1; this.dbl = false;
      this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 2.5 };
      this.walkW = 0; this.walkTarget = 0; this.phase = 0; this.dir = 1; this.face = 0; this.settle = -1;
      this.clip = null; this.clipT = 0; this.clipW = 0; this.prev = null; this.prevT = 0; this.prevW = 0;
      this.pose = { cur: 'rig', prev: null, u: 1 }; this.pop = -1;
      this.vx = 0; // model px / s the host should move the pet by
    }
    play(name) { if (!this.clips[name]) return; if (this.clip) { this.prev = this.clip; this.prevT = this.clipT; this.prevW = this.clipW; } this.clip = this.clips[name]; this.clipName = name; this.clipT = 0; this.clipW = 0; this.walkTarget = 0; }
    stop() { if (this.clip) { this.prev = this.clip; this.prevT = this.clipT; this.prevW = this.clipW; this.clip = null; this.clipName = null; } }
    walk(dir) { this.stop(); this.dir = dir; this.walkTarget = 1; }
    halt() { this.walkTarget = 0; }
    get busy() { return !!this.clip || this.pose.cur !== 'rig'; }
    setPose(n, soft, cut) {
      const p = this.pose; if (n === p.cur) return;
      const kind = q => (this.poses[q] ? this.poses[q].kind : 'stand');
      const big = cut || kind(n) !== kind(p.cur);          // standing <-> sitting, or a clip that asks for hard switches (the jump)
      // Every switch is a hard cut. A dissolve between two different drawings always shows a double image
      // (two faces, two hands) for a few frames, however short it is. The squash-and-settle carries the change instead.
      this.popAmp = big ? 3 : 1.3;
      p.prev = p.cur; p.cur = n; p.u = 1; p.cut = true; this.pop = 0;
      if (soft && !big && n !== 'rig' && p.prev !== 'rig') this.pop = -1;   // back-and-forth swaps (waving) should not bounce every time
    }

    update(pet, dt) {
      const P = pet.P, r = this.r, T = this.tune; this.t += dt; const t = this.t;
      // ---------- idle (also keeps running underneath every held pose)
      const o = Object.assign({}, pet.rig.params);
      o.breath = 0.5 - 0.5 * Math.cos(t * TAU / T.breathPeriod);
      const gz = this.gaze; if (t > gz.next) { gz.tx = (r() * 2 - 1) * 0.3; gz.ty = (r() * 2 - 1) * 0.18; gz.next = t + 2.2 + r() * 3.5; }
      const gk = 1 - Math.exp(-dt * 2.2); gz.x += (gz.tx - gz.x) * gk; gz.y += (gz.ty - gz.y) * gk;
      const onRig = this.pose.cur === 'rig' ? 1 : 0.45;        // drawn poses already look somewhere: drift less
      o.headX = gz.x * onRig; o.headY = gz.y * onRig; o.headZ = 1.5 * Math.sin(t * 0.62) + 0.7 * Math.sin(t * 0.37 + 1.3) - gz.x * 3 * onRig;
      o.bodyZ = 0.9 * Math.sin(t * 0.62 - 0.7); o.bob = 0.8 * Math.sin(t * TAU / T.breathPeriod + 0.5);
      o.wind = 14 * Math.sin(t * 0.8) + 9 * Math.sin(t * 1.9 + 2);
      if (this.blinkT < 0 && t > this.nextBlink) this.blinkT = 0;
      let eye = 1;
      if (this.blinkT >= 0) { this.blinkT += dt; const b = this.blinkT; eye = b < 0.07 ? 1 - ease.in(b / 0.07) : b < 0.11 ? 0 : b < 0.25 ? ease.out((b - 0.11) / 0.14) : 1; if (b >= 0.25) { this.blinkT = -1; if (!this.dbl && r() < 0.22) { this.dbl = true; this.nextBlink = t + 0.12; } else { this.dbl = false; this.nextBlink = t + 2.2 + r() * 3.8; } } }
      o.eyeL = o.eyeR = eye;
      if (this.idleExtra) this.idleExtra(o, { t, dt, r, state: this.state });

      // ---------- walk: whole-body toddle, feet step
      const wPrev = this.walkW, rate = this.walkTarget > this.walkW ? 2.6 : 3.2;
      const canWalk = this.pose.cur === 'rig' && this.pose.u >= 1;
      this.walkW = clamp(this.walkW + Math.sign((canWalk ? this.walkTarget : 0) - this.walkW) * rate * dt, 0, 1);
      if (wPrev > 0 && this.walkW === 0) this.settle = 0;
      const w = ease.io(this.walkW);
      this.face += (this.dir * (this.walkTarget && canWalk ? 1 : 0) - this.face) * (1 - Math.exp(-dt * 6));
      if (this.walkW > 0) {
        this.phase += dt * T.stepRate * (0.55 + 0.45 * w); const ph = this.phase * TAU, s = Math.sin(ph), c = Math.cos(ph);
        const wk = {
          legL: T.legLift * Math.pow(Math.max(0, s), 0.8), legR: T.legLift * Math.pow(Math.max(0, -s), 0.8), legLx: this.dir * T.legSwing * c, legRx: -this.dir * T.legSwing * c,
          bob: 3 - 8.5 * Math.abs(s), bodyZ: 3.4 * Math.sin(ph - 0.5) + this.dir * 2.2, lean: this.dir * 7,
          headZ: -2.2 * Math.sin(ph - 0.9) + this.dir * 1.5, headY: -0.05 + 0.05 * Math.abs(s),
          squash: 0.012 * Math.cos(ph * 2),
        };
        if (this.walkExtra) Object.assign(wk, this.walkExtra({ ph, s, c, dir: this.dir }));
        for (const k in wk) o[k] = lerp(o[k], wk[k], w);
        this.vx = this.dir * T.walkSpeed * w * (0.82 + 0.18 * Math.abs(s));
      } else { this.vx = 0; this.phase = 0; }
      o.headX = clamp(o.headX * (1 - Math.abs(this.face) * 0.8) + this.face * 0.86, -1, 1);
      if (this.settle >= 0) { this.settle += dt; const q = this.settle; o.squash += track([[0, 0], [0.09, 0.03, 'out'], [0.24, -0.012, 'io'], [0.42, 0, 'io']], q); o.bob += track([[0, 0], [0.09, 3, 'out'], [0.3, 0, 'io']], q); if (q > 0.45) this.settle = -1; }

      // ---------- action clip(s): parameters cross-fade, drawn poses follow the clip's timeline
      const apply = (clip, ct, wt) => { if (!clip || wt <= 0) return; const v = clip.fn(ct); for (const k in v) { if (k === 'eyeMax') { const e = lerp(1, v[k], wt); o.eyeL = Math.min(o.eyeL, e); o.eyeR = Math.min(o.eyeR, e); } else o[k] = lerp(o[k], v[k], wt); } };
      if (this.prev) { this.prevT += dt; this.prevW = Math.max(0, this.prevW - dt / 0.4); apply(this.prev, Math.min(this.prevT, this.prev.dur), ease.io(this.prevW)); if (this.prevW <= 0) this.prev = null; }
      let want = this.pose.cur;
      if (this.clip) {
        this.clipT += dt; const c = this.clip; this.clipW = Math.min(sstep(0, 0.3, this.clipT), 1 - sstep(c.dur - 0.35, c.dur, this.clipT)); apply(c, this.clipT, this.clipW);
        for (const k of c.poses) if (this.clipT >= k[0]) want = k[1];          // before the first key the current drawing stays
        if (this.clipT >= c.dur) { this.clip = null; this.clipName = null; want = 'rig'; }
      } else want = 'rig';
      this.setPose(want, this.clip && this.clip.soft, this.clip && this.clip.cut);
      const ps = this.pose; if (ps.u < 1) ps.u = Math.min(1, ps.u + dt / (this.poseDur || 0.13));
      if (this.pop >= 0) { this.pop += dt; const q = this.pop; o.squash += (this.popAmp || 1) * track([[0, 0.03], [0.07, -0.028, 'out'], [0.2, 0.008, 'io'], [0.34, 0, 'io']], q); if (q > 0.36) this.pop = -1; }
      pet.poseState = ps;
      Object.assign(P, o);
    }
  }
  g.PetEngine.Director = Director; g.PetEngine.motion = { rng, win, dips };
})(typeof window !== 'undefined' ? window : globalThis);
