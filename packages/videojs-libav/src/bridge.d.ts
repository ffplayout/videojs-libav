declare module 'libavjs-webcodecs-bridge' {
  export function audioStreamToConfig(libav: any, stream: any): Promise<AudioDecoderConfig | null>;
  export function videoStreamToConfig(libav: any, stream: any): Promise<VideoDecoderConfig | null>;
  export function packetToEncodedAudioChunk(packet: any, stream: any): EncodedAudioChunk;
  export function packetToEncodedVideoChunk(packet: any, stream: any): EncodedVideoChunk;
}
