import '@videojs/html/video/skin.css';
import { createLibavPlayer } from 'videojs-libav';

/** A track shape exposed by the libav custom media element. */
type AudioTrack = { id: string; label: string; language: string; enabled: boolean };
type PlaybackElement = HTMLMediaElement & {
  audioTracks?: Iterable<AudioTrack>;
  selectAudioTrack?: (index: number) => void;
};

/**
 * Data required to mount one item in this demo.
 *
 * `src`, `type`, `title`, `description`, `tags`, `route`, and `streamSummary`
 * are required because the surrounding demo page displays each of them.
 * `forceLibav` is optional: omit it for native-first selection, or set it for
 * fixtures that must always exercise the fallback path. `forceSoftwareDecode`
 * is optional and only useful for testing a codec included in the bundled
 * player runtime.
 */
export type DemoSource = {
  src: string;
  type: string;
  title: string;
  description: string;
  tags: string[];
  route: string;
  streamSummary: string;
  forceLibav?: boolean;
  forceSoftwareDecode?: boolean;
};

/**
 * DOM anchors owned by the demo page, not by the published package.
 *
 * All fields except the audio-track controls are required: the controller
 * updates them whenever a source changes or media events occur. The audio
 * controls are optional enhancement points; omitting both keeps playback and
 * the default Video.js controls fully functional, but hides manual selection
 * of multiple libav audio tracks.
 */
type PlayerElements = {
  mount: HTMLElement;
  title: HTMLElement;
  status: HTMLElement;
  route: HTMLElement;
  duration: HTMLElement;
  position: HTMLElement;
  streams: HTMLElement;
  audioTrackControl?: HTMLElement;
  audioTrack?: HTMLSelectElement;
};

/**
 * Demo-only adapter between page telemetry and `createLibavPlayer`.
 *
 * Binding requirements:
 * - `elements` must reference the required page anchors listed in
 *   `PlayerElements`; they are intentionally not queried here so embedding
 *   code remains explicit.
 * - `assetUrl` is required and must return absolute URLs rooted at the
 *   deployed application. It supplies the normal and patent-free libav.js
 *   runtime directories, including when the site is hosted below a path such
 *   as `/videojs-libav/`.
 *
 * This class does not contain playback internals. Those belong to the
 * publishable `videojs-libav` package and are created through
 * `createLibavPlayer`.
 */
export class PlayerController {
  #activeSource: DemoSource | null = null;

  constructor(
    private readonly elements: PlayerElements,
    private readonly assetUrl: (path: string) => string,
  ) {}

  /** The currently mounted source, or `null` before the first `mount()` call. */
  get activeSource() {
    return this.#activeSource;
  }

  /**
   * Replace the displayed player with a source and bind its media events to
   * this demo's telemetry. `source.forceLibav` and
   * `source.forceSoftwareDecode` are optional test settings; all runtime asset
   * URLs are supplied by the required `assetUrl`.
   */
  mount(source: DemoSource) {
    this.#activeSource = source;
    const { title, duration, position, streams, audioTrackControl, mount, status } = this.elements;
    title.textContent = source.title;
    duration.textContent = '—';
    position.textContent = '0:00';
    streams.textContent = source.streamSummary;
    if (audioTrackControl) audioTrackControl.hidden = true;

    const player = createLibavPlayer({
      target: mount,
      source,
      forceLibav: source.forceLibav,
      libavBase: this.assetUrl('libav/'),
      softwareDecoderBase: this.assetUrl('libav-patentfree/'),
      forceSoftwareDecode: source.forceSoftwareDecode,
    });
    const { media, usesLibav } = player;
    this.#bindStatus(media, source, usesLibav);
    status.textContent = `Loading · ${usesLibav ? 'libav.js worker selected' : 'native browser player selected'}`;
  }

  #bindStatus(media: PlaybackElement, source: DemoSource, usesLibav: boolean) {
    const { duration, streams, status, position, route } = this.elements;
    const updatePosition = () => {
      position.textContent = formatTime(media.currentTime);
    };
    media.addEventListener('loadedmetadata', () => {
      duration.textContent = formatTime(media.duration);
      streams.textContent = usesLibav ? source.streamSummary : 'Browser-managed';
      status.textContent = `Ready · ${usesLibav ? 'worker pipeline initialized' : 'native media element initialized'}`;
      this.#updateAudioTracks(media);
    });
    media.addEventListener('play', () => (status.textContent = 'Playing · audio is the master clock'));
    media.addEventListener('pause', () => (status.textContent = 'Paused'));
    media.addEventListener('timeupdate', updatePosition);
    media.addEventListener('ended', () => (status.textContent = 'Ended · select another fixture to replay'));
    media.addEventListener(
      'error',
      () => (status.textContent = 'Playback error · see the browser console for diagnostics'),
    );
    route.textContent = usesLibav ? source.route : 'native browser playback';
  }

  #updateAudioTracks(media: PlaybackElement) {
    const { audioTrackControl, audioTrack } = this.elements;
    if (!audioTrackControl || !audioTrack) return;
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
}

function formatTime(value: number) {
  if (!Number.isFinite(value)) return '—';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}
