# Patent-Free Decoder Variant

This is the reproducible `libav.js` configuration for the optional software
all-in-one player used by the demo. It contains only codecs selected for their
patent-free status: VP9, AV1 (via libaom), FLAC, and PCM. The same runtime demuxes
Matroska, MOV/MP4, Ogg, FLV, and AVI; WebCodecs remains preferred for streams
the browser supports.

It intentionally excludes H.264/AVC, HEVC, AAC, MPEG audio, Theora, Vorbis,
VP8, and Opus. The selected container demuxers are included because this
variant replaces the regular demux runtime when configured.

The current build input is libav.js commit
`c80e885c3461f7bb7ea565c9631b34243ae0dbf1` (release 6.10.9, FFmpeg 9.0).
Use the reproducible build script:

```sh
./libav/build/build-patentfree-player.sh
```

See [`build/README.md`](build/README.md) for prerequisites, the output
directory, and the deliberate release-copy procedure.

Copy the generated `libav-*-patentfree-player.mjs` and
`libav-*-patentfree-player.wasm.wasm` assets into
`public/libav-patentfree/`. The generated output includes LGPL-licensed FFmpeg
code; distributing it requires preserving its license notices and making the
corresponding source available. Do not rely on upstream URLs alone for a public
release. The release workflow creates a versioned corresponding-source archive
containing the exact libav.js, FFmpeg and libaom sources as well as this
configuration, build script, notices and checksums. The TypeScript package
itself remains MIT.

For public distribution, push a version tag matching the npm package version,
for example `v0.1.0` for version `0.1.0`. The release workflow creates a draft,
attaches and verifies the generated artifacts, publishes the completed release,
then deploys GitHub Pages. A normal branch push never deploys the demo.

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
