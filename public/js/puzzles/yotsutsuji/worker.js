// よつつじの問題を裏側(Web Worker)で作る。画面が止まらないように、次のステージを先に作っておくのに使う
import { generate } from './logic.js';
import { stageRng } from '../../core/rng.js';

self.onmessage = e => {
  const stage = e.data;
  self.postMessage({ stage, pz: generate(stage, stageRng('yotsutsuji', stage)) });
};
