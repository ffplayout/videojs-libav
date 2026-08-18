# Patent-Free libav.js Build Information

This document describes the source corresponding to the WASM assets in this
directory. It applies only to the three `libav-*-patentfree-player.*` runtime
files, not to the MIT-licensed TypeScript package or demo application.

## Build inputs

- libav.js commit: `fe0fb3e89a68637082f02e9cb75b725bb9d3a1ea`
- FFmpeg release: `9.0`
- Variant name: `patentfree-player`
- Configuration: [`sources/patentfree-player.config.json`](sources/patentfree-player.config.json)
- Threading: disabled at runtime with `noworker: true` and `nothreads: true`

## Upstream source locations

- libav.js: <https://github.com/Yahweasel/libav.js/archive/fe0fb3e89a68637082f02e9cb75b725bb9d3a1ea.tar.gz>
  - SHA-256: `645958a8b1a18536384bfe04a250e676ac40f11d47430f2d12fbf5e0b84207df`
- FFmpeg 9.0: <https://ffmpeg.org/releases/ffmpeg-9.0.tar.xz>
  - SHA-256: `7f607a00dd0d28a729d5a4811205812eef01cf6ef6155025febb6f36a9062d52`

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
- `libav-6.9.9.0-patentfree-player.wasm.mjs`
- `libav-6.9.9.0-patentfree-player.wasm.wasm`

`SOURCES.sha256` records SHA-256 digests for the published runtime files. Run
the verification from this directory:

```sh
sha256sum --check SOURCES.sha256
```
