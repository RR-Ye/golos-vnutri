"use client";

import { encodeWav, resample, TARGET_RATE, trimSilence } from "./pcm";

export interface Recording {
  /** 16 кГц моно, тишина по краям обрезана. */
  pcm: Float32Array;
  wav: Blob;
  durationMs: number;
}

export type RecorderError = "denied" | "unsupported";

/** Поток отсчётов с микрофона. Используется и для записи образцов, и для «Сказать». */
export class MicStream {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;
  rate = 48_000;

  static supported(): boolean {
    return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && "AudioWorkletNode" in window;
  }

  async start(onChunk: (chunk: Float32Array) => void): Promise<void> {
    if (!MicStream.supported()) throw new Error("unsupported" satisfies RecorderError);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      throw new Error("denied" satisfies RecorderError);
    }
    this.ctx = new AudioContext();
    this.rate = this.ctx.sampleRate;
    await this.ctx.audioWorklet.addModule("/worklets/capture.js");
    const src = this.ctx.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.ctx, "capture");
    this.node.port.onmessage = (e: MessageEvent<Float32Array>) => onChunk(e.data);
    src.connect(this.node);
  }

  async stop(): Promise<void> {
    this.node?.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close().catch(() => undefined);
    this.node = null;
    this.stream = null;
    this.ctx = null;
  }
}

/** Запись по кнопке «Записать» / «Стоп». */
export class ManualRecorder {
  private mic = new MicStream();
  private chunks: Float32Array[] = [];

  async start(): Promise<void> {
    this.chunks = [];
    await this.mic.start((c) => this.chunks.push(c));
  }

  async stop(): Promise<Recording> {
    const rate = this.mic.rate;
    await this.mic.stop();
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const raw = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      raw.set(c, o);
      o += c.length;
    }
    const pcm = trimSilence(resample(raw, rate, TARGET_RATE), TARGET_RATE);
    return {
      pcm,
      wav: new Blob([encodeWav(pcm, TARGET_RATE)], { type: "audio/wav" }),
      durationMs: Math.round((pcm.length / TARGET_RATE) * 1000),
    };
  }
}
