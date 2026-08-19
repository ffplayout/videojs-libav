/// <reference lib="webworker" />
import type { DemuxStream, WorkerRequest, WorkerResponse } from './protocol.js';

const scope = self as unknown as DedicatedWorkerGlobalScope;
let cancelledGeneration = -1;
let resume: (() => void) | undefined;
let credits = 32;
type DemuxRuntime = {
  LibAV: { base: string; LibAV(options: { noworker: boolean; nothreads?: boolean }): Promise<any> };
  audioStreamToConfig(libav: any, stream: any): Promise<AudioDecoderConfig | null>;
  videoStreamToConfig(libav: any, stream: any): Promise<VideoDecoderConfig | null>;
  packetToEncodedAudioChunk(packet: any, stream: any): EncodedAudioChunk;
  packetToEncodedVideoChunk(packet: any, stream: any): EncodedVideoChunk;
};
let runtime: DemuxRuntime | undefined;
const emit = (message: WorkerResponse, transfer: Transferable[] = []) => scope.postMessage(message, transfer);
const kindOf = (stream: any) => (stream.codec_type === 0 ? 'video' : stream.codec_type === 1 ? 'audio' : null);
const rangeReadAhead = 1024 * 1024;

/**
 * Attach a seekable HTTP resource to libav.js without first materialising the
 * complete file in WASM memory. `onblockread` is invoked only when the
 * demuxer needs a byte range, and libav.js resumes the pending I/O operation
 * when `ff_block_reader_dev_send` receives that range.
 */
async function openInput(libav: any, src: string, fileName: string) {
  const probe = await fetch(src, { headers: { Range: 'bytes=0-0' } });
  if (!probe.ok) throw new Error(`HTTP ${probe.status} while loading media`);
  const contentRange = probe.headers.get('content-range');
  const size = contentRange && /^bytes \d+-\d+\/(\d+)$/i.exec(contentRange)?.[1];

  if (probe.status === 206 && size) {
    const fileSize = Number(size);
    if (!Number.isSafeInteger(fileSize) || fileSize < 1) throw new Error('Invalid HTTP Content-Range size');
    await libav.mkblockreaderdev(fileName, fileSize);
    libav.onblockread = (_name: string, position: number, length: number) => {
      const end = Math.min(fileSize - 1, position + Math.max(length, rangeReadAhead) - 1);
      return fetch(src, { headers: { Range: `bytes=${position}-${end}` } })
        .then(async (response) => {
          if (response.status !== 206)
            throw new Error(`Server stopped honoring range requests (HTTP ${response.status})`);
          return new Uint8Array(await response.arrayBuffer());
        })
        .then((data) => libav.ff_block_reader_dev_send(fileName, position, data));
    };
    return { rangeSupported: true, fileSize };
  }

  // Development servers and basic static hosts do not always implement Range.
  // Preserve the MVP behaviour for those sources, while production servers
  // avoid this branch by returning a 206 response above.
  await libav.writeFile(fileName, new Uint8Array(await probe.arrayBuffer()));
  return { rangeSupported: false, fileSize: 0 };
}

interface SoftwareDecoder {
  libav: any;
  context: number;
  packet: number;
  frame: number;
  stream: any;
  descriptor: DemuxStream;
}

async function waitForResume(generation: number) {
  if (generation === cancelledGeneration) throw new DOMException('Cancelled', 'AbortError');
  while (!credits)
    await new Promise<void>((resolve) => {
      resume = resolve;
    });
}

async function supportsWebCodecs(kind: 'audio' | 'video', config: AudioDecoderConfig | VideoDecoderConfig) {
  try {
    if (kind === 'video')
      return (
        typeof VideoDecoder !== 'undefined' &&
        (await VideoDecoder.isConfigSupported(config as VideoDecoderConfig)).supported
      );
    return (
      typeof AudioDecoder !== 'undefined' &&
      (await AudioDecoder.isConfigSupported(config as AudioDecoderConfig)).supported
    );
  } catch {
    return false;
  }
}

