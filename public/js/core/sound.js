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

// 木をたたいた音：すぐ消える低い響き＋木らしいずれた倍音＋当たった瞬間のこすれ
function knock(t, freq, vol, decay, type = 'triangle') {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(vol, t + 0.002);
  out.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  out.connect(ctx.destination);

  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq * 1.4, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + 0.012);
  o.connect(out);
  o.start(t); o.stop(t + decay + 0.02);

  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.value = freq * 2.76;
  g2.gain.setValueAtTime(0.3, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.4);
  o2.connect(g2).connect(out);
  o2.start(t); o2.stop(t + decay + 0.02);

  const n = ctx.createBufferSource();
  const bp = ctx.createBiquadFilter();
  const gn = ctx.createGain();
  n.buffer = noise();
  bp.type = 'bandpass'; bp.frequency.value = freq * 3; bp.Q.value = 2;
  gn.gain.setValueAtTime(vol * 0.6, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);
  n.connect(bp).connect(gn).connect(ctx.destination);
  n.start(t); n.stop(t + 0.04);
}

// なぞる音：こもった柔らかい木の音。高い響きを削り(lowpass)、立ち上がりをゆるやかにする
// 聞き比べ用に3案(1が高め・大きめ、3がいちばん低く小さい)。iPhoneで選んだら、選んだ案だけを残す
export const STEP_VARIANTS = [
  { freq: 420, vol: 0.10, decay: 0.05, cutoff: 1300 },
  { freq: 330, vol: 0.075, decay: 0.06, cutoff: 950 },
  { freq: 260, vol: 0.055, decay: 0.07, cutoff: 700 },
];
const STEP_KEY = 'masumasu-step-trial'; // 聞き比べのあいだだけ使う
let stepVariant = 2;
try { const v = +localStorage.getItem(STEP_KEY); if (v >= 1 && v <= STEP_VARIANTS.length) stepVariant = v; } catch (e) {}
export const getStepVariant = () => stepVariant;
export function setStepVariant(v) {
  stepVariant = v;
  try { localStorage.setItem(STEP_KEY, String(v)); } catch (e) {}
}

function softKnock(t, v) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = v.cutoff; lp.Q.value = 0.7;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(v.vol, t + 0.004);
  out.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
  lp.connect(out).connect(ctx.destination);

  const o = ctx.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(v.freq * 1.2, t);
  o.frequency.exponentialRampToValueAtTime(v.freq, t + 0.01);
  o.connect(lp);
  o.start(t); o.stop(t + v.decay + 0.02);

  const o2 = ctx.createOscillator();
  const g2 = ctx.createGain();
  o2.type = 'sine';
  o2.frequency.value = v.freq * 2.4;
  g2.gain.setValueAtTime(0.2, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + v.decay * 0.4);
  o2.connect(g2).connect(lp);
  o2.start(t); o2.stop(t + v.decay + 0.02);
}

function play(fn) {
  if (!enabled) return;
  unlockAudio();
  if (!ctx) return;
  try { fn(ctx.currentTime + 0.005); } catch (e) {}
}

export const sound = {
  // 置く・引く(コトッ)
  place() { play(t => knock(t, 520, 0.5, 0.09)); },
  // なぞって1マス進む・戻る(コトッより短くて小さく、こもった柔らかいコッ)
  step() { play(t => softKnock(t, STEP_VARIANTS[stepVariant - 1])); },
  // ボタン(軽いカタッ)
  button() { play(t => knock(t, 900, 0.18, 0.045)); },
  // クリア(木琴のように3つ上がる)
  clear() { play(t => [523, 659, 784].forEach((f, i) => knock(t + i * 0.12, f, 0.35, 0.45, 'sine'))); },
  // 間違い(低く鈍いコトコト)
  mistake() { play(t => { knock(t, 190, 0.5, 0.12); knock(t + 0.09, 165, 0.45, 0.14); }); },
};
