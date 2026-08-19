#!/usr/bin/env bash
# Create the complete, versioned source offer for the checked-in libav.js WASM.
# Usage: ./scripts/package-corresponding-source.sh <output-directory> <release-tag>
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <output-directory> <release-tag>" >&2
  exit 64
fi

mkdir -p "$1"
output_dir=$(cd -- "$1" && pwd)
release_tag=$2
project_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
libav_revision=c80e885c3461f7bb7ea565c9631b34243ae0dbf1
ffmpeg_version=9.0
ffmpeg_sha256=7f607a00dd0d28a729d5a4811205812eef01cf6ef6155025febb6f36a9062d52
libaom_revision=03087864
opus_version=1.6.1
archive_name="videojs-libav-corresponding-source-${release_tag}.tar.xz"
work_dir=$(mktemp -d "${TMPDIR:-/tmp}/videojs-libav-source.XXXXXX")
stage_dir="$work_dir/videojs-libav-corresponding-source-${release_tag}"

cleanup() {
  rm -rf "$work_dir"
}
trap cleanup EXIT

command -v git >/dev/null || { echo 'git is required' >&2; exit 1; }
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 1; }
command -v tar >/dev/null || { echo 'tar is required' >&2; exit 1; }

mkdir -p "$stage_dir/project/libav/build" "$stage_dir/project/public/libav-patentfree" "$stage_dir/upstream"

git clone --filter=blob:none https://github.com/Yahweasel/libav.js.git "$stage_dir/upstream/libav.js"
git -C "$stage_dir/upstream/libav.js" checkout "$libav_revision"
rm -rf "$stage_dir/upstream/libav.js/.git"

curl --fail --location --retry 3 --output "$work_dir/ffmpeg-${ffmpeg_version}.tar.xz" \
  "https://ffmpeg.org/releases/ffmpeg-${ffmpeg_version}.tar.xz"
echo "$ffmpeg_sha256  $work_dir/ffmpeg-${ffmpeg_version}.tar.xz" | sha256sum --check --status
tar --extract --file "$work_dir/ffmpeg-${ffmpeg_version}.tar.xz" --directory "$stage_dir/upstream"

git clone --filter=blob:none https://gitlab.com/webmproject/libaom.git "$stage_dir/upstream/libaom"
git -C "$stage_dir/upstream/libaom" checkout "$libaom_revision"
rm -rf "$stage_dir/upstream/libaom/.git"

curl --fail --location --retry 3 --output "$work_dir/opus-${opus_version}.tar.gz" \
  "https://downloads.xiph.org/releases/opus/opus-${opus_version}.tar.gz"
tar --extract --file "$work_dir/opus-${opus_version}.tar.gz" --directory "$stage_dir/upstream"

cp "$project_dir/libav/patentfree-player.config.json" "$stage_dir/project/libav/"
cp "$project_dir/libav/build/build-patentfree-player.sh" "$stage_dir/project/libav/build/"
cp "$project_dir/libav/build/README.md" "$stage_dir/project/libav/build/"
cp "$project_dir/public/libav-patentfree/BUILD-INFO.md" "$stage_dir/project/public/libav-patentfree/"
cp "$project_dir/public/libav-patentfree/NOTICE.md" "$stage_dir/project/public/libav-patentfree/"
cp "$project_dir/public/libav-patentfree/SOURCES.sha256" "$stage_dir/project/public/libav-patentfree/"
cp -R "$project_dir/public/libav-patentfree/licenses" "$stage_dir/project/public/libav-patentfree/licenses"

printf '%s\n' \
  "# Corresponding Source for ${release_tag}" \
  '' \
  'This archive is the corresponding source for the libav.js runtime files' \
  'published with this GitHub release.' \
  '' \
  "- libav.js: ${libav_revision}" \
  "- FFmpeg: ${ffmpeg_version} (SHA-256: ${ffmpeg_sha256})" \
  "- libaom: ${libaom_revision}" \
  "- libopus: ${opus_version}" \
  '- The included libav.js webcodecs configuration corresponds to libav/.' \
  '- Project-specific build input: project/libav/patentfree-player.config.json' \
  '- Project-specific build script: project/libav/build/build-patentfree-player.sh' \
  '' \
  'To reproduce the custom runtime, inspect project/libav/build/README.md, change' \
  'into project/, then run ./libav/build/build-patentfree-player.sh. The official' \
  'WebCodecs runtime is configured by upstream/libav.js/configs/configs/webcodecs/.' \
  > "$stage_dir/README.md"

tar --create --xz --file "$output_dir/$archive_name" --directory "$work_dir" "$(basename "$stage_dir")"
sha256sum "$output_dir/$archive_name" > "$output_dir/${archive_name}.sha256"
printf '%s\n' "$output_dir/$archive_name"
