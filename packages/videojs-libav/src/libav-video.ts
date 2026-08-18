import { AudioSink } from './audio-worklet.js';
import { BoundedQueue } from './queue.js';
import type { DemuxStream, WorkerResponse } from './protocol.js';
import { MediaAttachMixin } from '@videojs/html';
import { EMPTY_TEXT_TRACKS } from '@videojs/media';

const event = (target: EventTarget, type: string) => target.dispatchEvent(new Event(type));
const emptyRanges: TimeRanges = { length: 0, start: () => 0, end: () => 0 };

export type LibavAudioTrack = {
  id: string;
  kind: 'main';
  label: string;
  language: string;
  enabled: boolean;
};

/** Minimal evented AudioTrackList compatible with Video.js media features. */
class LibavAudioTrackList extends EventTarget {
  #tracks: LibavAudioTrack[] = [];

  get length() {
    return this.#tracks.length;
  }
  [Symbol.iterator]() {
    return this.#tracks.values();
  }
  item(index: number) {
    return this.#tracks[index] ?? null;
  }
  getTrackById(id: string) {
    return this.#tracks.find((track) => track.id === id) ?? null;
  }
  replace(tracks: LibavAudioTrack[]) {
    this.#tracks = tracks;
    this.dispatchEvent(new Event('change'));
  }
}

/**
 * A Video.js 10 media element. It deliberately owns only playback; controls and
 * public UI remain the responsibility of the Video.js skin/player around it.
 */
