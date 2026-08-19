import { copyFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const packageRoot = join(root, 'node_modules/@libav.js/variant-webcodecs');
const source = join(packageRoot, 'dist');
const target = join(root, 'public/libav');
const bridge = join(root, 'node_modules/libavjs-webcodecs-bridge/dist/libavjs-webcodecs-bridge.mjs');

// The worker always uses the ESM, non-threaded WebAssembly target. Keeping this
// list explicit avoids publishing asm.js and pthread artifacts the demo cannot
// load.
const { version } = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'));
const runtimeVersion = `${version}.0`;
const assets = [
  'libav-webcodecs.mjs',
  `libav-${runtimeVersion}-webcodecs.wasm.mjs`,
  `libav-${runtimeVersion}-webcodecs.wasm.wasm`,
];

await mkdir(target, { recursive: true });
await Promise.all([
  ...assets.map((file) => copyFile(join(source, file), join(target, file))),
  copyFile(bridge, join(target, 'libavjs-webcodecs-bridge.mjs')),
]);
