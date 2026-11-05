// オフライン用(Service Worker)
// 開くときは、まずネットから新しいものを取りに行き、取れなければ(機内モードなど)端末にしまったものを使う
// ファイルを足したら FILES にも足すこと(tests/sw.test.mjs が確かめる)

const CACHE = 'masumasu-v1';
const FILES = [
  './',
  'manifest.webmanifest',
  'css/base.css',
  'css/screens.css',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon.svg',
  'js/app.js',
  'js/core/haptics.js',
  'js/core/hints.js',
  'js/core/palettes.js',
  'js/core/rng.js',
  'js/core/sound.js',
  'js/core/stages.js',
  'js/core/storage.js',
  'js/core/theme.js',
  'js/puzzles/majikiri/logic.js',
  'js/puzzles/majikiri/majikiri.js',
  'js/puzzles/nobishiro/logic.js',
  'js/puzzles/nobishiro/nobishiro.js',
  'js/puzzles/registry.js',
  'js/puzzles/utsushie/logic.js',
  'js/puzzles/utsushie/utsushie.js',
  'js/puzzles/yotsutsuji/logic.js',
  'js/puzzles/yotsutsuji/worker.js',
  'js/puzzles/yotsutsuji/yotsutsuji.js',
  'js/ui/home.js',
  'js/ui/look.js',
  'js/ui/play.js',
  'js/ui/settings.js',
  'js/ui/stage-list.js',
  'js/ui/thumbs.js',
];
const WAIT_MS = 3000; // ネットが遅いときは、この時間で端末のものに切り替える

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function fromCache(req) {
  const hit = await caches.match(req, { ignoreSearch: true });
  if (hit) return hit;
  if (req.mode === 'navigate') return caches.match('./');
  return undefined;
}

async function handle(req) {
  const net = fetch(req).then(async res => {
    if (res.ok && !res.redirected) {
      const c = await caches.open(CACHE);
      await c.put(req, res.clone());
    }
    return res;
  });
  const slow = new Promise(r => setTimeout(() => r('slow'), WAIT_MS));
  try {
    const first = await Promise.race([net, slow]);
    if (first !== 'slow') return first;
    return (await fromCache(req)) || (await net);
  } catch (e) {
    const hit = await fromCache(req);
    if (hit) return hit;
    throw e;
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(handle(req));
});
