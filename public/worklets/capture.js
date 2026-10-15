// AudioWorklet: передаёт сырые отсчёты в основной поток пачками по ~100 мс.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buf = [];
    this.len = 0;
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      this.buf.push(ch.slice());
      this.len += ch.length;
      if (this.len >= sampleRate / 10) {
        const out = new Float32Array(this.len);
        let o = 0;
        for (const b of this.buf) {
          out.set(b, o);
          o += b.length;
        }
        this.port.postMessage(out, [out.buffer]);
        this.buf = [];
        this.len = 0;
      }
    }
    return true;
  }
}
registerProcessor("capture", CaptureProcessor);
