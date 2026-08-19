#!/usr/bin/env bash
# Package every runtime file loaded by the published demo as one release asset.
# Usage: ./scripts/package-runtime.sh <output-directory> <release-tag>
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <output-directory> <release-tag>" >&2
  exit 64
fi

mkdir -p "$1"
output_dir=$(cd -- "$1" && pwd)
release_tag=$2
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
archive_name="videojs-libav-runtime-${release_tag}.tar.xz"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/videojs-libav-runtime.XXXXXX")
stage_dir="$work_dir/videojs-libav-runtime-${release_tag}"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

mkdir -p "$stage_dir"
cp -R "$project_dir/public/libav" "$stage_dir/libav"
cp -R "$project_dir/public/libav-patentfree" "$stage_dir/libav-patentfree"

printf '%s\n' \
  "# videojs-libav runtime ${release_tag}" \
  '' \
  'This archive contains every ESM loader, WebAssembly factory, WebAssembly' \
  'binary, bridge module, notice, and license file loaded by the demo fallback.' \
  '' \
  '- libav/: official libav.js WebCodecs runtime' \
  '- libav-patentfree/: optional all-in-one software-decoder runtime' \
  '- libav-patentfree/NOTICE.md: licensing and corresponding-source information' \
  '- SHA256SUMS: checksums for every file in this archive' \
  > "$stage_dir/README.md"

(
  cd "$stage_dir"
  find libav libav-patentfree -type f -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS
)

tar --create --xz --file "$output_dir/$archive_name" --directory "$work_dir" "$(basename "$stage_dir")"
sha256sum "$output_dir/$archive_name" > "$output_dir/${archive_name}.sha256"
printf '%s\n' "$output_dir/$archive_name"
