# videojs-libav

`videojs-libav` is an MIT-licensed Video.js 10 custom media element for media
containers that cannot be played by the browser natively. It owns demuxing,
decoding, rendering, and audio output. The Video.js player or skin around it
continues to own the controls and UI.

## Status

This is an MVP targeting browsers with WebCodecs and AudioWorklet support.

- Demuxing runs in a module worker through libav.js.
- Video uses `VideoDecoder` and a Canvas renderer.
- Audio uses `AudioDecoder` and AudioWorklet; its clock is the A/V master.
- If WebCodecs rejects a stream, an optional, separate libav.js software
  decoder variant is used in the same worker.
- Packet, decoder, and frame queues use bounded backpressure.
- HTTP sources with byte-range support are served to libav.js through its
  asynchronous block-reader device, so the complete resource is not loaded
  before playback starts.
- Multiple audio streams are exposed through `audioTracks`; select one with
  `selectAudioTrack(streamIndex)`.

The native path supports MP4/H.264/AAC, MKV/H.264/AAC, and MKV/VP9/Opus when
the browser accepts the corresponding WebCodecs configuration. The optional
all-in-one software path targets patent-free VP9, AV1, FLAC, and PCM. It also
demuxes Matroska, MOV/MP4, Ogg, FLV, and AVI in the same WASM instance. Subtitle
tracks and adaptive/live protocols are not implemented yet. Seeking restarts
the bounded pipeline and asks libav.js to seek from a preceding keyframe; when
byte ranges are available, this requests only the corresponding source ranges
rather than the entire file.

## Video.js 10 integration

Video.js 10 uses custom media elements rather than the legacy Video.js 8
`Tech`/`techOrder` registry. The following legacy API is therefore not part of
this package:

```js
videojs('video', { techOrder: ['html5', 'libav'] });
```

For the usual application case, use the high-level helper. It registers the
element, chooses native playback first, creates the Video.js player and default
skin, and configures the libav.js fallback when needed.

```ts
import '@videojs/html/video/skin.css';
import { createLibavPlayer } from 'videojs-libav';

const assets = new URL('./', window.location.href);
const player = createLibavPlayer({
  target: '#player',
  source: { src: '/movie.mkv', type: 'video/x-matroska' },
  softwareDecoderBase: new URL('libav-patentfree/', assets).href,
});

// Switch sources later if needed.
player.setSource({
  source: { src: '/another-file.mkv', type: 'video/x-matroska' },
  softwareDecoderBase: new URL('libav-patentfree/', assets).href,
});
```

`player.media` exposes the underlying native `<video>` or `<libav-video>`
element; `player.usesLibav` reports the selected route. Call `player.destroy()`
when the target is removed.

For custom player markup, import `defineLibavVideoElement` and
`shouldUseLibavFallback` directly. They remain part of the public API.

`libav-video` implements the media-element surface required by controls:
`play()`, `pause()`, `src`, `currentTime`, `duration`, `volume`, `muted`, and
standard playback events including `loadstart`, `loadedmetadata`, `play`,
`pause`, `timeupdate`, `seeking`, `seeked`, `ended`, and `error`.

## Pipeline

```text
libav-video → Demux Worker → WebCodecs decoder ───────→ Canvas / AudioWorklet
                         └→ patent-free libav.js decoder ┘
                                                       ↑
                                                 master clock
```

The worker reads at most 512 KiB per libav.js demux call and reads no more than
1 MiB beyond an on-demand HTTP byte-range request. It has a 32-chunk credit
window. The main thread limits the WebCodecs decode queues and retains at most
16 unrendered `VideoFrame`s. Backpressure prevents slow decoding or rendering
from causing unbounded packet or frame accumulation.

## libav.js assets

The package intentionally does not publish libav.js runtime assets. The caller
chooses one of two routes:

- Set only `libavBase` to use the regular `@libav.js/variant-webcodecs` runtime.
  This is the smallest route and uses WebCodecs only; unsupported codecs fail
  rather than loading a software decoder.
- Set `softwareDecoderBase` to use the all-in-one patent-free player runtime.
  It demuxes and software-decodes in one WASM module while still preferring
  WebCodecs for supported streams. If both options are set, this route wins.

If neither option is supplied, the worker resolves the regular WebCodecs assets
relative to `demux-worker.mjs`.

The host needs to make the selected loader, matching WASM target, and
`libavjs-webcodecs-bridge.mjs` available in the chosen runtime directory. The
worker imports them at runtime rather than through the bundler. The Vite demo
shows both runtime directories, but selects the all-in-one player by default.

The optional all-in-one runtime is named `libav-patentfree-player.mjs`. Its
reproducible config is in this repository's `libav/` directory. It deliberately
excludes H.264, HEVC, AAC, MPEG audio, Theora, Vorbis, VP8, and Opus.
Distributing a custom libav.js build requires fulfilling its FFmpeg/libav.js
source-distribution obligations.

## Browser and server requirements

- Chromium-family browser with `VideoDecoder`, `AudioDecoder`, and
  `AudioWorklet`.
- Same-origin media, or CORS that allows the worker to `fetch` the source.
- For progressive large-file playback: HTTP range support. A `Range: bytes=0-0`
  probe must return `206 Partial Content` with `Content-Range`; cross-origin
  servers must additionally expose `Content-Range` to JavaScript. Servers
  without this support use the full-download compatibility fallback.
- A bundler that supports
  `new Worker(new URL(..., import.meta.url), { type: 'module' })`.

## Development

```bash
npm install
npm run typecheck
npm test
npm run build
npm pack --dry-run
```

## Publishing

The package name is currently `videojs-libav`. From this directory, publish a
verified build after logging in to npm:

```bash
npm publish
```
