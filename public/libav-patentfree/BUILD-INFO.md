# Patent-Free libav.js Build Information

This document describes the source corresponding to the WASM assets in this
directory. It applies only to the three `libav-*-patentfree-player.*` runtime
files, not to the MIT-licensed TypeScript package or demo application.

## Build inputs

- libav.js release: `6.10.9` (`c80e885c3461f7bb7ea565c9631b34243ae0dbf1`)
- FFmpeg release: `9.0`
- libaom revision: `03087864` (AV1 software decoder; BSD-2-Clause)
- Variant name: `patentfree-player`
- Configuration: [`sources/patentfree-player.config.json`](sources/patentfree-player.config.json)
- Threading: disabled at runtime with `noworker: true` and `nothreads: true`

## Upstream source locations

- libav.js: <https://github.com/Yahweasel/libav.js/tree/c80e885c3461f7bb7ea565c9631b34243ae0dbf1>
- FFmpeg 9.0: <https://ffmpeg.org/releases/ffmpeg-9.0.tar.xz>
  - SHA-256: `7f607a00dd0d28a729d5a4811205812eef01cf6ef6155025febb6f36a9062d52`
- libaom: <https://gitlab.com/webmproject/libaom/-/tree/03087864>

The checked-in configuration is the only repository-specific build input. The
libav.js source archive includes its FFmpeg patch set and build scripts. No
repository patch is applied to either upstream source tree.

## Build command

From the pinned libav.js checkout, with the configuration file from this
directory available as `patentfree-player.config.json`:

```sh
node configs/mkconfig.js patentfree-player "$(tr -d '\n ' < patentfree-player.config.json)"
make build-patentfree-player
```

The resulting ESM loader and non-threaded WASM target are published here as:

- `libav-patentfree-player.mjs`
- `libav-6.10.9.0-patentfree-player.wasm.mjs`
- `libav-6.10.9.0-patentfree-player.wasm.wasm`

`SOURCES.sha256` records SHA-256 digests for the published runtime files. Run
the verification from this directory:

```sh
sha256sum --check SOURCES.sha256
```
