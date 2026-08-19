import '@videojs/html/video/player';
import '@videojs/html/video/skin';
import { LibavVideoElement } from './libav-video.js';

export type LibavPlayerSource = { src: string; type?: string };

export type LibavPlayerMedia = HTMLMediaElement & {
  libavBase?: string;
  softwareDecoderBase?: string;
  forceSoftwareDecode?: boolean;
};

export type CreateLibavPlayerOptions = {
  target: HTMLElement | string;
  source: LibavPlayerSource;
  /**
   * URL of the regular WebCodecs libav.js runtime. Set this alone for the
   * smallest WebCodecs-only route; unsupported codecs then report an error.
   */
  libavBase?: string;
  /**
   * URL of the all-in-one patent-free player runtime. When set, it replaces
   * `libavBase` for the fallback route and supplies demuxing plus optional
   * software decoding from one WASM module.
   */
  softwareDecoderBase?: string;
  /** Use the fallback even if the browser advertises tentative native support. */
  forceLibav?: boolean;
  /** Force libav.js decoding after demuxing, useful for validating the fallback. */
  forceSoftwareDecode?: boolean;
  skinClassName?: string;
};

/**
 * Small application-facing wrapper around Video.js 10's player and skin
 * elements. It keeps native playback as the default and creates libav-video
 * only when the native media element rejects the source.
 */
export class LibavPlayer {
  readonly target: HTMLElement;
  media!: LibavPlayerMedia;
  usesLibav = false;

  constructor(options: CreateLibavPlayerOptions) {
    this.target = resolveTarget(options.target);
    if (!customElements.get(LibavVideoElement.tagName))
      customElements.define(LibavVideoElement.tagName, LibavVideoElement);
    this.setSource(options);
  }

  setSource(options: Omit<CreateLibavPlayerOptions, 'target'>) {
    this.usesLibav = Boolean(
      options.forceLibav ||
      (options.source.type && document.createElement('video').canPlayType(options.source.type) === ''),
    );
    const media = document.createElement(this.usesLibav ? 'libav-video' : 'video') as LibavPlayerMedia;
    media.slot = 'media';
    media.setAttribute('playsinline', '');
    media.setAttribute('preload', 'metadata');
    media.setAttribute('disableremoteplayback', '');
    if (this.usesLibav) {
      media.libavBase = options.libavBase;
      media.softwareDecoderBase = options.softwareDecoderBase;
      media.forceSoftwareDecode = options.forceSoftwareDecode;
    }

    const player = document.createElement('video-player');
    const skin = document.createElement('video-skin');
    skin.className = options.skinClassName ?? 'player-skin';
    skin.append(media);
    player.append(skin);
    this.target.replaceChildren(player);
    this.media = media;
    media.src = options.source.src;
    return media;
  }

  destroy() {
    this.target.replaceChildren();
  }
}

export function createLibavPlayer(options: CreateLibavPlayerOptions) {
  return new LibavPlayer(options);
}

function resolveTarget(target: HTMLElement | string) {
  if (typeof target !== 'string') return target;
  const element = document.querySelector<HTMLElement>(target);
  if (!element) throw new Error(`Cannot find player target: ${target}`);
  return element;
}