export class LibavVideoElement extends MediaAttachMixin(HTMLElement) {
  static readonly tagName = 'libav-video';
  #canvas = document.createElement('canvas');
  #ctx = this.#canvas.getContext('2d', { alpha: false })!;
  #worker?: Worker;
  #generation = 0;
  #videoDecoder?: VideoDecoder;
  #audioDecoder?: AudioDecoder;
  // Keep this small enough to bound memory, but leave room for frames already
  // accepted by WebCodecs while the renderer is waiting for their presentation
  // time.
  #videoFrames = new BoundedQueue<VideoFrame>(16);
  #audioSink = new AudioSink();
  #streams: DemuxStream[] = [];
  #duration = Number.NaN;
  #currentTime = 0;
  #baseTimestamp = Number.NaN;
  #playing = false;
  #ended = false;
  #renderId = 0;
  #source = '';
  #libavBase?: string;
  #softwareDecoderBase?: string;
  #messageChain = Promise.resolve();
  #audioTrack = 0;
  #audioTracks = new LibavAudioTrackList();

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>:host{display:block;background:#000}canvas{display:block;width:100%;height:100%;object-fit:contain}</style>';
    root.append(this.#canvas);
  }
  get src() {
    return this.#source;
  }
  set src(value: string) {
    if (value !== this.#source) {
      this.#source = value;
      void this.load();
    }
  }
  /** Base URL containing the libav.js loader and WASM files. */
  get libavBase() {
    return this.#libavBase;
  }
  set libavBase(value: string | undefined) {
    this.#libavBase = value || undefined;
  }
  /** Base URL of the optional patent-free libav.js software decoder variant. */
  get softwareDecoderBase() {
    return this.#softwareDecoderBase;
  }
  set softwareDecoderBase(value: string | undefined) {
    this.#softwareDecoderBase = value || undefined;
  }
  /**
   * The fallback renders to a canvas and has no browser remote-playback
   * transport. Reflect the standard media-element opt-out so video-skin does
   * not initialise its Cast/Remote Playback controls for this element.
   */
  get disableRemotePlayback() {
    return this.hasAttribute('disableremoteplayback');
  }
  set disableRemotePlayback(value: boolean) {
    this.toggleAttribute('disableremoteplayback', Boolean(value));
  }
  get currentSrc() {
    return this.#source;
  }
  get currentTime() {
    return this.#currentTime;
  }
  set currentTime(value: number) {
    void this.seek(value);
  }
  get duration() {
    return this.#duration;
  }
  get paused() {
    return !this.#playing;
  }
  get ended() {
    return this.#ended;
  }
  get seeking() {
    return false;
  }
  get readyState() {
    return this.#streams.length ? 4 : 0;
  }
  get buffered() {
    return emptyRanges;
  }
  get seekable() {
    return Number.isFinite(this.#duration)
      ? ({ length: 1, start: () => 0, end: () => this.#duration } as TimeRanges)
      : emptyRanges;
  }
  get volume() {
    return this.#volume;
  }
  #volume = 1;
  set volume(value: number) {
    this.#volume = Math.max(0, Math.min(1, value));
    this.#audioSink.volume = this.#volume;
    event(this, 'volumechange');
  }
  #muted = false;
  get muted() {
    return this.#muted;
  }
  set muted(value: boolean) {
    this.#muted = value;
    this.#audioSink.volume = value ? 0 : this.#volume;
    event(this, 'volumechange');
  }
  get audioTracks() {
    return this.#audioTracks;
  }
  /** Subtitle support is not implemented yet, so keep the UI feature disabled. */
  get textTracks() {
    return EMPTY_TEXT_TRACKS;
  }
  #syncAudioTracks() {
    this.#audioTracks.replace(
      this.#streams
        .filter((stream) => stream.kind === 'audio')
        .map((stream) => ({
          id: String(stream.index),
          kind: 'main',
          label: stream.label,
          language: stream.language,
          enabled: stream.index === this.#audioTrack,
        })),
    );
  }
  canPlayType(type: string) {
    return /^(video\/(x-matroska|webm)|audio\/(x-matroska|webm))$/i.test(type) ? 'maybe' : '';
  }
  selectAudioTrack(index: number) {
    if (this.#audioTrack === index) return;
    this.#audioTrack = index;
    this.#syncAudioTracks();
    void this.load();
    event(this, 'change');
  }

  async load() {
    this.#stop();
    if (!this.#source) return;
    const generation = ++this.#generation;
    this.#worker = new Worker(new URL('./demux-worker.mjs', import.meta.url), { type: 'module' });
    this.#worker.onmessage = ({ data }: MessageEvent<WorkerResponse>) => {
      this.#messageChain = this.#messageChain.then(() => this.#handle(data));
    };
    this.#worker.postMessage({
      type: 'open',
      src: this.#source,
      generation,
      libavBase: this.#libavBase,
      softwareDecoderBase: this.#softwareDecoderBase,
      selectedAudioTrack: this.#audioTrack,
    });
    event(this, 'loadstart');
  }
  async play() {
    if (!this.#streams.length) await this.load();
    await this.#audioSink.start();
    this.#playing = true;
    this.#ended = false;
    event(this, 'play');
    event(this, 'playing');
    this.#render();
  }
  pause() {
    if (!this.#playing) return;
    this.#currentTime = this.#mediaClock();
    this.#baseTimestamp = this.#currentTime * 1e6;
    this.#playing = false;
    this.#audioSink.pause();
    cancelAnimationFrame(this.#renderId);
    event(this, 'pause');
  }
  async seek(value: number) {
    const next = Math.max(0, Math.min(value, Number.isFinite(this.#duration) ? this.#duration : value));
    event(this, 'seeking');
    // MVP seek restarts the bounded pipeline and suppresses presentation until
    // target time. A libav index/byte-range seeker belongs in the next phase.
    this.#currentTime = next;
    this.#baseTimestamp = next * 1e6;
    await this.load();
    event(this, 'seeked');
    event(this, 'timeupdate');
  }
  #stop() {
    cancelAnimationFrame(this.#renderId);
    this.#videoDecoder?.close();
    this.#audioDecoder?.close();
    this.#videoDecoder = undefined;
    this.#audioDecoder = undefined;
    this.#videoFrames.close();
    this.#videoFrames = new BoundedQueue(16);
    this.#audioSink.reset();
    this.#worker?.postMessage({ type: 'close', generation: this.#generation });
    this.#worker?.terminate();
    this.#worker = undefined;
  }
  async #handle(message: WorkerResponse) {
    if (message.generation !== this.#generation) return;
    if (message.type === 'error') {
      event(this, 'error');
      console.error('videojs-libav:', message.message);
      return;
    }
    if (message.type === 'metadata') {
      this.#duration = message.duration;
      this.#streams = message.streams;
      if (!this.#streams.some((stream) => stream.kind === 'audio' && stream.index === this.#audioTrack)) {
        this.#audioTrack = this.#streams.find((stream) => stream.kind === 'audio')?.index ?? 0;
      }
      this.#syncAudioTracks();
      await this.#configureDecoders();
      event(this, 'loadedmetadata');
      event(this, 'durationchange');
      event(this, 'canplay');
      return;
    }
    if (message.type === 'chunk') {
      const stream = this.#streams.find((item) => item.index === message.stream);
      if (stream?.kind === 'video') {
        // Do not acknowledge more demuxed packets while rendered frames are
        // still buffered. WebCodecs output callbacks cannot await, so this is
        // the point at which backpressure must be applied.
        await this.#videoFrames.waitForLengthBelow(8);
        while (this.#videoDecoder && this.#videoDecoder.decodeQueueSize > 4)
          await new Promise((resolve) => setTimeout(resolve, 4));
        this.#videoDecoder?.decode(message.chunk as EncodedVideoChunk);
      }
      if (stream?.kind === 'audio' && stream.index === this.#audioTrack) {
        while (this.#audioDecoder && this.#audioDecoder.decodeQueueSize > 12)
          await new Promise((resolve) => setTimeout(resolve, 4));
        this.#audioDecoder?.decode(message.chunk as EncodedAudioChunk);
      }
      this.#worker?.postMessage({ type: 'resume', generation: this.#generation });
      return;
    }
    if (message.type === 'video-frame') {
      if (!this.#videoFrames.push(message.frame)) message.frame.close();
      return;
    }
    if (message.type === 'audio-data') {
      if (message.stream === this.#audioTrack) this.#audioSink.enqueue(message.data);
      else message.data.close();
      return;
    }
    if (message.type === 'software-complete') {
      // Software decoding happens in the worker, where it has no WebCodecs
      // decodeQueueSize to use as a throttle. Delay its packet credit until
      // the renderer has room, otherwise a fast Theora decoder fills the
      // queue and every frame after the first fraction of a second is lost.
      if (this.#streams.find((stream) => stream.index === message.stream)?.kind === 'video')
        await this.#videoFrames.waitForLengthBelow(8);
      this.#worker?.postMessage({ type: 'resume', generation: this.#generation });
      return;
    }
    if (message.type === 'end') {
      await this.#videoDecoder?.flush();
      await this.#audioDecoder?.flush();
      this.#videoFrames.close();
    }
  }
  async #configureDecoders() {
    this.#resetDecoders();
    const video = this.#streams.find((stream) => stream.kind === 'video');
    const audio = this.#streams.find((stream) => stream.kind === 'audio' && stream.index === this.#audioTrack);
    if (video?.decoder === 'webcodecs') {
      const config = video.config as VideoDecoderConfig;
      const supported = await VideoDecoder.isConfigSupported(config);
      if (!supported.supported) throw new Error(`WebCodecs video codec unsupported: ${video.codec}`);
      this.#videoDecoder = new VideoDecoder({
        output: (frame) => {
          if (!this.#videoFrames.push(frame)) frame.close();
        },
        error: () => event(this, 'error'),
      });
      this.#videoDecoder.configure(supported.config ?? config);
    }
    if (audio?.decoder === 'webcodecs') {
      const config = audio.config as AudioDecoderConfig;
      const supported = await AudioDecoder.isConfigSupported(config);
      if (!supported.supported) throw new Error(`WebCodecs audio codec unsupported: ${audio.codec}`);
      this.#audioDecoder = new AudioDecoder({
        output: (data) => this.#audioSink.enqueue(data),
        error: () => event(this, 'error'),
      });
      this.#audioDecoder.configure(supported.config ?? config);
    }
  }
  #resetDecoders() {
    this.#videoDecoder?.close();
    this.#audioDecoder?.close();
    this.#videoDecoder = undefined;
    this.#audioDecoder = undefined;
  }
  async #render() {
    if (!this.#playing) return;
    const frame = await this.#videoFrames.shift();
    if (frame) {
      if (!Number.isFinite(this.#baseTimestamp)) this.#baseTimestamp = frame.timestamp;
      const presentationTime = frame.timestamp / 1e6;

      // A frame can arrive much earlier than its audio-master-clock deadline.
      // Waiting here keeps it in the bounded queue instead of consuming and
      // discarding the entire video stream at display-refresh speed.
      const delay = presentationTime - this.#mediaClock();
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000));

      if (this.#playing) {
        const mediaTime = this.#mediaClock();
        this.#currentTime = mediaTime;
        // Drop only genuinely late frames. Future frames are held above until
        // their deadline, which is essential for smooth playback.
        if (presentationTime >= mediaTime - 0.1) {
          this.#canvas.width = frame.displayWidth;
          this.#canvas.height = frame.displayHeight;
          this.#ctx.drawImage(frame, 0, 0);
        }
        event(this, 'timeupdate');
      }
      frame.close();
    } else if (!this.#ended) {
      this.#ended = true;
      this.#playing = false;
      event(this, 'ended');
      return;
    }
    this.#renderId = requestAnimationFrame(() => void this.#render());
  }
  #mediaClock() {
    return Number.isFinite(this.#baseTimestamp) ? this.#baseTimestamp / 1e6 + this.#audioSink.clock : this.#currentTime;
  }
  disconnectedCallback() {
    this.#stop();
    this.#audioSink.close();
    const mediaAttachPrototype = Object.getPrototypeOf(LibavVideoElement.prototype) as {
      disconnectedCallback?: () => void;
    };
    mediaAttachPrototype.disconnectedCallback?.call(this);
  }
}
