/* GPT「白龙娘」— what only this character does. Idle, walking and clip playback are engine/director.js.
 * Actions with drawn poses come later; for now there is the click reaction, which needs no extra drawing. */
(function (g) {
  'use strict';
  const { track, sstep } = g.PetEngine;
  const TAU = Math.PI * 2;
  const { win, dips } = g.PetEngine.motion;

  const CLIPS = {
    // 吃小饼干：捧着看 → 咬一口 → 鼓着腮嚼 → 眯眼回味（两口）→ 收起
    cookie: {
      dur: 10.4,
      poses: [[0.25, 'cookie0'], [1.6, 'cookie1'], [2.35, 'cookie2'], [4.2, 'cookie3'], [5.7, 'cookie1'], [6.45, 'cookie2'], [8.3, 'cookie3'], [9.95, 'rig']],
      fn(t) {
        const bite = win(1.6, 2.35, t, 0.12) + win(5.7, 6.45, t, 0.12);                 // cookie at the mouth: lean in a touch
        const chew = win(2.45, 4.15, t) + win(6.55, 8.25, t);                             // cheeks full
        const yum = win(4.3, 5.6, t, 0.3) + win(8.4, 9.85, t, 0.3);                       // eyes closed, savouring: slow happy sway
        return {
          bob: 4.5 * dips([0.25, 1.6, 5.7, 9.95], t) + 2 * dips([2.35, 4.2, 6.45, 8.3], t) + chew * 0.6 * Math.sin(t * TAU * 3.1),
          headZ: chew * 0.8 * Math.sin(t * TAU * 1.55) + yum * 2.4 * Math.sin(t * TAU * 0.75) - bite * 1.5, headY: -0.16 * bite + 0.08 * chew, headX: 0.04,
          bodyZ: yum * 1.3 * Math.sin(t * TAU * 0.75 + 0.5) + chew * 0.5 * Math.sin(t * TAU * 1.55 + 0.6), tail: (chew + yum) * 5 * Math.sin(t * TAU * 0.8) + 2,
        };
      },
    },
    // 挥手：举起手 → 左右摆几下 → 放下
    wave: {
      dur: 3.9, soft: true,
      poses: [[0.25, 'wave0'], [0.8, 'wave1'], [1.25, 'wave0'], [1.7, 'wave1'], [2.15, 'wave0'], [2.6, 'wave1'], [3.05, 'wave0'], [3.5, 'rig']],
      fn(t) {
        const on = win(0.3, 3.45, t, 0.25), sw = Math.sin((t - 0.35) * TAU / 0.9);
        return { bob: 4.5 * dips([0.25, 3.5], t) - 1.5 * on * Math.abs(sw), headZ: on * 3 * sw, bodyZ: on * 1.5 * sw, headX: 0.06 * on, tail: on * 10 * sw, earL: on * 4 * sw, earR: -on * 4 * sw };
      },
    },
    // 吃醋：抱起手臂扭头“哼” → 忍不住偷瞄回来 → 收起
    pout: {
      dur: 5.6,
      poses: [[0.3, 'pout0'], [3.0, 'pout1'], [5.1, 'rig']],
      fn(t) {
        const away = win(0.4, 2.95, t, 0.35), peek = win(3.05, 5.05, t, 0.3);
        const huff = track([[0.75, 0], [0.9, 1, 'out'], [1.25, 0, 'io']], t) * (t > 0.75 && t < 1.25 ? 1 : 0);   // one sharp "hmph"
        return {
          bob: 4.5 * dips([0.3, 5.1], t) + 2.5 * dips([3.0], t) - 2.5 * huff, squash: -0.012 * huff,
          headX: 0.3 * away - 0.05 * peek, headZ: 3.5 * away - 2 * peek + peek * 0.8 * Math.sin(t * TAU * 0.9), bodyZ: 1.2 * away,
          tail: away * (12 * Math.sin(t * TAU * 1.6)) + peek * 5 * Math.sin(t * TAU * 0.8),
        };
      },
    },
    // 抱白龙抱枕：站着抱住蹭一蹭 → 趴在抱枕上歇一会儿 → 抱着站起来 → 收起
    pillow: {
      dur: 10.4,
      poses: [[0.3, 'pillow0'], [2.9, 'pillow1'], [8.5, 'pillow0'], [9.9, 'rig']],
      fn(t) {
        const hug = win(0.4, 2.85, t, 0.3) + win(8.6, 9.85, t, 0.3), lie = win(3.0, 8.45, t, 0.4);
        return {
          bob: 4.5 * dips([0.3, 9.9], t) + 3 * dips([2.9, 8.5], t), headZ: hug * 3.2 * Math.sin(t * TAU * 0.8), bodyZ: hug * 1.8 * Math.sin(t * TAU * 0.8 + 0.4),
          squash: -0.012 * lie * Math.sin(t * TAU / 3.4), tail: hug * 8 * Math.sin(t * TAU * 1.1) + lie * 6 * Math.sin(t * TAU * 0.35),
        };
      },
    },
    // 笔记本：抱着合上的电脑 → 坐下放在地上 → 掀开盖子 → 打字 → 托腮想一想 → 接着打 → 合上抱起 → 收起
    laptop: {
      dur: 14.6,
      poses: [[0.25, 'laptop0'], [1.6, 'laptop_o0'], [2.3, 'laptop_o1'], [2.75, 'laptop1'], [3.3, 'laptop2'], [7.0, 'laptop3'], [9.2, 'laptop2'],
        [11.4, 'laptop1'], [11.85, 'laptop_o1'], [12.3, 'laptop_o0'], [12.95, 'laptop0'], [14.1, 'rig']],
      fn(t) {
        const type = win(3.4, 6.9, t, 0.3) + win(9.3, 11.3, t, 0.3), think = win(7.1, 9.1, t, 0.3);
        const burst = 0.5 + 0.5 * Math.sin(t * 1.7) > 0.25 ? 1 : 0.35;                     // types in bursts, pauses to read
        return {
          bob: 5 * dips([0.25, 1.6, 12.95, 14.1], t) + 2.5 * dips([2.3, 2.75, 3.3, 7.0, 9.2, 11.4, 11.85, 12.3], t) + type * burst * 0.35 * Math.sin(t * TAU * 6.5),
          headZ: type * (1.3 * Math.sin(t * 0.9) + burst * 0.25 * Math.sin(t * TAU * 3.25)) + think * (2.5 + 1.2 * Math.sin(t * TAU * 0.6)), bodyZ: 0,
          tail: (type + think) * 6 * Math.sin(t * 1.4),
        };
      },
    },
    // 晚安：披着小毯子坐着打瞌睡 → 趴下睡着 → 醒来坐起 → 收起
    sleep: {
      dur: 11.6,
      poses: [[0.3, 'sleep0'], [3.9, 'sleep1'], [9.7, 'sleep0'], [11.1, 'rig']],
      fn(t) {
        const doze = win(0.4, 3.85, t, 0.4) + win(9.8, 11.05, t, 0.3), lie = win(4.0, 9.65, t, 0.4);
        const nod = Math.pow(0.5 - 0.5 * Math.cos(t * TAU / 1.7), 3);                      // slow droop, quick recovery
        return {
          bob: 4.5 * dips([0.3, 11.1], t) + 3 * dips([3.9, 9.7], t) + doze * 3 * nod, headZ: doze * (1.5 + 4.5 * nod),
          squash: -0.012 * lie * Math.sin(t * TAU / 3.6) + 0.006 * doze * nod, tail: 0,
        };
      },
    },
    // 马克杯：捧着 → 喝一口 → 捧着 → 再喝一口 → 收起
    mug: {
      dur: 7.5, soft: true,
      poses: [[0.25, 'mug0'], [1.5, 'mug1'], [3.1, 'mug0'], [4.4, 'mug1'], [6.0, 'mug0'], [7.0, 'rig']],
      fn(t) {
        const sip = win(1.5, 3.05, t, 0.2) + win(4.4, 5.95, t, 0.2), hold = win(0.3, 6.95, t, 0.3);
        return { bob: 4.5 * dips([0.25, 7.0], t) + 1.8 * dips([1.5, 3.1, 4.4, 6.0], t), headZ: hold * 1.2 * Math.sin(t * TAU * 0.4) - sip * 1.5, bodyZ: hold * 0.6 * Math.sin(t * TAU * 0.4 + 0.5), tail: hold * 5 * Math.sin(t * TAU * 0.5) };
      },
    },
    // 思考：托着下巴“唔…” → 竖起手指“想到了！”轻跳一下 → 收起
    think: {
      dur: 6.3,
      poses: [[0.3, 'think0'], [3.6, 'think1'], [5.7, 'rig']],
      fn(t) {
        const hold = win(0.4, 3.55, t, 0.4), hop = track([[3.65, 0], [3.83, 1, 'out'], [4.2, 0, 'in']], t) * (t > 3.65 ? 1 : 0);
        return {
          bob: 4.5 * dips([0.3, 5.7], t), jump: 14 * hop, squash: track([[3.5, 0], [3.64, 0.035, 'io'], [3.76, -0.03, 'out'], [4.18, -0.01], [4.3, 0.035, 'out'], [4.7, 0, 'io']], t),
          headZ: hold * (3 + 1.5 * Math.sin(t * TAU * 0.45)), bodyZ: hold * 0.8 * Math.sin(t * TAU * 0.45 + 0.5), tail: hold * 6 * Math.sin(t * TAU * 0.7) + 10 * hop,
        };
      },
    },
    // 伸懒腰：双手举过头、翅膀张开打哈欠 → 手放下来，还有点困 → 收回
    stretch: {
      dur: 4.9,
      poses: [[0.3, 'stretch0'], [3.0, 'stretch1'], [4.4, 'rig']],
      fn(t) {
        const up = win(0.35, 2.95, t, 0.5);
        return { bob: 4.5 * dips([0.3, 3.0, 4.4], t), squash: -0.03 * up - 0.006 * up * Math.sin(t * TAU * 1.3), headZ: 2.2 * up * Math.sin(t * 1.9), bodyZ: 1.3 * up * Math.sin(t * 1.9 + 0.5), tail: up * 10 * Math.sin(t * 2.4) };
      },
    },
    // 跳：先蹲，再跳起来（翅膀张开），落地回弹
    jump: {
      dur: 1.9, cut: true,
      poses: [[0.12, 'jump0'], [0.5, 'jump1'], [1.12, 'jump0'], [1.42, 'rig']],
      fn(t) {
        const air = t > 0.5 && t < 1.12 ? Math.sin((t - 0.5) / 0.62 * Math.PI) : 0;
        return { jump: 70 * air, squash: track([[0, 0], [0.12, 0], [0.42, 0.05, 'io'], [0.52, -0.05, 'out'], [1.08, -0.02, 'io'], [1.16, 0.06, 'out'], [1.45, 0, 'io']], t), tail: 12 * air };
      },
    },
    // 点一下的回应：眯眼笑着轻跳，翅膀扑两下
    happy: {
      dur: 1.7, poses: [],
      fn(t) {
        const hop = track([[0.12, 0], [0.3, 1, 'out'], [0.7, 0, 'in']], t) * (t > 0.12 ? 1 : 0);
        const flap = 16 * Math.max(0, Math.sin(t * TAU * 3.2)) * (1 - sstep(0.9, 1.4, t));
        return {
          jump: hop * 20, bob: track([[0, 0], [0.12, 5, 'io'], [0.3, 0, 'out'], [0.7, 0], [0.82, 3, 'out'], [1.2, 0, 'io']], t),
          squash: track([[0, 0], [0.12, 0.045, 'io'], [0.24, -0.03, 'out'], [0.68, -0.01], [0.82, 0.04, 'out'], [1.2, 0, 'io']], t),
          mouth: track([[0, 0], [0.1, 1, 'out'], [1.25, 1], [1.6, 0, 'io']], t), eyeMax: track([[0, 1], [0.1, 0, 'in'], [1.2, 0], [1.38, 1, 'out']], t),
          headZ: track([[0, 0], [0.3, -4, 'out'], [0.8, 3, 'io'], [1.3, 0, 'io']], t), tail: 8 * Math.sin(t * TAU * 2.2) * (1 - sstep(1.0, 1.6, t)),
          wingL: 6 + flap, wingR: 6 + flap, earL: -8 * hop, earR: 8 * hop,
        };
      },
    },
  };

  // Idle: the wings rise and settle with the breath and now and then give a small double flutter; the tail tip
  // curls slowly; a pointed ear flicks once in a while.
  function idle(o, c) {
    const t = c.t, r = c.r, st = c.state;
    o.wind *= 0.3;                                                         // long hair: a breeze, not a gust
    o.tail = 6 * Math.sin(t * 0.9) + 2 * Math.sin(t * 2.3 + 0.4);
    let w = 1.6 * o.breath;
    const fl = st.flutter || (st.flutter = { t: -1, next: 3.5 });
    if (fl.t < 0 && t > fl.next) fl.t = 0;
    if (fl.t >= 0) { fl.t += c.dt; w += 7 * track([[0, 0], [0.14, 1, 'out'], [0.3, 0.2, 'io'], [0.46, 0.7, 'out'], [0.85, 0, 'io']], fl.t); if (fl.t > 0.85) { fl.t = -1; fl.next = t + 7 + r() * 9; } }
    o.wingL = w; o.wingR = w;
    const tw = st.twitch || (st.twitch = { t: -1, side: 0, next: 6 }); if (tw.t < 0 && t > tw.next) { tw.t = 0; tw.side = r() < 0.5 ? 0 : 1; }
    if (tw.t >= 0) { tw.t += c.dt; const a = track([[0, 0], [0.08, 1, 'out'], [0.18, -0.4, 'io'], [0.3, 0.5, 'io'], [0.5, 0, 'io']], tw.t) * 9; if (tw.side) o.earR = a; else o.earL = -a; if (tw.t > 0.5) { tw.t = -1; tw.next = t + 5 + r() * 8; } }
  }
  // Walking: the wings beat lightly in step, the tail drags behind the direction of travel.
  function walk(c) {
    const w = 3 + 3 * Math.abs(c.s);
    return { wingL: w, wingR: w, tail: -c.dir * 7 + 6 * Math.sin(c.ph - 1.2) };
  }
  g.GPTMotions = { CLIPS, idle, walk };
})(typeof window !== 'undefined' ? window : globalThis);
