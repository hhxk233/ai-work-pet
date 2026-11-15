/* DeepSeek motions for PetEngine v05 (second pass).
 *
 * Rule of this pass: nothing rotates around an elbow or a wrist. Arms only change by switching to a drawn pose.
 *   idle / walk  – the layered model: breath, blinks, gaze drift, head turn, hair/tail/skirt physics, feet stepping
 *   actions      – a timeline of drawn poses. Each switch is a hard cut riding on a squash-and-settle (never a
 *                  dissolve: that shows a double image), and the pose keeps breathing and swaying while it is held.
 */
(function (g) {
  'use strict';
  const { track, ease, clamp, lerp, sstep } = g.PetEngine;
  const TAU = Math.PI * 2;
  function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const win = (a, b, t, f) => sstep(a, a + (f || 0.2), t) * (1 - sstep(b - (f || 0.2), b, t));   // 1 inside [a,b], soft edges
  // a small dip just before a pose change so the switch lands on the way back up
  const dips = (times, t) => { let v = 0; for (const s of times) v += track([[s - 0.16, 0], [s, 1, 'io'], [s + 0.22, 0, 'out']], t) * (t > s - 0.16 && t < s + 0.22 ? 1 : 0); return v; };

  const CLIPS = {
    // 吃白米饭：端着碗 → 勺子进碗 → 送到嘴边 → 嚼（重复三口）→ 端着碗 → 收起
    rice: {
      dur: 12.7,
      poses: [[0.25, 'rice0'], [1.7, 'rice1'], [2.5, 'rice2'], [3.15, 'rice3'], [4.9, 'rice1'], [5.6, 'rice2'], [6.25, 'rice3'], [8.0, 'rice1'], [8.7, 'rice2'], [9.35, 'rice3'], [11.1, 'rice0'], [12.25, 'rig']],
      fn(t) {
        const chew = win(3.25, 4.85, t) + win(6.35, 7.95, t) + win(9.45, 11.05, t);       // while the mouth is full
        const reach = win(2.5, 3.15, t, 0.12) + win(5.6, 6.25, t, 0.12) + win(8.7, 9.35, t, 0.12);   // spoon at the mouth: lean in a touch
        return {
          bob: 4.5 * dips([0.25, 1.7, 4.9, 8.0, 11.1, 12.25], t) + chew * 1.5 * Math.sin(t * TAU * 3.1),
          headZ: chew * 1.6 * Math.sin(t * TAU * 1.55) - reach * 2.2, headY: -0.18 * reach + 0.1 * chew, headX: 0.05,
          bodyZ: chew * 0.6 * Math.sin(t * TAU * 1.55 + 0.6), tail: chew * 9 * Math.sin(t * TAU * 1.1) + 4,
        };
      },
    },
    // 电脑：抱着合上的电脑 → 坐下放好 → 掀开 → 打字 → 合上 → 抱起 → 收起
    laptop: {
      dur: 12.4,
      poses: [[0.25, 'laptop0'], [1.6, 'laptop1'], [2.5, 'laptop2'], [3.2, 'laptop3'], [9.2, 'laptop2'], [9.85, 'laptop1'], [10.7, 'laptop0'], [11.9, 'rig']],
      fn(t) {
        const type = win(3.5, 9.1, t, 0.3), burst = 0.5 + 0.5 * Math.sin(t * 1.7) > 0.25 ? 1 : 0.35;   // types in bursts, pauses to read
        return {
          bob: 5 * dips([0.25, 1.6, 10.7, 11.9], t) + 2.5 * dips([2.5, 3.2, 9.2, 9.85], t) + type * burst * 0.9 * Math.sin(t * TAU * 6.5),
          headZ: type * (1.4 * Math.sin(t * 0.9) + burst * 0.5 * Math.sin(t * TAU * 3.25)), headY: -0.08 * type, headX: -0.06 * type,
          bodyZ: 0, tail: type * 7 * Math.sin(t * 1.4),
        };
      },
    },
    // 思考：拳头抬到脸边 → 抬眼“唔…”停住 → 放下 → 想到了，开心地跳一下
    think: {
      dur: 6.7,
      poses: [[0.3, 'think0'], [1.1, 'think1'], [4.5, 'think0'], [5.1, 'rig']],
      fn(t) {
        const hold = win(1.2, 4.45, t, 0.4), hop = track([[5.2, 0], [5.38, 1, 'out'], [5.78, 0, 'in']], t) * (t > 5.2 ? 1 : 0);
        return {
          bob: 4.5 * dips([0.3, 1.1, 4.5], t) + track([[0, 0], [5.06, 0], [5.2, 5, 'io'], [5.4, 0, 'out'], [5.78, 0], [5.9, 3, 'out'], [6.25, 0, 'io']], t),
          headZ: hold * (5.5 + 1.3 * Math.sin((t - 1.2) * TAU * 0.5)), headY: hold * 0.22, headX: -0.12 * hold, bodyZ: -1.6 * hold,
          tail: hold * (-6 + 4 * Math.sin(t * TAU * 0.45)) + hop * 12,
          jump: hop * 20, squash: track([[0, 0], [5.06, 0], [5.2, 0.05, 'io'], [5.32, -0.035, 'out'], [5.76, -0.01], [5.9, 0.045, 'out'], [6.25, 0, 'io']], t),
          mouth: track([[0, 0], [5.1, 0], [5.3, 1, 'out'], [6.2, 1], [6.6, 0, 'io']], t),
          eyeMax: track([[0, 1], [5.15, 1], [5.28, 0, 'in'], [6.15, 0], [6.3, 1, 'out']], t),
          earL: track([[0, 0], [5.2, 0], [5.34, -14, 'out'], [5.8, 0, 'io']], t), earR: track([[0, 0], [5.2, 0], [5.34, 14, 'out'], [5.8, 0, 'io']], t),
        };
      },
    },
    // 挥手：手举到脸旁，左右摆四下
    wave: {
      dur: 3.9, soft: true,
      poses: [[0.25, 'wave0'], [0.8, 'wave1'], [1.25, 'wave0'], [1.7, 'wave1'], [2.15, 'wave0'], [2.6, 'wave1'], [3.05, 'wave0'], [3.5, 'rig']],
      fn(t) {
        const on = win(0.3, 3.45, t, 0.25), sw = Math.sin((t - 0.35) * TAU / 0.9);
        return { bob: 4.5 * dips([0.25, 3.5], t) - 1.5 * on * Math.abs(sw), headZ: on * 3.2 * sw, bodyZ: on * 1.6 * sw, headX: 0.06 * on, tail: on * 10 * sw, earL: on * 4 * sw, earR: -on * 4 * sw };
      },
    },
    // 伸懒腰：双手举过头拉长身体打哈欠 → 手放下来，眯着眼 → 收回
    stretch: {
      dur: 4.6,
      poses: [[0.3, 'stretch0'], [2.9, 'stretch1'], [4.1, 'rig']],
      fn(t) {
        const up = win(0.35, 2.85, t, 0.5);
        return { bob: 4.5 * dips([0.3, 2.9, 4.1], t), squash: -0.035 * up - 0.006 * up * Math.sin(t * TAU * 1.3), headY: 0.25 * up, headZ: 2.5 * up * Math.sin(t * 1.9), bodyZ: 1.5 * up * Math.sin(t * 1.9 + 0.5), tail: up * 12 * Math.sin(t * 2.4) };
      },
    },
    // 抱鲸鱼：抱着小鲸鱼左右晃 → 趴到大鲸鱼上眯一会儿 → 起来
    whale: {
      dur: 10.6,
      poses: [[0.3, 'whale0'], [4.0, 'whale1'], [8.9, 'whale0'], [10.1, 'rig']],
      fn(t) {
        const hug = win(0.35, 3.95, t, 0.4) + win(8.95, 10.05, t, 0.3), lie = win(4.05, 8.85, t, 0.4);
        return { bob: 4.5 * dips([0.3, 8.9, 10.1], t) + 3 * dips([4.0], t), bodyZ: hug * 3.2 * Math.sin(t * TAU * 0.55), headZ: hug * 2.6 * Math.sin(t * TAU * 0.55 - 0.5), tail: hug * 11 * Math.sin(t * TAU * 0.55 + 1),
          squash: -0.012 * lie * Math.sin(t * TAU / 3.2) };      // lying down: slow breathing swell
      },
    },
    // 休息：坐着打瞌睡，头一点一点 → 躺下睡着 → 醒来坐起
    rest: {
      dur: 11.2,
      poses: [[0.3, 'rest0'], [3.8, 'rest1'], [9.3, 'rest0'], [10.7, 'rig']],
      fn(t) {
        const doze = win(0.4, 3.75, t, 0.4) + win(9.35, 10.65, t, 0.3), lie = win(3.85, 9.25, t, 0.4);
        const nod = Math.pow(0.5 - 0.5 * Math.cos(t * TAU / 1.7), 3);      // slow droop, quick recovery
        return { bob: 4.5 * dips([0.3, 10.7], t) + 3 * dips([3.8, 9.3], t) + doze * 3 * nod, headZ: doze * (2 + 5 * nod), tail: 0, squash: -0.012 * lie * Math.sin(t * TAU / 3.6) + 0.006 * doze * nod };
      },
    },
    // 跳：先蹲，再跳起来，落地回弹
    jump: {
      dur: 1.9, cut: true,
      poses: [[0.12, 'jump0'], [0.5, 'jump1'], [1.12, 'jump0'], [1.42, 'rig']],
      fn(t) {
        const air = t > 0.5 && t < 1.12 ? Math.sin((t - 0.5) / 0.62 * Math.PI) : 0;
        return { jump: 70 * air, squash: track([[0, 0], [0.12, 0], [0.42, 0.05, 'io'], [0.52, -0.05, 'out'], [1.08, -0.02, 'io'], [1.16, 0.06, 'out'], [1.45, 0, 'io']], t), tail: 14 * air, earL: -10 * air, earR: 10 * air };
      },
    },
    // 点一下的回应：眯眼笑着轻跳，手不动
    happy: {
      dur: 1.7, poses: [],
      fn(t) {
        const hop = track([[0.12, 0], [0.3, 1, 'out'], [0.7, 0, 'in']], t) * (t > 0.12 ? 1 : 0);
        return {
          jump: hop * 22, bob: track([[0, 0], [0.12, 5, 'io'], [0.3, 0, 'out'], [0.7, 0], [0.82, 3, 'out'], [1.2, 0, 'io']], t),
          squash: track([[0, 0], [0.12, 0.05, 'io'], [0.24, -0.035, 'out'], [0.68, -0.01], [0.82, 0.045, 'out'], [1.2, 0, 'io']], t),
          mouth: track([[0, 0], [0.1, 1, 'out'], [1.25, 1], [1.6, 0, 'io']], t), eyeMax: track([[0, 1], [0.1, 0, 'in'], [1.2, 0], [1.38, 1, 'out']], t),
          headZ: track([[0, 0], [0.3, -4, 'out'], [0.8, 3, 'io'], [1.3, 0, 'io']], t), tail: 14 * Math.sin(t * TAU * 2.2) * (1 - sstep(1.0, 1.6, t)),
          earL: -12 * hop, earR: 12 * hop,
        };
      },
    },
  };

  class Director {
    constructor(seed) {
      this.r = rng(seed || 7); this.t = 0; this.nextBlink = 1.6; this.blinkT = -1; this.dbl = false;
      this.gaze = { x: 0, y: 0, tx: 0, ty: 0, next: 2.5 }; this.twitch = { t: -1, side: 0, next: 5 };
      this.walkW = 0; this.walkTarget = 0; this.phase = 0; this.dir = 1; this.face = 0; this.settle = -1;
      this.clip = null; this.clipT = 0; this.clipW = 0; this.prev = null; this.prevT = 0; this.prevW = 0;
      this.pose = { cur: 'rig', prev: null, u: 1 }; this.pop = -1;
      this.vx = 0; // model px / s the host should move the pet by
    }
    play(name) { if (!CLIPS[name]) return; if (this.clip) { this.prev = this.clip; this.prevT = this.clipT; this.prevW = this.clipW; } this.clip = CLIPS[name]; this.clipName = name; this.clipT = 0; this.clipW = 0; this.walkTarget = 0; }
    stop() { if (this.clip) { this.prev = this.clip; this.prevT = this.clipT; this.prevW = this.clipW; this.clip = null; this.clipName = null; } }
    walk(dir) { this.stop(); this.dir = dir; this.walkTarget = 1; }
    halt() { this.walkTarget = 0; }
    get busy() { return !!this.clip || this.pose.cur !== 'rig'; }
    setPose(n, soft, cut) {
      const p = this.pose; if (n === p.cur) return;
      const kind = q => (g.DEEPSEEK_POSES && g.DEEPSEEK_POSES[q] ? g.DEEPSEEK_POSES[q].kind : 'stand');
      const big = cut || kind(n) !== kind(p.cur);          // standing <-> sitting, or a clip that asks for hard switches (the jump)
      // Every switch is a hard cut. A dissolve between two different drawings always shows a double image
      // (two faces, two hands) for a few frames, however short it is. The squash-and-settle carries the change instead.
      this.popAmp = big ? 3 : 1.3;
      p.prev = p.cur; p.cur = n; p.u = 1; p.cut = true; this.pop = 0;
      if (soft && !big && n !== 'rig' && p.prev !== 'rig') this.pop = -1;   // back-and-forth swaps (waving) should not bounce every time
    }

    update(pet, dt) {
      const P = pet.P, r = this.r; this.t += dt; const t = this.t;
      // ---------- idle (also keeps running underneath every held pose)
      const o = Object.assign({}, pet.rig.params);
      o.breath = 0.5 - 0.5 * Math.cos(t * TAU / 3.4);
      const gz = this.gaze; if (t > gz.next) { gz.tx = (r() * 2 - 1) * 0.3; gz.ty = (r() * 2 - 1) * 0.18; gz.next = t + 2.2 + r() * 3.5; }
      const gk = 1 - Math.exp(-dt * 2.2); gz.x += (gz.tx - gz.x) * gk; gz.y += (gz.ty - gz.y) * gk;
      const onRig = this.pose.cur === 'rig' ? 1 : 0.45;        // drawn poses already look somewhere: drift less
      o.headX = gz.x * onRig; o.headY = gz.y * onRig; o.headZ = 1.5 * Math.sin(t * 0.62) + 0.7 * Math.sin(t * 0.37 + 1.3) - gz.x * 3 * onRig;
      o.bodyZ = 0.9 * Math.sin(t * 0.62 - 0.7); o.bob = 0.8 * Math.sin(t * TAU / 3.4 + 0.5);
      o.tail = 7 * Math.sin(t * 1.25) + 3 * Math.sin(t * 2.9 + 0.4);
      o.handLy = -1.2 * o.breath; o.handRy = -1.2 * o.breath;
      o.wind = 14 * Math.sin(t * 0.8) + 9 * Math.sin(t * 1.9 + 2);
      if (this.blinkT < 0 && t > this.nextBlink) this.blinkT = 0;
      let eye = 1;
      if (this.blinkT >= 0) { this.blinkT += dt; const b = this.blinkT; eye = b < 0.07 ? 1 - ease.in(b / 0.07) : b < 0.11 ? 0 : b < 0.25 ? ease.out((b - 0.11) / 0.14) : 1; if (b >= 0.25) { this.blinkT = -1; if (!this.dbl && r() < 0.22) { this.dbl = true; this.nextBlink = t + 0.12; } else { this.dbl = false; this.nextBlink = t + 2.2 + r() * 3.8; } } }
      o.eyeL = o.eyeR = eye;
      const tw = this.twitch; if (tw.t < 0 && t > tw.next) { tw.t = 0; tw.side = r() < 0.5 ? 0 : 1; }
      if (tw.t >= 0) { tw.t += dt; const a = track([[0, 0], [0.08, 1, 'out'], [0.18, -0.4, 'io'], [0.3, 0.5, 'io'], [0.5, 0, 'io']], tw.t) * 13; if (tw.side) o.earR = a; else o.earL = -a; if (tw.t > 0.5) { tw.t = -1; tw.next = t + 4 + r() * 7; } }

      // ---------- walk: whole-body toddle, feet step, hands stay tucked
      const wPrev = this.walkW, rate = this.walkTarget > this.walkW ? 2.6 : 3.2;
      const canWalk = this.pose.cur === 'rig' && this.pose.u >= 1;
      this.walkW = clamp(this.walkW + Math.sign((canWalk ? this.walkTarget : 0) - this.walkW) * rate * dt, 0, 1);
      if (wPrev > 0 && this.walkW === 0) this.settle = 0;
      const w = ease.io(this.walkW);
      this.face += (this.dir * (this.walkTarget && canWalk ? 1 : 0) - this.face) * (1 - Math.exp(-dt * 6));
      if (this.walkW > 0) {
        this.phase += dt * 1.55 * (0.55 + 0.45 * w); const ph = this.phase * TAU, s = Math.sin(ph), c = Math.cos(ph);
        const wk = {
          legL: 23 * Math.pow(Math.max(0, s), 0.8), legR: 23 * Math.pow(Math.max(0, -s), 0.8), legLx: this.dir * 7 * c, legRx: -this.dir * 7 * c,
          bob: 3 - 8.5 * Math.abs(s), bodyZ: 3.4 * Math.sin(ph - 0.5) + this.dir * 2.2, lean: this.dir * 7,
          headZ: -2.2 * Math.sin(ph - 0.9) + this.dir * 1.5, headY: -0.05 + 0.05 * Math.abs(s),
          handLy: -2.5 * Math.abs(s), handRy: -2.5 * Math.abs(Math.sin(ph + 0.5)),
          tail: -this.dir * 10 + 9 * Math.sin(ph - 1.2), squash: 0.012 * Math.cos(ph * 2),
        };
        for (const k in wk) o[k] = lerp(o[k], wk[k], w);
        this.vx = this.dir * 118 * w * (0.82 + 0.18 * Math.abs(s));
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
  g.DeepSeekMotions = { CLIPS, Director };
})(typeof window !== 'undefined' ? window : globalThis);
