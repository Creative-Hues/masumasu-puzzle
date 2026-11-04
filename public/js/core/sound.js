// 木の音。音のファイルは使わず、Web Audioでその場で作る
// iPhoneは画面に触れたときにしか音の準備ができないので、最初のタップで unlockAudio を呼ぶ

let ctx = null;
let enabled = true;
let noiseBuf = null;

export function setSoundEnabled(v) { enabled = v; }

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
  }
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
}

function noise() {
  if (!noiseBuf) {
    const len = Math.floor(ctx.sampleRate * 0.05);
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

// こもった柔らかい木の音
//   freq：高さ、vol：音量、decay：鳴っている長さ(秒)、cutoff：これより高い響きを削る(こもり具合)
//   attack：鳴り始めのゆるやかさ(秒。長いほど音の頭が丸い)、click：当たった瞬間の「カッ」の強さ(0でなし)
//   type：音の形(木琴のような澄んだ音は 'sine')
function softKnock(t, v) {
  const attack = v.attack ?? 0.004, type = v.type ?? 'triangle', click = v.click ?? 0;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = v.cutoff; lp.Q.value = 0.7;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(v.vol, t + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
  lp.connect(out).connect(ctx.destination);

  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(v.freq * 1.2, t);
  o.frequency.exponentialRampToValueAtTime(v.freq, t + 0.01);
  o.connect(lp);
  o.start(t); o.stop(t + v.decay + 0.02);

  // 木らしい、少しずれた高い響き
  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.value = v.freq * 2.4;
  g2.gain.setValueAtTime(0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + v.decay * 0.4);
  o2.connect(g2).connect(lp);
  o2.start(t); o2.stop(t + v.decay + 0.02);

  // 当たった瞬間のこすれ(「カッ」)。これも高い響きを削ってから鳴らす
  if (click > 0) {
    const n = ctx.createBufferSource();
    const bp = ctx.createBiquadFilter();
    const gn = ctx.createGain();
    n.buffer = noise();
    bp.type = 'bandpass'; bp.frequency.value = v.freq * 3; bp.Q.value = 2;
    gn.gain.setValueAtTime(v.vol * click, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(bp).connect(gn).connect(lp);
    n.start(t); n.stop(t + 0.04);
  }
}

// なぞる音(聞き比べで案2に決めた)
const STEP = { freq: 330, vol: 0.075, decay: 0.06, cutoff: 950 };

// ---------- 聞き比べ用(一時的)。iPhoneで選んだら、選んだ案だけを残す ----------
// 1がいちばん今に近く、3がいちばん柔らかい(低く・こもって・小さく・頭が丸い)
export const SOUND_VARIANTS = {
  // 置く・引く(コトッ)。もとは 520Hz・音量0.5・0.09秒・こすれ強め
  place: [
    { freq: 470, vol: 0.36, decay: 0.09, cutoff: 2200, attack: 0.003, click: 0.25 },
    { freq: 400, vol: 0.28, decay: 0.10, cutoff: 1500, attack: 0.005, click: 0.1 },
    { freq: 340, vol: 0.22, decay: 0.11, cutoff: 1000, attack: 0.007, click: 0 },
  ],
  // ボタン(カタッ)。もとは 900Hz・音量0.18・0.045秒
  button: [
    { freq: 760, vol: 0.14, decay: 0.045, cutoff: 2400, attack: 0.003, click: 0.2 },
    { freq: 620, vol: 0.11, decay: 0.05, cutoff: 1600, attack: 0.004, click: 0.08 },
    { freq: 500, vol: 0.085, decay: 0.055, cutoff: 1100, attack: 0.006, click: 0 },
  ],
  // 間違い(低いコトコト。2回たたく)。もとは 190Hz・165Hz・音量0.5
  mistake: [
    { freq: 185, vol: 0.38, decay: 0.12, cutoff: 1400, attack: 0.003, click: 0.2 },
    { freq: 165, vol: 0.30, decay: 0.13, cutoff: 1000, attack: 0.005, click: 0.08 },
    { freq: 145, vol: 0.24, decay: 0.14, cutoff: 700, attack: 0.007, click: 0 },
  ],
  // クリア(木琴のように3つ上がる。ド・ミ・ソの間隔)。もとは ド(523Hz)から・音量0.35
  clear: [
    { freq: 523, vol: 0.28, decay: 0.45, cutoff: 3000, attack: 0.004, type: 'sine' },
    { freq: 440, vol: 0.22, decay: 0.5, cutoff: 2000, attack: 0.008, type: 'sine' },
    { freq: 392, vol: 0.17, decay: 0.55, cutoff: 1400, attack: 0.012, type: 'sine' },
  ],
};
const TRIAL_KEY = 'masumasu-sound-trial'; // 聞き比べのあいだだけ使う
const picked = { place: 2, button: 2, mistake: 2, clear: 2 };
try {
  localStorage.removeItem('masumasu-step-trial'); // なぞる音の聞き比べは終わった
  const saved = JSON.parse(localStorage.getItem(TRIAL_KEY) || '{}');
  for (const k of Object.keys(picked)) if ([1, 2, 3].includes(saved[k])) picked[k] = saved[k];
} catch (e) {}
export const getSoundVariant = kind => picked[kind];
export function setSoundVariant(kind, v) {
  picked[kind] = v;
  try { localStorage.setItem(TRIAL_KEY, JSON.stringify(picked)); } catch (e) {}
}
const V = kind => SOUND_VARIANTS[kind][picked[kind] - 1];

function play(fn) {
  if (!enabled) return;
  unlockAudio();
  if (!ctx) return;
  try { fn(ctx.currentTime + 0.005); } catch (e) {}
}

export const sound = {
  // 置く・引く(コトッ)
  place() { play(t => softKnock(t, V('place'))); },
  // なぞって1マス進む・戻る(コトッより短くて小さく、こもった柔らかいコッ)
  step() { play(t => softKnock(t, STEP)); },
  // ボタン(軽いカタッ)
  button() { play(t => softKnock(t, V('button'))); },
  // クリア(木琴のように3つ上がる)
  clear() {
    const v = V('clear');
    play(t => [1, 1.26, 1.5].forEach((r, i) => softKnock(t + i * 0.12, { ...v, freq: v.freq * r })));
  },
  // 間違い(低く鈍いコトコト)
  mistake() {
    const v = V('mistake');
    play(t => { softKnock(t, v); softKnock(t + 0.09, { ...v, freq: v.freq * 0.87, vol: v.vol * 0.9, decay: v.decay * 1.15 }); });
  },
};
