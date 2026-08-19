import { LibavVideoElement } from './libav-video.js';
export { LibavVideoElement } from './libav-video.js';
export { createLibavPlayer, LibavPlayer } from './player.js';
export type { CreateLibavPlayerOptions, LibavPlayerMedia, LibavPlayerSource } from './player.js';

/** Register once; import this module before creating the Video.js 10 player. */
export function defineLibavVideoElement(tagName = LibavVideoElement.tagName) {
  if (!customElements.get(tagName)) customElements.define(tagName, LibavVideoElement);
  return customElements.get(tagName) as typeof LibavVideoElement;
}

/** Native playback is deliberately selected first; LibAV is only the fallback. */
export function shouldUseLibavFallback(
  source: { src: string; type?: string },
  nativeVideo = document.createElement('video'),
) {
  return Boolean(source.type && nativeVideo.canPlayType(source.type) === '');
}
