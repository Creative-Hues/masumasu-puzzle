// ヒントの回数。1ステージ3回まで。ステージを開き直すと3回に戻る(保存しない)

export const HINT_LIMIT = 3;

export function createHintCounter(limit = HINT_LIMIT) {
  let used = 0;
  return {
    get left() { return limit - used; },
    get exhausted() { return used >= limit; },
    use() {
      if (used >= limit) return false;
      used++;
      return true;
    },
  };
}
