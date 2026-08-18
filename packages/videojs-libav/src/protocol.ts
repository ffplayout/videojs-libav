export type MediaKind = 'audio' | 'video';

export interface DemuxStream {
  index: number;
  kind: MediaKind;
  codec: string;
  label: string;
  language: string;
  config: AudioDecoderConfig | VideoDecoderConfig;
  decoder: 'webcodecs' | 'libav';
}

export type WorkerRequest =
  | {
      type: 'open';
      src: string;
      generation: number;
      libavBase?: string;
      softwareDecoderBase?: string;
      selectedAudioTrack?: number;
      startTime?: number;
    }
  | { type: 'resume'; generation: number }
  | { type: 'close'; generation: number };

export type WorkerResponse =
  | { type: 'metadata'; generation: number; duration: number; streams: DemuxStream[] }
  | { type: 'chunk'; generation: number; stream: number; chunk: EncodedAudioChunk | EncodedVideoChunk }
  | { type: 'video-frame'; generation: number; stream: number; frame: VideoFrame }
  | { type: 'audio-data'; generation: number; stream: number; data: AudioData }
  | { type: 'software-complete'; generation: number; stream: number }
  | { type: 'end'; generation: number }
  | { type: 'error'; generation: number; message: string };