/**
 * Load one libav.js runtime for the entire worker pipeline. When a
 * patent-free player variant is configured, it handles both demuxing and any
 * necessary software decode. This deliberately avoids loading a second WASM
 * module beside the regular WebCodecs variant.
 */
async function loadDemuxRuntime(libavBase?: string, playerBase?: string) {
  const assetBase = new URL(playerBase || libavBase || './', scope.location.href).href;
  const loader = playerBase ? 'libav-patentfree-player.mjs' : 'libav-webcodecs.mjs';
  const [libavModule, bridge] = await Promise.all([
    import(/* @vite-ignore */ new URL(loader, assetBase).href),
    import(/* @vite-ignore */ new URL('libavjs-webcodecs-bridge.mjs', assetBase).href),
  ]);
  const LibAV = libavModule.default;
  // libav.js appends its own slash while resolving the selected WASM module.
  LibAV.base = assetBase.replace(/\/$/, '');
  runtime = { LibAV, ...bridge } as DemuxRuntime;
  return runtime;
}

function millisecondPacket(libav: any, packet: any, stream: any) {
  const scale = (1000 * Number(stream.time_base_num || 1)) / Number(stream.time_base_den || 1);
  const convert = (low: number | undefined, high: number | undefined) =>
    Math.round(libav.i64tof64(low || 0, high || 0) * scale);
  const [pts, ptshi] = libav.f64toi64(convert(packet.pts, packet.ptshi));
  const [dts, dtshi] = libav.f64toi64(convert(packet.dts, packet.dtshi));
  return {
    data: packet.data,
    pts,
    ptshi,
    dts,
    dtshi,
    duration: convert(packet.duration, packet.durationhi),
    durationhi: 0,
  };
}

function timestamp(libav: any, frame: any) {
  return libav.i64tof64(frame.pts || 0, frame.ptshi || 0) * 1000;
}

function frameToVideoFrame(libav: any, frame: any) {
  const formats: Record<number, VideoPixelFormat> = {
    [libav.AV_PIX_FMT_YUV420P]: 'I420',
    [libav.AV_PIX_FMT_YUVA420P]: 'I420A',
    [libav.AV_PIX_FMT_YUV422P]: 'I422',
    [libav.AV_PIX_FMT_NV12]: 'NV12',
    [libav.AV_PIX_FMT_RGBA]: 'RGBA',
    [libav.AV_PIX_FMT_BGRA]: 'BGRA',
  };
  const highBitDepth = highBitDepthYuv420[frame.format];
  const format = formats[frame.format] ?? (highBitDepth ? 'I420' : undefined);
  if (!format) throw new Error(`Unsupported software-decoder pixel format ${frame.format}`);
  const { data, layout } = packVideoPlanes(frame, format, highBitDepth);
  return new VideoFrame(data, {
    format,
    codedWidth: frame.width,
    codedHeight: frame.height,
    timestamp: timestamp(libav, frame),
    layout,
  });
}

// FFmpeg pixel-format IDs are ABI-stable. VP9/AV1 10- and 12-bit 4:2:0 frames
// use 16-bit little- or big-endian samples. Canvas cannot draw them directly,
// so they are converted to 8-bit I420 below. This preserves playback but is
// not HDR tone mapping: HDR transfer/color metadata is not transformed.
const highBitDepthYuv420: Record<number, { depth: 10 | 12; littleEndian: boolean }> = {
  61: { depth: 10, littleEndian: false },
  62: { depth: 10, littleEndian: true },
  122: { depth: 12, littleEndian: false },
  123: { depth: 12, littleEndian: true },
};

/**
 * FFmpeg frames commonly have aligned strides and padded plane offsets (for
 * example a 360px Theora frame can reserve 384 luma rows). Although those
 * layouts are valid, browser implementations have differed in their handling
 * of transferred padded I420 buffers. Copy each visible row into a compact
 * buffer so the VideoFrame layout is unambiguous.
 */
