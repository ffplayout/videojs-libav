import { copyFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const source = join(root, 'node_modules/@libav.js/variant-webcodecs/dist');
const target = join(root, 'public/libav');
const bridge = join(root, 'node_modules/libavjs-webcodecs-bridge/dist/libavjs-webcodecs-bridge.mjs');

// The worker always uses the ESM, non-threaded WebAssembly target. Keeping this
// list explicit avoids publishing asm.js and pthread artifacts the demo cannot
// load.
const assets = ['libav-webcodecs.mjs', 'libav-6.9.8.1-webcodecs.wasm.mjs', 'libav-6.9.8.1-webcodecs.wasm.wasm'];

await mkdir(target, { recursive: true });
await Promise.all([
  ...assets.map((file) => copyFile(join(source, file), join(target, file))),
  copyFile(bridge, join(target, 'libavjs-webcodecs-bridge.mjs')),
]);
