import '@videojs/html/video/player';
import '@videojs/html/video/skin';
import '@videojs/html/video/skin.css';
import { defineLibavVideoElement, shouldUseLibavFallback } from 'videojs-libav';
import './style.css';

type AudioTrack = { id: string; label: string; language: string; enabled: boolean };
type PlaybackElement = HTMLMediaElement & {
  src: string;
  libavBase?: string;
  softwareDecoderBase?: string;
  audioTracks?: Iterable<AudioTrack>;
  selectAudioTrack?: (index: number) => void;
};

type DemoSource = {
  src: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  route: string;
  streamSummary: string;
  softwareDecode?: boolean;
  forceLibav?: boolean;
};

defineLibavVideoElement();

// Media is fetched by the demux worker. Give it an absolute page-relative URL:
// a plain "./media/…" would otherwise be resolved relative to the emitted
// worker in ./assets/ on GitHub Pages.
const appBase = new URL(import.meta.env.BASE_URL, window.location.href);
const assetUrl = (path: string) => new URL(path, appBase).href;
const fixtureBase = assetUrl('media/');
const fixtures: DemoSource[] = [
  {
    src: `${fixtureBase}theora-vorbis.mkv`,
    type: 'video/x-matroska',
    title: 'Theora + Vorbis',
    description:
      'Matroska fixture that requires libav.js demuxing and the patent-free software video and audio decoders.',
    tags: ['MKV', 'Theora', 'Vorbis', 'Software decode'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    softwareDecode: true,
    forceLibav: true,
  },
  {
    src: `${fixtureBase}theora-vorbis-multiaudio.mkv`,
    type: 'video/x-matroska',
    title: 'Theora + two Vorbis tracks',
    description:
      'Exercises the libav.js pipeline and audio-track switching with two separately labelled Vorbis streams.',
    tags: ['MKV', 'Theora', '2 audio tracks', 'Software decode'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 2 audio',
    softwareDecode: true,
    forceLibav: true,
  },
  {
    src: `${fixtureBase}theora-flac.mkv`,
    type: 'video/x-matroska',
    title: 'Theora + FLAC',
    description:
      'A lossless-audio fixture for the software fallback path, with Theora video and FLAC audio in Matroska.',
    tags: ['MKV', 'Theora', 'FLAC', 'Software decode'],
    route: 'libav.js demux + software decode',
    streamSummary: '1 video · 1 audio',
    softwareDecode: true,
    forceLibav: true,
  },
  {
    src: `${fixtureBase}avsynctest-h264-opus.mkv`,
    type: 'video/x-matroska',
    title: 'H.264 + Opus A/V sync',
    description:
      'The original ten-second FFmpeg avsynctest fixture. Matroska is demuxed by libav.js while WebCodecs is preferred for decoding.',
    tags: ['MKV', 'H.264', 'Opus', 'WebCodecs preferred'],
    route: 'libav.js demux + WebCodecs',
    streamSummary: '1 video · 1 audio',
  },
];

const file = document.querySelector<HTMLInputElement>('#file')!;
const fixturesRoot = document.querySelector<HTMLElement>('#fixtures')!;
const mount = document.querySelector<HTMLElement>('#mount')!;
const title = document.querySelector<HTMLElement>('#player-heading')!;
const status = document.querySelector<HTMLElement>('#status')!;
const route = document.querySelector<HTMLElement>('#route')!;
const duration = document.querySelector<HTMLElement>('#duration')!;
const position = document.querySelector<HTMLElement>('#position')!;
const streams = document.querySelector<HTMLElement>('#streams')!;
const audioTrackControl = document.querySelector<HTMLElement>('#audio-track-control')!;
const audioTrack = document.querySelector<HTMLSelectElement>('#audio-track')!;
let objectUrl: string | null = null;
let activeSource: DemoSource | null = null;

function setCapabilities() {
  document.querySelector('#webcodecs-capability')!.textContent =
    'VideoDecoder' in window && 'AudioDecoder' in window ? 'WebCodecs available' : 'WebCodecs unavailable';
  document.querySelector('#worklet-capability')!.textContent =
    'AudioWorkletNode' in window ? 'AudioWorklet available' : 'AudioWorklet unavailable';
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '—';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function sourceType(selected: File): string {
  if (selected.type) return selected.type;
  const extension = selected.name.split('.').pop()?.toLowerCase();
  return (
    { mkv: 'video/x-matroska', webm: 'video/webm', mp4: 'video/mp4', mov: 'video/quicktime', ogv: 'video/ogg' }[
      extension ?? ''
    ] || ''
  );
}

function renderFixtures() {
  fixturesRoot.innerHTML = fixtures
    .map(
      (
        source,
        index,
      ) => `<button class="fixture${activeSource?.src === source.src ? ' active' : ''}" type="button" data-fixture="${index}">
        <p class="kicker">${source.route}</p>
        <h3>${source.title}</h3>
        <p>${source.description}</p>
        <div class="fixture-meta">${source.tags.map((tag) => `<span>${tag}</span>`).join('')}</div>
      </button>`,
    )
    .join('');
  fixturesRoot.querySelectorAll<HTMLButtonElement>('[data-fixture]').forEach((button) => {
    button.addEventListener('click', () => mountSource(fixtures[Number(button.dataset.fixture)]));
  });
}

function updateAudioTracks(media: PlaybackElement) {
  const tracks = Array.from(media.audioTracks || []);
  audioTrackControl.hidden = tracks.length < 2;
  audioTrack.innerHTML = tracks
    .map(
      (track) =>
        `<option value="${track.id}"${track.enabled ? ' selected' : ''}>${track.label}${track.language ? ` · ${track.language}` : ''}</option>`,
    )
    .join('');
  audioTrack.onchange = () => media.selectAudioTrack?.(Number(audioTrack.value));
}

function bindStatus(media: PlaybackElement, source: DemoSource, usesLibav: boolean) {
  const playbackRoute = usesLibav ? source.route : 'native browser playback';
  const updatePosition = () => {
    position.textContent = formatTime(media.currentTime);
  };
  media.addEventListener('loadedmetadata', () => {
    duration.textContent = formatTime(media.duration);
    streams.textContent = usesLibav ? source.streamSummary : 'Browser-managed';
    status.textContent = `Ready · ${usesLibav ? 'worker pipeline initialized' : 'native media element initialized'}`;
    updateAudioTracks(media);
  });
  media.addEventListener('play', () => (status.textContent = 'Playing · audio is the master clock'));
  media.addEventListener('pause', () => (status.textContent = 'Paused'));
  media.addEventListener('timeupdate', updatePosition);
  media.addEventListener('ended', () => (status.textContent = 'Ended · select another fixture to replay'));
  media.addEventListener(
    'error',
    () => (status.textContent = 'Playback error · see the browser console for diagnostics'),
  );
  route.textContent = playbackRoute;
}

function mountSource(source: DemoSource) {
  activeSource = source;
  renderFixtures();
  title.textContent = source.title;
  duration.textContent = '—';
  position.textContent = '0:00';
  streams.textContent = source.streamSummary;
  audioTrackControl.hidden = true;
  // Matroska capability probes are overly optimistic in some browsers. These
  // fixtures intentionally exercise the libav.js software path, so bypass the
  // native element even when it reports a tentative "maybe" response.
  const usesLibav = source.forceLibav || shouldUseLibavFallback(source);
  const tag = usesLibav ? 'libav-video' : 'video';
  // Configure media before connecting the skin. This avoids the Cast control
  // targeting a half-initialised custom element while a source is swapped.
  const player = document.createElement('video-player');
  const skin = document.createElement('video-skin');
  skin.className = 'player-skin';
  const media = document.createElement(tag) as PlaybackElement;
  media.id = 'media';
  media.slot = 'media';
  media.setAttribute('playsinline', '');
  media.setAttribute('preload', 'metadata');
  media.setAttribute('disableremoteplayback', '');
  if (usesLibav) {
    media.libavBase = assetUrl('libav/');
    media.softwareDecoderBase = assetUrl('libav-patentfree/');
  }
  bindStatus(media, source, usesLibav);
  media.src = source.src;
  skin.append(media);
  player.append(skin);
  mount.replaceChildren(player);
  status.textContent = `Loading · ${usesLibav ? 'libav.js worker selected' : 'native browser player selected'}`;
}

file.addEventListener('change', () => {
  const selected = file.files?.[0];
  if (!selected) return;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(selected);
  mountSource({
    src: objectUrl,
    type: sourceType(selected),
    title: selected.name,
    description: 'Local file selected from this device.',
    tags: ['Local file'],
    route: 'automatic route selection',
    streamSummary: 'Inspecting streams…',
  });
});

setCapabilities();
mountSource(fixtures[0]);
window.addEventListener('beforeunload', () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