function packVideoPlanes(
  frame: any,
  format: VideoPixelFormat,
  highBitDepth?: { depth: 10 | 12; littleEndian: boolean },
) {
  const chromaWidth = Math.ceil(frame.width / 2);
  const chromaHeight = Math.ceil(frame.height / 2);
  const planes: Array<{ width: number; height: number; bytesPerPixel: number }> =
    format === 'I420'
      ? [
          { width: frame.width, height: frame.height, bytesPerPixel: 1 },
          { width: chromaWidth, height: chromaHeight, bytesPerPixel: 1 },
          { width: chromaWidth, height: chromaHeight, bytesPerPixel: 1 },
        ]
      : format === 'I420A'
        ? [
            { width: frame.width, height: frame.height, bytesPerPixel: 1 },
            { width: chromaWidth, height: chromaHeight, bytesPerPixel: 1 },
            { width: chromaWidth, height: chromaHeight, bytesPerPixel: 1 },
            { width: frame.width, height: frame.height, bytesPerPixel: 1 },
          ]
        : format === 'I422'
          ? [
              { width: frame.width, height: frame.height, bytesPerPixel: 1 },
              { width: chromaWidth, height: frame.height, bytesPerPixel: 1 },
              { width: chromaWidth, height: frame.height, bytesPerPixel: 1 },
            ]
          : format === 'NV12'
            ? [
                { width: frame.width, height: frame.height, bytesPerPixel: 1 },
                { width: chromaWidth, height: chromaHeight, bytesPerPixel: 2 },
              ]
            : [{ width: frame.width, height: frame.height, bytesPerPixel: 4 }];
  const source = frame.data as Uint8Array;
  const sourceLayout = frame.layout as Array<{ offset: number; stride: number }>;
  const size = planes.reduce((total, plane) => total + plane.width * plane.height * plane.bytesPerPixel, 0);
  const data = new Uint8Array(size);
  const layout: PlaneLayout[] = [];
  let outputOffset = 0;

  for (let index = 0; index < planes.length; index++) {
    const plane = planes[index];
    const rowBytes = plane.width * plane.bytesPerPixel;
    const input = sourceLayout[index];
    if (!input) throw new Error(`Missing layout for software-decoder plane ${index}`);
    layout.push({ offset: outputOffset, stride: rowBytes });
    for (let row = 0; row < plane.height; row++) {
      const start = input.offset + row * input.stride;
      if (!highBitDepth) {
        data.set(source.subarray(start, start + rowBytes), outputOffset + row * rowBytes);
        continue;
      }
      for (let column = 0; column < plane.width; column++) {
        const offset = start + column * 2;
        const sample = highBitDepth.littleEndian
          ? source[offset] | (source[offset + 1] << 8)
          : (source[offset] << 8) | source[offset + 1];
        data[outputOffset + row * rowBytes + column] = sample >> (highBitDepth.depth - 8);
      }
    }
    outputOffset += rowBytes * plane.height;
  }
  return { data, layout };
}

function frameToAudioData(libav: any, frame: any) {
  const formats: Record<number, AudioSampleFormat> = {
    [libav.AV_SAMPLE_FMT_U8]: 'u8',
    [libav.AV_SAMPLE_FMT_S16]: 's16',
    [libav.AV_SAMPLE_FMT_S32]: 's32',
    [libav.AV_SAMPLE_FMT_FLT]: 'f32',
    [libav.AV_SAMPLE_FMT_U8P]: 'u8-planar',
    [libav.AV_SAMPLE_FMT_S16P]: 's16-planar',
    [libav.AV_SAMPLE_FMT_S32P]: 's32-planar',
    [libav.AV_SAMPLE_FMT_FLTP]: 'f32-planar',
  };
  const format = formats[frame.format];
  if (!format) throw new Error(`Unsupported software-decoder sample format ${frame.format}`);
  const planes = Array.isArray(frame.data) ? frame.data : [frame.data];
  const bytes = new Uint8Array(planes.reduce((size: number, plane: Uint8Array) => size + plane.byteLength, 0));
  let offset = 0;
  for (const plane of planes) {
    bytes.set(new Uint8Array(plane.buffer, plane.byteOffset, plane.byteLength), offset);
    offset += plane.byteLength;
  }
  return new AudioData({
    format,
    data: bytes,
    sampleRate: frame.sample_rate,
    numberOfFrames: frame.nb_samples,
    numberOfChannels: frame.channels,
    timestamp: timestamp(libav, frame),
  });
}

