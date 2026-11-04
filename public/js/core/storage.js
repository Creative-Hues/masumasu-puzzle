// 端末への保存。設定と、パズルごとの進み具合を1つの入れ物にまとめる
// 形：{ v, settings: { sound, haptics, theme, volume }, puzzles: { [id]: { maxCleared, current, skipped } }, rulesSeen }
//   maxCleared … どこまでクリアしたか(飛ばしたものも含む。1本道なので、それより前は全部済み)
//   current    … 今のステージ
//   skipped    … 飛ばしたステージの番号
// rulesSeen … ルールの説明を自動で出したパズル(初めて開いたときだけ出すため)

export const STORE_KEY = 'masumasu';
export const STORE_VERSION = 1;
export const THEME_MODES = ['auto', 'light', 'dark'];

// volume は音量のつまみ(0〜1)。0.7で、音を作ったときの大きさ
const DEFAULT_SETTINGS = { sound: true, haptics: true, theme: 'auto', volume: 0.7 };

function blank() {
  return { v: STORE_VERSION, settings: { ...DEFAULT_SETTINGS }, puzzles: {}, rulesSeen: [] };
}

function count(x, min, fallback) {
  return Number.isInteger(x) && x >= min ? x : fallback;
}

function normalizeProgress(x) {
  const p = x && typeof x === 'object' ? x : {};
  const maxCleared = count(p.maxCleared, 0, 0);
  const current = Math.min(count(p.current, 1, 1), maxCleared + 1);
  const skipped = Array.isArray(p.skipped)
    ? [...new Set(p.skipped.filter(n => Number.isInteger(n) && n >= 1 && n <= maxCleared))].sort((a, b) => a - b)
    : [];
  return { maxCleared, current, skipped };
}

// どんな中身でも、使える形に直す(壊れたデータ・古い版のデータも読む)
export function normalize(raw) {
  const d = blank();
  if (!raw || typeof raw !== 'object') return d;
  const s = raw.settings && typeof raw.settings === 'object' ? raw.settings : {};
  if (typeof s.sound === 'boolean') d.settings.sound = s.sound;
  if (typeof s.haptics === 'boolean') d.settings.haptics = s.haptics;
  if (THEME_MODES.includes(s.theme)) d.settings.theme = s.theme;
  if (typeof s.volume === 'number' && s.volume >= 0 && s.volume <= 1) d.settings.volume = s.volume;
  if (raw.puzzles && typeof raw.puzzles === 'object') {
    for (const id of Object.keys(raw.puzzles)) d.puzzles[id] = normalizeProgress(raw.puzzles[id]);
  }
  if (Array.isArray(raw.rulesSeen)) d.rulesSeen = [...new Set(raw.rulesSeen.filter(x => typeof x === 'string'))];
  return d;
}

export function createStore(backend) {
  let data;
  try { data = normalize(JSON.parse(backend.get(STORE_KEY) || 'null')); } catch (e) { data = blank(); }
  const save = () => { try { backend.set(STORE_KEY, JSON.stringify(data)); } catch (e) {} };
  const prog = id => data.puzzles[id] || (data.puzzles[id] = normalizeProgress(null));

  return {
    get settings() { return { ...data.settings }; },
    setSetting(key, value) { data.settings[key] = value; save(); },

    progress(id) { const p = prog(id); return { ...p, skipped: [...p.skipped] }; },
    setCurrent(id, stage) {
      const p = prog(id);
      p.current = Math.max(1, Math.min(stage, p.maxCleared + 1));
      save();
    },
    hasSeenRules(id) { return data.rulesSeen.includes(id); },
    markRulesSeen(id) { if (!data.rulesSeen.includes(id)) { data.rulesSeen.push(id); save(); } },

    // 解いてクリア。前に飛ばしたステージなら、ふつうのクリアに変える
    markCleared(id, stage) {
      const p = prog(id);
      if (stage > p.maxCleared) p.maxCleared = stage;
      p.skipped = p.skipped.filter(n => n !== stage);
      save();
    },
    // 飛ばしてクリア扱い。もう解いたステージなら何も変えない
    markSkipped(id, stage) {
      const p = prog(id);
      if (stage > p.maxCleared) {
        p.maxCleared = stage;
        if (!p.skipped.includes(stage)) p.skipped.push(stage);
        save();
      }
    },
  };
}

export function browserBackend() {
  return {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  };
}
