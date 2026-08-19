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

Open the URL printed by Vite. The demo starts with a VP9/FLAC Matroska fixture,
so the all-in-one patent-free variant demuxes and software-decodes both
streams. The fixture picker also includes:

- VP9 Profile 2 with 10-bit YUV420 video and FLAC audio.
- AV1 Main 10-bit and AV1 Professional 12-bit YUV420 fixtures.
- VP9 10-bit with two separately labelled FLAC tracks and an audio-track picker.
- H.264/AAC and VP8/MP3 Matroska fixtures for the browser WebCodecs path.
- VP9/PCM, which validates the bundled signed-16-bit PCM software decoder.
- MOV, FLV, AVI, and Ogg fixtures with distinct FFmpeg test patterns or an
  audio-only sine wave, covering every bundled container demuxer.

All fixtures are generated from FFmpeg's `avsynctest` source and live in
[`public/media`](public/media). You can select another local media file with the
file picker.

Vite serves the libav.js loader and WASM files from `/libav/` during development
and copies them to `dist/libav/` for production. The demo sets the package's
`libavBase` property to that local directory. The optional local
`/libav-patentfree/` variant contains VP9, AV1, FLAC, and PCM decoders; it can
also replace the normal demux runtime so one WASM module handles the entire
fallback route. Its
reproducible configuration and update procedure are documented in
[`libav/`](libav). The deployed patent-free runtime directory also contains its
[LGPL notice and build inputs](public/libav-patentfree/NOTICE.md). Every
published GitHub release attaches the matching corresponding-source archive and
its SHA-256 checksum.

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

The [release-preparation workflow](.github/workflows/prepare-release.yml)
creates the npm package, corresponding-source archive and SHA-256 manifest for
an existing **draft** GitHub Release. After reviewing its assets, publish that
draft; the [Pages workflow](.github/workflows/deploy-pages.yml) then verifies
the tag and deploys `dist/`. It never deploys after an ordinary push. In the
repository settings, set **Pages → Build and deployment → Source** to
**GitHub Actions** once. The relative Vite base works for both a project URL such as
`https://OWNER.github.io/REPOSITORY/` and local hosting.

To publish, first push a signed or reviewed tag whose contents include the
runtime assets and source configuration. Create a **draft** GitHub Release from
that tag, run **Prepare draft release artifacts** with the tag as input, inspect
the uploaded files and only then publish the draft. The source archive contains
the exact libav.js, FFmpeg and libaom source inputs plus this project's
configuration, build script, notices and runtime checksums.

During the Pages deployment, the workflow writes release-specific metadata into
the site. The demo footer therefore links directly to the exact corresponding-
source archive and its SHA-256 companion file for the deployed release.

The workflow follows GitHub's official Pages artifact/deployment model.
[GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
documents the required repository setting and deployment permissions.

## Package

The npm-ready package is in [`packages/videojs-libav`](packages/videojs-libav).
It is MIT licensed. Its README documents the public API, required libav.js
assets, MVP limits, and publishing workflow.
