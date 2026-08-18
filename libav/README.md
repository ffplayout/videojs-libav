# Patent-Free Decoder Variant

This is the reproducible `libav.js` configuration for the optional software
decoder used by the demo. It contains only codecs selected for their
patent-free status: VP8, VP9, AV1, Theora, Vorbis, Opus, FLAC, and PCM.

It intentionally excludes H.264/AVC, HEVC, AAC, MPEG audio, and their related
codec parsers. The MP4 and Matroska demuxers remain so that patent-free streams
in those containers can be read.

The current build input is libav.js commit
`fe0fb3e89a68637082f02e9cb75b725bb9d3a1ea` (FFmpeg 9.0). Build the variant
from that pinned checkout:

```sh
node configs/mkconfig.js patentfree-player "$(tr -d '\n ' < /path/to/libav/patentfree-player.config.json)"
make build-patentfree-player
```

Copy the generated `libav-*-patentfree-player.mjs` and
`libav-*-patentfree-player.wasm.wasm` assets into
`public/libav-patentfree/`. The generated output includes LGPL-licensed FFmpeg
code; distributing it requires preserving its license notices and making the
corresponding source available. This repository publishes pinned source links,
configuration, checksums, and an LGPL notice alongside the assets in
`public/libav-patentfree/`. The TypeScript package itself remains MIT.

For updates, pin a new upstream commit deliberately, review the generated
configuration and license notices, rerun playback tests, then update this
commit reference, build information, source links, checksums, and notices with
the assets.

## Using the full libav.js variant instead

The player can also use the official `@libav.js/variant-default` build for
software decoding. Host its ESM loader and matching WASM assets yourself, or
use a CDN that permits cross-origin module loading. Then set
`softwareDecoderBase` to that directory:

```ts
const media = document.querySelector('libav-video') as HTMLElement & {
  softwareDecoderBase: string;
};
media.softwareDecoderBase = new URL('/assets/libav-full/', window.location.origin).href;
```

The worker currently imports `libav-patentfree-player.mjs`; a full variant must
therefore be published with that filename, or the application must provide a
small compatible loader under that name. It must in turn resolve the full
variant's `*.wasm.mjs` and `*.wasm.wasm` files from the same directory.

The full variant is useful when broad legacy-codec coverage matters more than a
strict codec policy. It can include codecs such as H.264, HEVC, AAC, and MPEG
audio. Those codecs are intentionally excluded from the patent-free variant;
using them can create patent-licensing obligations depending on jurisdiction
and product use. Open-source licensing does not itself grant codec patent
rights. Review the exact build configuration, its FFmpeg/libav.js license
notices, and the relevant patent position before distributing a full build.
