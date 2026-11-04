// 木の音。音のファイルは使わず、Web Audioでその場で作る
// iPhoneは画面に触れたときにしか音の準備ができないので、最初のタップで unlockAudio を呼ぶ
// どの音も「全体の音量」(master)を通って鳴る。音量は設定のつまみで変える

let ctx = null;
let master = null;
let enabled = true;
let volume = 0.7;
let noiseBuf = null;

// つまみの値(0〜1)。はじめの0.7で、音を作ったときの大きさになる
export const DEFAULT_VOLUME = 0.7;
const gainOf = v => v / DEFAULT_VOLUME;

export function setSoundEnabled(v) { enabled = v; }
export function setVolume(v) {
  volume = v;
  if (master) master.gain.value = gainOf(v);
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = gainOf(volume);
    master.connect(ctx.destination);
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

// こもった柔らかい木の音(なぞる・ボタン・間違い・クリア)
//   freq：高さ、vol：音量、decay：鳴っている長さ(秒)、cutoff：これより高い響きを削る(こもり具合)
//   attack：鳴り始めのゆるやかさ(秒。長いほど音の頭が丸い)、type：音の形(木琴のような澄んだ音は 'sine')
function softKnock(t, v) {
  const attack = v.attack ?? 0.004, type = v.type ?? 'triangle';
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = v.cutoff; lp.Q.value = 0.7;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, t);
  out.gain.exponentialRampToValueAtTime(v.vol, t + attack);
  out.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
  lp.connect(out).connect(master);

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
}

// 中が空っぽの木をたたいた「コンッ」(木の実・木魚のような丸い響き)
//   freq：響く高さ、vol：音量、decay：響きの長さ(秒)、q：中で響く強さ(大きいほど「コーン」と残る)
//   attack：鳴り始めのゆるやかさ(秒)、cutoff：これより高い響きを削る
function hollowKnock(t, v) {
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass'; lp.frequency.value = v.cutoff; lp.Q.value = 0.5;
  lp.connect(master);

  // 中心の響き：決まった高さで丸く鳴り、すっと消える(たたいた瞬間だけ少し高い)
  const body = ctx.createOscillator();
  const gb = ctx.createGain();
  body.type = 'sine';
  body.frequency.setValueAtTime(v.freq * 1.04, t);
  body.frequency.exponentialRampToValueAtTime(v.freq, t + 0.015);
  gb.gain.setValueAtTime(0.0001, t);
  gb.gain.exponentialRampToValueAtTime(v.vol, t + v.attack);
  gb.gain.exponentialRampToValueAtTime(0.0001, t + v.decay);
  body.connect(gb).connect(lp);
  body.start(t); body.stop(t + v.decay + 0.02);

  // 木らしい、少しずれた高さの小さい響き(早く消える)
  const over = ctx.createOscillator();
  const go = ctx.createGain();
  over.type = 'sine';
  over.frequency.value = v.freq * 1.72;
  go.gain.setValueAtTime(0.0001, t);
  go.gain.exponentialRampToValueAtTime(v.vol * 0.22, t + v.attack);
  go.gain.exponentialRampToValueAtTime(0.0001, t + v.decay * 0.45);
  over.connect(go).connect(lp);
  over.start(t); over.stop(t + v.decay + 0.02);

  // 当たった瞬間：ほんの一瞬の音を、響く高さだけを強く残す仕組みに通す(中の空気が鳴る感じ)
  const n = ctx.createBufferSource();
  const res = ctx.createBiquadFilter();
  const gn = ctx.createGain();
  n.buffer = noise();
  res.type = 'bandpass'; res.frequency.value = v.freq; res.Q.value = v.q;
  gn.gain.setValueAtTime(v.vol * 1.6, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
  n.connect(gn).connect(res).connect(lp);
  n.start(t); n.stop(t + 0.03);
}

// 聞き比べで決めた音(なぞるは案2、ボタン・間違い・クリアは案3)
const STEP = { freq: 330, vol: 0.075, decay: 0.06, cutoff: 950 };                                  // なぞる
const BUTTON = { freq: 500, vol: 0.085, decay: 0.055, cutoff: 1100, attack: 0.006 };                 // ボタン
const MISTAKE = { freq: 145, vol: 0.24, decay: 0.14, cutoff: 700, attack: 0.007 };                   // 間違い
const CLEAR = { freq: 392, vol: 0.17, decay: 0.55, cutoff: 1400, attack: 0.012, type: 'sine' };      // クリア

// 置く・引く・つながる音(聞き比べで案1に決めた)
const PLACE = { freq: 620, vol: 0.18, decay: 0.12, q: 14, attack: 0.002, cutoff: 2600 };
// 聞き比べのときに端末にしまった選び方は、もう使わないので消す
try { localStorage.removeItem('masumasu-place-trial'); localStorage.removeItem('masumasu-sound-trial'); } catch (e) {}

function play(fn) {
  if (!enabled) return;
  unlockAudio();
  if (!ctx) return;
  try { fn(ctx.currentTime + 0.005); } catch (e) {}
}

export const sound = {
  // 置く・引く・つながる(中が空っぽの木の「コンッ」)
  place() { play(t => hollowKnock(t, PLACE)); },
  // なぞって1マス進む・戻る(短くて小さく、こもった柔らかいコッ)
  step() { play(t => softKnock(t, STEP)); },
  // ボタン(軽いカタッ)
  button() { play(t => softKnock(t, BUTTON)); },
  // クリア(木琴のように3つ上がる。ド・ミ・ソの間隔)
  clear() { play(t => [1, 1.26, 1.5].forEach((r, i) => softKnock(t + i * 0.12, { ...CLEAR, freq: CLEAR.freq * r }))); },
  // 間違い(低く鈍いコトコト。2回目は少し低く、小さく、長く)
  mistake() {
    play(t => { softKnock(t, MISTAKE); softKnock(t + 0.09, { ...MISTAKE, freq: MISTAKE.freq * 0.87, vol: MISTAKE.vol * 0.9, decay: MISTAKE.decay * 1.15 }); });
  },
};
