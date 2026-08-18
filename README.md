# Universal Playback Lab

This repository contains a GitHub-Pages-ready Vite demo and the publishable
[`videojs-libav`](packages/videojs-libav) package. It uses locally installed
Video.js 10 packages, libav.js, WebCodecs, and an AudioWorklet; it does not load
scripts from a CDN.

## Playback model

- Native `<video>` playback is selected first when the browser reports support
  for the source MIME type.
- `<libav-video>` is used for the libav.js/WebCodecs fallback, for example for
  Matroska sources the native element cannot play.
- libav.js demuxes in a module worker. WebCodecs is preferred for decoding;
  rejected streams use the bundled patent-free libav.js decoder variant.
  Canvas renders video and AudioWorklet provides the audio master clock.
- HTTP sources returning `206 Partial Content` are connected to libav.js as an
  on-demand block reader, so large media is not downloaded into WASM memory as
  one complete file.
- The Video.js 10 default skin supplies the seek bar, time display, volume
  control, fullscreen control, settings menu, and keyboard shortcuts.

## Run the demo

```bash
npm install
npm run dev
```

Open the URL printed by Vite. The demo starts with a Theora/Vorbis Matroska
fixture, so libav.js must demux it and the patent-free software variant must
decode both streams. The fixture picker also includes:

- Theora/Vorbis Matroska with two audio tracks, including an audio-track picker.
- Theora/FLAC Matroska.
- The original ten-second H.264/Opus A/V-sync fixture, which demonstrates the
  libav.js demux + WebCodecs-preferred path.

All fixtures are generated from FFmpeg's `avsynctest` source and live in
[`public/media`](public/media). You can select another local media file with the
file picker.

Vite serves the libav.js loader and WASM files from `/libav/` during development
and copies them to `dist/libav/` for production. The demo sets the package's
`libavBase` property to that local directory. The optional local
`/libav-patentfree/` variant contains VP8, VP9, AV1, Theora, Vorbis, Opus,
FLAC, and PCM decoders; it loads only when WebCodecs rejects a stream. Its
reproducible configuration and update procedure are documented in
[`libav/`](libav). The deployed patent-free runtime directory also contains its
[LGPL notice, build inputs, and pinned upstream source links](public/libav-patentfree/NOTICE.md).

## Large-file hosting

For progressive playback and efficient seeks, serve media with HTTP byte-range
support (`Accept-Ranges: bytes`) and return `206 Partial Content` plus
`Content-Range` for requests containing `Range`. The worker requests up to
1 MiB beyond each libav.js read, so memory remains bounded while demuxing and
decoding continue. If the server does not support ranges, the player retains a
full-download compatibility fallback intended for the small local fixtures.

For cross-origin media, CORS must allow `Range` and expose `Content-Range`.

```bash
npm run typecheck
npm test
npm run format:check
npm run build
npm run preview
```

Use a Chromium-family browser with `VideoDecoder`, `AudioDecoder`, and
`AudioWorklet` support.

## GitHub Pages

The included [deployment workflow](.github/workflows/deploy-pages.yml) builds
the Vite site and publishes `dist/` through GitHub Pages after a push to `main`
(or when manually dispatched). In the repository settings, set **Pages → Build
and deployment → Source** to **GitHub Actions** once. The relative Vite base
works for both a project URL such as
`https://OWNER.github.io/REPOSITORY/` and local hosting.

The workflow follows GitHub's official Pages artifact/deployment model.
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
documents the required repository setting and deployment permissions.

## Package

The npm-ready package is in [`packages/videojs-libav`](packages/videojs-libav).
It is MIT licensed. Its README documents the public API, required libav.js
assets, MVP limits, and publishing workflow.
