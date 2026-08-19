# Build the patent-free player

`build-patentfree-player.sh` creates the all-in-one, non-threaded libav.js
runtime used by this project. It checks out the pinned libav.js 6.10.9 source,
generates the configuration from `../patentfree-player.config.json`, and builds
only the selected player variant in a Docker or Podman container.

## Requirements

- Git, Node.js, and Docker; set `CONTAINER_RUNTIME=podman` for Podman.
- Network access for the pinned libav.js checkout and its FFmpeg build input.
- On Linux with SELinux, the script uses Docker/Podman `:Z` volume labels. On
  systems where those labels are unsupported, remove `:Z` from the two mount
  arguments in the script.

## Build

```sh
./libav/build/build-patentfree-player.sh
```

The generated files are written to `libav/build/output/`, which is ignored by
Git. To use a different directory:

```sh
OUTPUT_DIR=/tmp/libav-player-output ./libav/build/build-patentfree-player.sh
```

The script never overwrites `public/libav-patentfree/`. After inspecting the
three generated files and their printed SHA-256 values, copy them deliberately
into that runtime directory, update `SOURCES.sha256`, `BUILD-INFO.md`, and run
the project checks.

## What it builds

The configuration includes libavformat/libavcodec, Matroska, MOV/MP4, Ogg, FLV,
and AVI demuxers; AAC, FLAC, H.264, MPEG-audio, Opus, VP8, VP9, and AV1 parsers
for handing browser-supported streams to WebCodecs; and VP9, AV1 via libaom,
FLAC, and PCM decoders. It deliberately omits software decoders for Theora,
Vorbis, VP8, Opus, H.264, HEVC, AAC, and MPEG audio.

The temporary source checkout is deleted after the build. The container image
is retained as `videojs-libav-build:6.10.9`; remove it manually if no longer
needed.