async function emitDecoded(decoder: SoftwareDecoder, packet: any[], generation: number, flush = false) {
  const frames = await decoder.libav.ff_decode_multi(decoder.context, decoder.packet, decoder.frame, packet, flush);
  for (const frame of frames || []) {
    if (decoder.descriptor.kind === 'video') {
      const output = frameToVideoFrame(decoder.libav, frame);
      emit({ type: 'video-frame', generation, stream: decoder.descriptor.index, frame: output }, [output]);
    } else {
      const output = frameToAudioData(decoder.libav, frame);
      emit({ type: 'audio-data', generation, stream: decoder.descriptor.index, data: output }, [output]);
    }
  }
}

async function open(
  src: string,
  generation: number,
  libavBase?: string,
  softwareDecoderBase?: string,
  selectedAudioTrack?: number,
  startTime = 0,
  forceSoftwareDecode = false,
) {
  let libav: any;
  let formatContext = 0;
  let packet = 0;
  let fileName = '';
  let streams: any[] = [];
  const software: SoftwareDecoder[] = [];
  try {
    credits = 32;
    const demuxRuntime = await loadDemuxRuntime(libavBase, softwareDecoderBase);
    // The runtime is already inside this worker. Avoid nested pthread workers;
    // the player ships only the matching non-threaded WASM asset.
    libav = await demuxRuntime.LibAV.LibAV({ noworker: true, nothreads: true });
    fileName = `input-${generation}`;
    await openInput(libav, src, fileName);
    [formatContext, streams] = await libav.ff_init_demuxer_file(fileName);
    const selected = streams.filter((stream: any) => kindOf(stream));
    const descriptors: DemuxStream[] = [];
    for (const stream of selected) {
      const kind = kindOf(stream)!;
      const config =
        kind === 'video'
          ? await demuxRuntime.videoStreamToConfig(libav, stream)
          : await demuxRuntime.audioStreamToConfig(libav, stream);
      if (!config || typeof config.codec !== 'string')
        throw new Error(`Cannot create decoder configuration for stream ${stream.index}`);
      descriptors.push({
        index: stream.index,
        kind,
        codec: config.codec,
        label: `${kind} ${stream.index}`,
        language: '',
        config,
        decoder: !forceSoftwareDecode && (await supportsWebCodecs(kind, config)) ? 'webcodecs' : 'libav',
      });
    }
    if (!descriptors.length) throw new Error('No audio or video streams found');
    const activeAudioTrack =
      descriptors.find((stream) => stream.kind === 'audio' && stream.index === selectedAudioTrack)?.index ??
      descriptors.find((stream) => stream.kind === 'audio')?.index;
    const unsupported = descriptors.filter(
      (descriptor) =>
        descriptor.decoder === 'libav' && (descriptor.kind !== 'audio' || descriptor.index === activeAudioTrack),
    );
    if (unsupported.length && !softwareDecoderBase)
      throw new Error(
        `WebCodecs does not support ${unsupported.map((stream) => stream.codec).join(', ')} and no software decoder variant was configured`,
      );
    if (unsupported.length) {
      // The configured player runtime already provides avformat and avcodec,
      // so packets stay within one libav.js/WASM instance.
      const decoderLibav = libav;
      for (const descriptor of unsupported) {
        const stream = streams[descriptor.index];
        const codecpar = stream.codecpar ? await libav.ff_copyout_codecpar(stream.codecpar) : stream;
        // Codec IDs are stable FFmpeg identifiers, so FFmpeg selects the
        // decoder enabled in the player build directly.
        const [, context, decoderPacket, frame] = await decoderLibav.ff_init_decoder(codecpar.codec_id, {
          codecpar,
        });
        await decoderLibav.AVCodecContext_time_base_s(context, 1, 1000);
        software.push({ libav: decoderLibav, context, packet: decoderPacket, frame, stream, descriptor });
      }
    }
    const duration = Math.max(
      0,
      ...selected.map(
        (stream: any) =>
          (Number(stream.duration || 0) * Number(stream.time_base_num || 0)) / Number(stream.time_base_den || 1),
      ),
    );
    emit({ type: 'metadata', generation, duration, streams: descriptors });
    if (startTime > 0) {
      const seekStream = selected.find((stream: any) => kindOf(stream) === 'video') ?? selected[0];
      const units = (startTime * Number(seekStream.time_base_den || 1)) / Number(seekStream.time_base_num || 1);
      const [timestamp, timestamphi] = libav.f64toi64(units);
      await libav.av_seek_frame(formatContext, seekStream.index, timestamp, timestamphi, libav.AVSEEK_FLAG_BACKWARD);
      await libav.avformat_flush(formatContext);
    }
    packet = await libav.av_packet_alloc();
    for (;;) {
      if (generation === cancelledGeneration) break;
      const [result, packets] = await libav.ff_read_frame_multi(formatContext, packet, {
        limit: 512 * 1024,
        unify: true,
      });
      for (const rawPacket of packets[0] || []) {
        const stream = streams[Number(rawPacket.stream_index)];
        const descriptor = descriptors.find((item) => item.index === stream?.index);
        if (!stream || !descriptor || (descriptor.kind === 'audio' && descriptor.index !== activeAudioTrack)) continue;
        await waitForResume(generation);
        const softwareDecoder = software.find((item) => item.descriptor.index === stream.index);
        if (softwareDecoder) {
          await emitDecoded(softwareDecoder, [millisecondPacket(softwareDecoder.libav, rawPacket, stream)], generation);
          emit({ type: 'software-complete', generation, stream: stream.index });
        } else {
          const chunk =
            descriptor.kind === 'video'
              ? demuxRuntime.packetToEncodedVideoChunk(rawPacket, stream)
              : demuxRuntime.packetToEncodedAudioChunk(rawPacket, stream);
          emit({ type: 'chunk', generation, stream: stream.index, chunk });
        }
        credits--;
      }
      if (result === libav.AVERROR_EOF) break;
      if (result < 0 && result !== -libav.EAGAIN) throw new Error(`Demuxing failed (${result})`);
    }
    for (const decoder of software) await emitDecoded(decoder, [], generation, true);
    if (generation !== cancelledGeneration) emit({ type: 'end', generation });
  } catch (error) {
    if (generation !== cancelledGeneration)
      emit({ type: 'error', generation, message: error instanceof Error ? error.message : String(error) });
  } finally {
    for (const decoder of software) await decoder.libav.ff_free_decoder(decoder.context, decoder.packet, decoder.frame);
    if (packet) await libav?.av_packet_free_js(packet);
    if (formatContext) await libav?.avformat_close_input_js(formatContext);
    if (fileName) await libav?.unlink(fileName);
  }
}

scope.onmessage = ({ data }: MessageEvent<WorkerRequest>) => {
  if (data.type === 'open') {
    cancelledGeneration = -1;
    credits = 32;
    void open(
      data.src,
      data.generation,
      data.libavBase,
      data.softwareDecoderBase,
      data.selectedAudioTrack,
      data.startTime,
      data.forceSoftwareDecode,
    );
  }
  if (data.type === 'close') {
    cancelledGeneration = data.generation;
    resume?.();
  }
  if (data.type === 'resume') {
    credits++;
    resume?.();
  }
};
