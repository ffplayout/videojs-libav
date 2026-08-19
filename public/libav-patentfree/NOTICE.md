# Third-Party Notices and Corresponding Source

The patent-free libav.js runtime files in this directory include code from
FFmpeg, libav.js, and libaom. They are not covered by this repository's MIT
license.

FFmpeg is licensed under the GNU Lesser General Public License, version 2.1 or
later. A copy of LGPL-2.1 is provided at
[`licenses/COPYING.LGPLv2.1`](licenses/COPYING.LGPLv2.1).

libaom is licensed under BSD-2-Clause. Its license text is provided at
[`licenses/libaom-BSD-2-Clause.txt`](licenses/libaom-BSD-2-Clause.txt).

Corresponding source and build inputs are available at these pinned upstream
locations:

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
