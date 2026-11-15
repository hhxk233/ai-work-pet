/* DeepSeek's action clips and her own idle / walk additions. The director that plays them is engine/director.js.
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
  const { win, dips } = g.PetEngine.motion;

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
    // 电脑：抱着合上的电脑 → 坐下放好 → 掀开打字 → 做完抬头 → 合上 → 抱起 → 收起
    laptop: {
      dur: 12.4,
      poses: [[0.25, 'laptop0'], [1.6, 'laptop1'], [2.5, 'laptop2'], [7.3, 'laptop3'], [9.85, 'laptop1'], [10.7, 'laptop0'], [11.9, 'rig']],   // laptop2 = typing, eyes on the screen; laptop3 = done, looks up happy
      fn(t) {
        const type = win(2.9, 7.2, t, 0.3), burst = 0.5 + 0.5 * Math.sin(t * 1.7) > 0.25 ? 1 : 0.35;   // types in bursts, pauses to read
        return {
          bob: 5 * dips([0.25, 1.6, 10.7, 11.9], t) + 2.5 * dips([2.5, 7.3, 9.85], t) + type * burst * 0.9 * Math.sin(t * TAU * 6.5),
          headZ: type * (1.4 * Math.sin(t * 0.9) + burst * 0.5 * Math.sin(t * TAU * 3.25)), headY: -0.08 * type, headX: -0.06 * type,
          bodyZ: 0, tail: type * 7 * Math.sin(t * 1.4),
        };
      },
    },
    // 敲键盘（v04 那版电脑画稿，斜着看得到键盘）：抱着合上的电脑 → 坐下放好 → 掀开 → 打字 → 合上 → 抱起 → 收起
    typing: {
      dur: 12.4,
      poses: [[0.25, 'typing0'], [1.6, 'typing1'], [2.5, 'typing2'], [3.2, 'typing3'], [9.2, 'typing2'], [9.85, 'typing1'], [10.7, 'typing0'], [11.9, 'rig']],
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

  // What only this character has: a tail, fin ears that twitch now and then, fists that ride on the breath.
  function idle(o, c) {
    const t = c.t, r = c.r;
    o.tail = 7 * Math.sin(t * 1.25) + 3 * Math.sin(t * 2.9 + 0.4);
    o.handLy = -1.2 * o.breath; o.handRy = -1.2 * o.breath;
    const tw = c.state.twitch || (c.state.twitch = { t: -1, side: 0, next: 5 }); if (tw.t < 0 && t > tw.next) { tw.t = 0; tw.side = r() < 0.5 ? 0 : 1; }
    if (tw.t >= 0) { tw.t += c.dt; const a = track([[0, 0], [0.08, 1, 'out'], [0.18, -0.4, 'io'], [0.3, 0.5, 'io'], [0.5, 0, 'io']], tw.t) * 13; if (tw.side) o.earR = a; else o.earL = -a; if (tw.t > 0.5) { tw.t = -1; tw.next = t + 4 + r() * 7; } }
  }
  function walk(c) {
    return { handLy: -2.5 * Math.abs(c.s), handRy: -2.5 * Math.abs(Math.sin(c.ph + 0.5)), tail: -c.dir * 10 + 9 * Math.sin(c.ph - 1.2) };
  }
  g.DeepSeekMotions = { CLIPS, idle, walk };
})(typeof window !== 'undefined' ? window : globalThis);
