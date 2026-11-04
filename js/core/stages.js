// 20ステージごとの段階。1〜20が0段階目、21〜40が1段階目…101〜はずっと5段階目

export const TIER_SIZE = 20;
export const TIER_COUNT = 6;

export function tierOf(stage) {
  return Math.min(TIER_COUNT - 1, Math.floor((stage - 1) / TIER_SIZE));
}

// 段階の中で何番目か(0〜19)。区切りの中の細かい変化に使う
export function stepInTier(stage) {
  return (stage - 1) % TIER_SIZE;
}
