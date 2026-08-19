#!/usr/bin/env bash
# Build the pinned all-in-one libav.js player into libav/build/output.
# Requires git, Docker (or CONTAINER_RUNTIME=podman), Node.js, and network access.
set -euo pipefail

script_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd -- "$script_dir/../.." && pwd)
output_dir=${OUTPUT_DIR:-"$script_dir/output"}
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/videojs-libav-build.XXXXXX")
runtime=${CONTAINER_RUNTIME:-docker}
revision=c80e885c3461f7bb7ea565c9631b34243ae0dbf1
image=videojs-libav-build:6.10.9

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

command -v git >/dev/null || { echo 'git is required' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required' >&2; exit 1; }
command -v "$runtime" >/dev/null || { echo "$runtime is required" >&2; exit 1; }

git clone --filter=blob:none https://github.com/Yahweasel/libav.js.git "$work_dir/libav.js"
git -C "$work_dir/libav.js" checkout "$revision"
cp "$repo_dir/libav/patentfree-player.config.json" "$work_dir/libav.js/patentfree-player.config.json"

(
  cd "$work_dir/libav.js/configs"
  node mkconfig.js patentfree-player "$(tr -d '\n ' < ../patentfree-player.config.json)"
)

# FFmpeg's configure defaults to host `nm`; the current Emscripten image needs
# its WebAssembly-aware equivalent. This change exists only in the temporary
# checkout and is not a patch to libav.js.
sed -i 's/--ranlib=emranlib/--ranlib=emranlib --nm=emnm/g' "$work_dir/libav.js/mk/ffmpeg.mk"

"$runtime" build --tag "$image" --file "$work_dir/libav.js/Dockerfile.development" "$work_dir/libav.js"
mkdir -p "$output_dir"
"$runtime" run --rm \
  -v "$work_dir/libav.js:/src:Z" \
  -v "$output_dir:/out:Z" \
  -w /src "$image" sh -lc '
    make build-patentfree-player -j2
    cp dist/libav-patentfree-player.mjs /out/
    cp dist/libav-6.10.9.0-patentfree-player.wasm.mjs /out/
    cp dist/libav-6.10.9.0-patentfree-player.wasm.wasm /out/
  '

sha256sum "$output_dir"/*patentfree-player*.mjs "$output_dir"/*.wasm
echo "Built libav.js 6.10.9.0 into $output_dir"
