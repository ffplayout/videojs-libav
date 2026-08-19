# Third-Party Notices and Corresponding Source

The patent-free libav.js runtime files in this directory include code from
FFmpeg, libav.js, and libaom. They are not covered by this repository's MIT
license.

FFmpeg is licensed under the GNU Lesser General Public License, version 2.1 or
later. A copy of LGPL-2.1 is provided at
[`licenses/COPYING.LGPLv2.1`](licenses/COPYING.LGPLv2.1).

libaom is licensed under BSD-2-Clause. Its license text is provided at
[`licenses/libaom-BSD-2-Clause.txt`](licenses/libaom-BSD-2-Clause.txt).

`libavjs-webcodecs-bridge.mjs` is separately licensed under ISC; its required
copyright and permission notice is preserved in that file's header.

Before publication, the matching GitHub Release draft receives a versioned
`libav-*-patentfree-player-corresponding-source-<tag>.tar.xz` archive and its
SHA-256 checksum. That archive is the corresponding-source offer for these
runtime files and contains the exact upstream source trees, project build input,
build script, notices and runtime checksums. Keep each published release and
its assets available for at least three years.

The archive uses these pinned upstream inputs:

- <https://github.com/Yahweasel/libav.js/tree/c80e885c3461f7bb7ea565c9631b34243ae0dbf1>
- <https://ffmpeg.org/releases/ffmpeg-9.0.tar.xz>
- <https://gitlab.com/webmproject/libaom/-/tree/03087864>
- [`sources/patentfree-player.config.json`](sources/patentfree-player.config.json)
- [`BUILD-INFO.md`](BUILD-INFO.md)

The libav.js source contains its build scripts and FFmpeg patch set. FFmpeg 9.0
is the unmodified upstream release. libaom is used for AV1 software decoding
and is distributed under BSD-2-Clause. The build information records the pinned
source revisions; verify published runtime artifacts with
[`SOURCES.sha256`](SOURCES.sha256).

For the FFmpeg project's licensing guidance, see
<https://ffmpeg.org/legal.html>.
