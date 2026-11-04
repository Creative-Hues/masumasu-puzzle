// くすみ系5種類の配色(計画書の表どおり)。ステージごとに表の順で切り替える。名前は画面に出さない

export const THEMES = [
  { name: '秋の山', colors: ['#c18690', '#b39b6b', '#9eba78', '#c19986', '#6bb383', '#7899ba', '#ad86c1', '#b3b36b'] },
  { name: '古い喫茶店', colors: ['#bd9f89', '#aea96f', '#b67c81', '#a3bd89', '#6faea4', '#7c94b6', '#bd89bd', '#6fae7a'] },
  { name: '古本屋', colors: ['#b9ab8d', '#aa8174', '#818db1', '#b98d98', '#74aa7d', '#a181b1', '#b6b98d', '#74aaaa'] },
  { name: 'あじさいの小道', colors: ['#9d95c6', '#b87a99', '#88bf88', '#95b6c6', '#ad7ab8', '#bfa388', '#95c6ba', '#b8b87a'] },
  { name: '砂浜', colors: ['#bfb39b', '#83a8af', '#b7998f', '#9bbfb3', '#838eaf', '#b78f9c', '#b3bf9b', '#9d83af'] },
];

export function themeFor(stage) {
  return THEMES[(stage - 1) % THEMES.length];
}

export function colorsFor(stage) {
  return themeFor(stage).colors;
}
