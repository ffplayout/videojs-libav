export const audioWorkletSource = `
class LibavAudioProcessor extends AudioWorkletProcessor {
  constructor() { super(); this.queue = []; this.offset = 0; this.port.onmessage = ({data}) => { if (data.reset) { this.queue = []; this.offset = 0; } else this.queue.push(data); }; }
  process(_, outputs) {
    const output = outputs[0];
    for (let i = 0; i < output[0].length; i++) {
      const block = this.queue[0];
      for (let channel = 0; channel < output.length; channel++) output[channel][i] = block ? (block.channels[channel] || block.channels[0])[this.offset] || 0 : 0;
      if (block && ++this.offset >= block.frames) { this.queue.shift(); this.offset = 0; }
    }
    return true;
  }
}
registerProcessor('videojs-libav-audio', LibavAudioProcessor);`;

export class AudioSink {
  #context?: AudioContext;
  #node?: AudioWorkletNode;
  #pending: Array<{ channels: Float32Array[]; frames: number }> = [];
  #start = 0;
  #volume = 1;
  async start() {
    if (!this.#context) {
      this.#context = new AudioContext();
      const url = URL.createObjectURL(new Blob([audioWorkletSource], { type: 'text/javascript' }));
      await this.#context.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      this.#node = new AudioWorkletNode(this.#context, 'videojs-libav-audio');
      this.#node.connect(this.#context.destination);
    }
    await this.#context.resume();
    this.#start = this.#context.currentTime;
    for (const block of this.#pending.splice(0)) this.#post(block);
  }
  get clock() {
    return this.#context ? Math.max(0, this.#context.currentTime - this.#start) : 0;
  }
  set volume(value: number) {
    this.#volume = value;
    if (this.#node) this.#node.parameters;
  }
  enqueue(data: AudioData) {
    // Some decoders emit a zero-frame output while draining or after trimming
    // codec delay. AudioData.copyTo() rejects those frames, and they carry no
    // samples that need to reach the worklet.
    if (!data.numberOfFrames || !data.numberOfChannels) {
      data.close();
      return;
    }
    const channels: ArrayBuffer[] = [];
    for (let channel = 0; channel < data.numberOfChannels; channel++) {
      const samples = new Float32Array(data.numberOfFrames);
      data.copyTo(samples, { planeIndex: channel, format: 'f32-planar' });
      for (let i = 0; i < samples.length; i++) samples[i] *= this.#volume;
      channels.push(samples.buffer);
    }
    const block = { channels: channels.map((buffer) => new Float32Array(buffer)), frames: data.numberOfFrames };
    // Decoders are allowed to run while the element is preloading. Preserve
    // those samples until a user gesture creates/resumes the AudioContext;
    // previously they were silently discarded before the first Play click.
    if (this.#node) this.#post(block);
    else if (this.#pending.length < 128) this.#pending.push(block);
    data.close();
  }
  #post(block: { channels: Float32Array[]; frames: number }) {
    const transfers = block.channels.map((channel) => channel.buffer);
    this.#node?.port.postMessage(block, transfers);
  }
  pause() {
    void this.#context?.suspend();
  }
  reset() {
    this.#pending = [];
    this.#node?.port.postMessage({ reset: true });
  }
  close() {
    this.#node?.disconnect();
    void this.#context?.close();
    this.#node = undefined;
    this.#context = undefined;
  }
}
