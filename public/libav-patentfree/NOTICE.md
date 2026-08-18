# Third-Party Notices and Corresponding Source

The patent-free libav.js runtime files in this directory include code from
FFmpeg and libav.js. They are not covered by this repository's MIT license.

FFmpeg is licensed under the GNU Lesser General Public License, version 2.1 or
later. A copy of LGPL-2.1 is provided at
[`licenses/COPYING.LGPLv2.1`](licenses/COPYING.LGPLv2.1).

Corresponding source and build inputs are available at these pinned upstream
locations:

- <https://github.com/Yahweasel/libav.js/archive/fe0fb3e89a68637082f02e9cb75b725bb9d3a1ea.tar.gz>
- <https://ffmpeg.org/releases/ffmpeg-9.0.tar.xz>
- [`sources/patentfree-player.config.json`](sources/patentfree-player.config.json)
- [`BUILD-INFO.md`](BUILD-INFO.md)

The libav.js source contains its build scripts and FFmpeg patch set. FFmpeg 9.0
is the unmodified upstream release. The build information records the expected
SHA-256 digests for both downloads; verify published runtime artifacts with
[`SOURCES.sha256`](SOURCES.sha256).

For the FFmpeg project's licensing guidance, see
<https://ffmpeg.org/legal.html>.
