import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const [repository, tag] = process.argv.slice(2);
if (!repository || !tag) {
  throw new Error('Usage: node scripts/write-release-source-link.mjs <owner/repository> <release-tag>');
}

const sourceAsset = `libav-6.10.9.0-patentfree-player-corresponding-source-${tag}.tar.xz`;
const baseUrl = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}`;
const destination = resolve('public/libav-patentfree/release-source.json');

await mkdir(resolve('public/libav-patentfree'), { recursive: true });
await writeFile(
  destination,
  `${JSON.stringify(
    {
      tag,
      sourceUrl: `${baseUrl}/${encodeURIComponent(sourceAsset)}`,
      checksumUrl: `${baseUrl}/${encodeURIComponent(`${sourceAsset}.sha256`)}`,
    },
    null,
    2,
  )}\n`,
);
