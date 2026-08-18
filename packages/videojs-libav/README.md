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
- Multiple audio streams are exposed through `audioTracks`; select one with
  `selectAudioTrack(streamIndex)`.

The native path supports MP4/H.264/AAC, MKV/H.264/AAC, and MKV/VP9/Opus when
the browser accepts the corresponding WebCodecs configuration. The optional
software path currently targets patent-free VP8, VP9, AV1, Theora, Vorbis,
Opus, FLAC, and PCM. Subtitle tracks, indexed seeking, and streaming input are not
implemented yet. Seeking currently restarts the pipeline and suppresses output
until the requested timestamp, so it is correct but not fast for long files.

## Video.js 10 integration

Video.js 10 uses custom media elements rather than the legacy Video.js 8
`Tech`/`techOrder` registry. The following legacy API is therefore not part of
this package:

```js
videojs('video', { techOrder: ['html5', 'libav'] });
```

Register the element once, then let the application select native playback
first. If the native element reports `''` for `canPlayType`, render
`<libav-video>` instead. Applications may also explicitly switch to the fallback
after a native playback error.

```ts
import { defineLibavVideoElement, shouldUseLibavFallback } from 'videojs-libav';

defineLibavVideoElement();

const source = { src: '/movie.mkv', type: 'video/x-matroska' };
const media = shouldUseLibavFallback(source) ? document.createElement('libav-video') : document.createElement('video');

if (media.tagName === 'LIBAV-VIDEO') {
  // Directory containing the libav.js ESM loader and WASM files.
  media.libavBase = new URL('/assets/libav/', window.location.origin).href;
  // Optional directory containing libav-patentfree-player.mjs and its WASM.
  // It is used only for streams WebCodecs rejects.
  media.softwareDecoderBase = new URL('/assets/libav-patentfree/', window.location.origin).href;
}

media.src = source.src;
```

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

The worker reads at most 512 KiB per libav.js call and has a 32-chunk credit
window. The main thread limits the WebCodecs decode queues and retains at most
eight unrendered `VideoFrame`s. Backpressure prevents slow decoding or rendering
from causing unbounded packet or frame accumulation.

## libav.js assets

The package intentionally does not publish the approximately 15 MB
`@libav.js/variant-webcodecs` distribution. Applications must host a compatible
libav.js build and set `libavBase` to its directory. If `libavBase` is omitted,
the worker resolves libav.js files relative to `demux-worker.mjs`.

The host needs to make the libav.js ESM loader, its selected WASM target, and
`libavjs-webcodecs-bridge.mjs` available. The worker imports these assets at
runtime rather than through the bundler. The Vite demo in this repository shows
one integration that copies them to `/libav/` and sets `libavBase` automatically.

The optional software decoder uses a separately hosted, on-demand variant named
`libav-patentfree-player.mjs`. Its reproducible config is in this repository's
`libav/` directory. It deliberately excludes H.264, HEVC, AAC, and MPEG audio.
Distributing a custom libav.js build requires fulfilling its FFmpeg/libav.js
source-distribution obligations.

## Browser and server requirements

- Chromium-family browser with `VideoDecoder`, `AudioDecoder`, and
  `AudioWorklet`.
- Same-origin media, or CORS that allows the worker to `fetch` the source.
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
