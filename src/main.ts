import { PlayerController, type DemoSource } from './player-controller.js';
import './style.css';

// Media is fetched by the demux worker. Give it an absolute page-relative URL:
// a plain "./media/…" would otherwise be resolved relative to the emitted
// worker in ./assets/ on GitHub Pages.
const appBase = new URL(import.meta.env.BASE_URL, window.location.href);
const assetUrl = (path: string) => new URL(path, appBase).href;
const fixtureBase = assetUrl('media/');
const fixtures: DemoSource[] = [
  {
    src: `${fixtureBase}vp9-8bit-flac.mkv`,
    type: 'video/x-matroska',
    title: 'VP9 8-bit + FLAC',
    description: 'Baseline Matroska fixture for the bundled patent-free video and lossless-audio decoders.',
    tags: ['MKV', 'VP9 Profile 0', 'FLAC', '8-bit'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}vp9-10bit-flac.mkv`,
    type: 'video/x-matroska',
    title: 'VP9 10-bit + FLAC',
    description: 'Exercises the 10-bit YUV420-to-8-bit Canvas conversion before rendering.',
    tags: ['MKV', 'VP9 Profile 2', 'FLAC', '10-bit'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}av1-10bit-flac.mkv`,
    type: 'video/x-matroska',
    title: 'AV1 10-bit + FLAC',
    description: 'Validates AV1 Main-profile software decoding and the 10-bit conversion path.',
    tags: ['MKV', 'AV1 Main', 'FLAC', '10-bit'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}av1-12bit-flac.mkv`,
    type: 'video/x-matroska',
    title: 'AV1 12-bit + FLAC',
    description: 'Validates AV1 Professional-profile 12-bit YUV420 conversion to the Canvas-compatible 8-bit path.',
    tags: ['MKV', 'AV1 Professional', 'FLAC', '12-bit'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}vp9-10bit-two-flac.mkv`,
    type: 'video/x-matroska',
    title: 'VP9 10-bit + two FLAC tracks',
    description:
      'Exercises the high-bit-depth video conversion and Video.js audio-track selection with two lossless streams.',
    tags: ['MKV', 'VP9 Profile 2', '2 FLAC tracks', '10-bit'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 2 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}h264-aac.mkv`,
    type: 'video/x-matroska',
    title: 'H.264 + AAC',
    description: 'Exercises Matroska demuxing with H.264 and AAC handed to the browser WebCodecs decoders.',
    tags: ['MKV', 'H.264 High', 'AAC-LC', 'WebCodecs'],
    route: 'libav.js demux + WebCodecs',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
  },
  {
    src: `${fixtureBase}vp8-mp3.mkv`,
    type: 'video/x-matroska',
    title: 'VP8 + MP3',
    description: 'Exercises Matroska demuxing with VP8 and MP3 handed to browser WebCodecs decoders.',
    tags: ['MKV', 'VP8', 'MP3', 'WebCodecs'],
    route: 'libav.js demux + WebCodecs',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
  },
  {
    src: `${fixtureBase}vp9-pcm.mkv`,
    type: 'video/x-matroska',
    title: 'VP9 + PCM',
    description: 'Exercises the bundled VP9 and signed 16-bit PCM software decoders in one player pipeline.',
    tags: ['MKV', 'VP9 Profile 0', 'PCM s16le', 'Software decode'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}testsrc2-h264-aac.mov`,
    type: 'video/quicktime',
    title: 'MOV · testsrc2 · H.264 + AAC',
    description: 'A moving test pattern in a MOV container, decoded through browser WebCodecs.',
    tags: ['MOV', 'testsrc2', 'H.264', 'AAC-LC'],
    route: 'libav.js demux + WebCodecs',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
  },
  {
    src: `${fixtureBase}smptebars-h264-aac.flv`,
    type: 'video/x-flv',
    title: 'FLV · SMPTE bars · H.264 + AAC',
    description: 'A colour-bar test pattern in FLV, exercising the bundled FLV demuxer.',
    tags: ['FLV', 'SMPTE bars', 'H.264', 'AAC-LC'],
    route: 'libav.js demux + WebCodecs',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
  },
  {
    src: `${fixtureBase}testsrc-vp9-pcm.avi`,
    type: 'video/x-msvideo',
    title: 'AVI · testsrc · VP9 + PCM',
    description: 'A moving RGB test pattern in AVI, using the bundled VP9 and PCM software decoders.',
    tags: ['AVI', 'testsrc', 'VP9', 'PCM s16le'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
  {
    src: `${fixtureBase}sine-flac.ogg`,
    type: 'audio/ogg',
    title: 'Ogg · sine wave · FLAC',
    description: 'An audio-only Ogg/FLAC fixture for the bundled Ogg demuxer and FLAC decoder.',
    tags: ['Ogg', 'sine wave', 'FLAC', 'Audio only'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 audio',
    forceLibav: true,
    forceSoftwareDecode: true,
  },
];

const file = document.querySelector<HTMLInputElement>('#file')!;
const fixturesRoot = document.querySelector<HTMLElement>('#fixtures')!;
const player = new PlayerController(
  {
    mount: document.querySelector<HTMLElement>('#mount')!,
    title: document.querySelector<HTMLElement>('#player-heading')!,
    status: document.querySelector<HTMLElement>('#status')!,
    route: document.querySelector<HTMLElement>('#route')!,
    duration: document.querySelector<HTMLElement>('#duration')!,
    position: document.querySelector<HTMLElement>('#position')!,
    streams: document.querySelector<HTMLElement>('#streams')!,
    audioTrackControl: document.querySelector<HTMLElement>('#audio-track-control')!,
    audioTrack: document.querySelector<HTMLSelectElement>('#audio-track')!,
  },
  assetUrl,
);
let objectUrl: string | null = null;

function setCapabilities() {
  document.querySelector('#webcodecs-capability')!.textContent =
    'VideoDecoder' in window && 'AudioDecoder' in window ? 'WebCodecs available' : 'WebCodecs unavailable';
  document.querySelector('#worklet-capability')!.textContent =
    'AudioWorkletNode' in window ? 'AudioWorklet available' : 'AudioWorklet unavailable';
}

function sourceType(selected: File): string {
  if (selected.type) return selected.type;
  const extension = selected.name.split('.').pop()?.toLowerCase();
  return (
    {
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      flv: 'video/x-flv',
      avi: 'video/x-msvideo',
      ogg: 'audio/ogg',
      ogv: 'video/ogg',
    }[extension ?? ''] || ''
  );
}

function renderFixtures() {
  fixturesRoot.innerHTML = fixtures
    .map(
      (
        source,
        index,
      ) => `<button class="fixture${player.activeSource?.src === source.src ? ' active' : ''}" type="button" data-fixture="${index}">
        <p class="kicker">${source.route}</p>
        <h3>${source.title}</h3>
        <p>${source.description}</p>
        <div class="fixture-meta">${source.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
      </button>`,
    )
    .join('');
  fixturesRoot.querySelectorAll<HTMLButtonElement>('[data-fixture]').forEach((button) => {
    button.addEventListener('click', () => {
      player.mount(fixtures[Number(button.dataset.fixture)]);
      renderFixtures();
    });
  });
}

file.addEventListener('change', () => {
  const selected = file.files?.[0];
  if (!selected) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(selected);
  player.mount({
    src: objectUrl,
    type: sourceType(selected),
    title: selected.name,
    description: 'Local file selected from this device.',
    tags: ['Local file'],
    route: 'automatic route selection',
    streamSummary: 'Inspecting streams…',
  });
  renderFixtures();
});

setCapabilities();
player.mount(fixtures[0]);
renderFixtures();
window.addEventListener('beforeunload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
