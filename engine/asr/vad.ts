// Определение речи по энергии: где в записи слова, а где тишина.
import { frameRms } from "./pcm.ts";

export interface Segment {
  /** Начало и конец в отсчётах. */
  start: number;
  end: number;
}

export interface VadOptions {
  rate: number;
  frameMs: number;
  /** Порог над уровнем шума (во сколько раз). */
  factor: number;
  /** Минимальная пауза между словами. */
  minGapMs: number;
  /** Минимальная длина слова. */
  minSpeechMs: number;
  padMs: number;
}

export const DEFAULT_VAD: VadOptions = { rate: 16000, frameMs: 20, factor: 3, minGapMs: 220, minSpeechMs: 120, padMs: 60 };

/** Уровень шума — нижний перцентиль энергии кадров. */
export function noiseFloor(rms: number[]): number {
  if (!rms.length) return 0;
  const s = [...rms].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.1)] ?? 0;
}

/** Делит запись на слова по паузам. */
export function segmentSpeech(pcm: Float32Array, opts: Partial<VadOptions> = {}): Segment[] {
  const o = { ...DEFAULT_VAD, ...opts };
  const frame = Math.round((o.rate * o.frameMs) / 1000);
  const rms = frameRms(pcm, frame);
  if (!rms.length) return [];
  const floor = noiseFloor(rms);
  const peak = Math.max(...rms);
  const thr = Math.max(floor * o.factor, floor + (peak - floor) * 0.1, 0.004);
  const active = rms.map((v) => v > thr);
  const minGap = Math.round(o.minGapMs / o.frameMs);
  const minSpeech = Math.round(o.minSpeechMs / o.frameMs);
  const pad = Math.round((o.padMs / 1000) * o.rate);
  const segs: [number, number][] = [];
  let i = 0;
  while (i < active.length) {
    if (!active[i]) {
      i++;
      continue;
    }
    let j = i;
    let silence = 0;
    let lastActive = i;
    while (j < active.length && silence <= minGap) {
      if (active[j]) {
        lastActive = j;
        silence = 0;
      } else silence++;
      j++;
    }
    if (lastActive - i + 1 >= minSpeech) segs.push([i, lastActive]);
    i = j;
  }
  return segs.map(([a, b]) => ({ start: Math.max(0, a * frame - pad), end: Math.min(pcm.length, (b + 1) * frame + pad) }));
}

/** Завершилась ли речь: после последнего звука прошла пауза не короче endSilenceMs. */
export function speechEnded(pcm: Float32Array, endSilenceMs = 1200, opts: Partial<VadOptions> = {}): boolean {
  const o = { ...DEFAULT_VAD, ...opts };
  const segs = segmentSpeech(pcm, o);
  const last = segs[segs.length - 1];
  if (!last) return false;
  return pcm.length - last.end >= (endSilenceMs / 1000) * o.rate;
}
