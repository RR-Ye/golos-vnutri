// MFCC: предыскажение, окна по 25 мс с шагом 10 мс, мел-фильтры, логарифм, ДКП.
// Плюс дельты и нормализация по высказыванию (CMVN), чтобы сравнение не зависело
// от громкости и микрофона.
import { powerSpectrum } from "./fft.ts";

export interface MfccOptions {
  rate: number;
  frameMs: number;
  hopMs: number;
  nfft: number;
  nMel: number;
  nCeps: number;
  fMin: number;
  fMax: number;
  preEmphasis: number;
}

export const DEFAULT_MFCC: MfccOptions = {
  rate: 16000,
  frameMs: 25,
  hopMs: 10,
  nfft: 512,
  nMel: 26,
  nCeps: 13,
  fMin: 60,
  fMax: 7600,
  preEmphasis: 0.97,
};

export interface Features {
  /** Кадры подряд: nFrames × dims. */
  data: Float32Array;
  nFrames: number;
  dims: number;
}

const hz2mel = (f: number) => 2595 * Math.log10(1 + f / 700);
const mel2hz = (m: number) => 700 * (10 ** (m / 2595) - 1);

const bankCache = new Map<string, Float64Array[]>();

function melBank(o: MfccOptions): Float64Array[] {
  const key = `${o.rate}/${o.nfft}/${o.nMel}/${o.fMin}/${o.fMax}`;
  const hit = bankCache.get(key);
  if (hit) return hit;
  const lo = hz2mel(o.fMin);
  const hi = hz2mel(o.fMax);
  const pts = Array.from({ length: o.nMel + 2 }, (_, i) => mel2hz(lo + ((hi - lo) * i) / (o.nMel + 1)));
  const bins = pts.map((f) => Math.floor(((o.nfft + 1) * f) / o.rate));
  const bank: Float64Array[] = [];
  for (let m = 1; m <= o.nMel; m++) {
    const f = new Float64Array(o.nfft / 2 + 1);
    const [a, b, c] = [bins[m - 1]!, bins[m]!, bins[m + 1]!];
    for (let k = a; k < b; k++) f[k] = (k - a) / Math.max(1, b - a);
    for (let k = b; k < c; k++) f[k] = (c - k) / Math.max(1, c - b);
    bank.push(f);
  }
  bankCache.set(key, bank);
  return bank;
}

/** Статические MFCC без нормализации: nFrames × nCeps. */
export function mfcc(pcm: Float32Array, opts: Partial<MfccOptions> = {}): Features {
  const o = { ...DEFAULT_MFCC, ...opts };
  const frameLen = Math.round((o.rate * o.frameMs) / 1000);
  const hop = Math.round((o.rate * o.hopMs) / 1000);
  const nFrames = pcm.length < frameLen ? 0 : 1 + Math.floor((pcm.length - frameLen) / hop);
  const bank = melBank(o);
  const window = Float64Array.from({ length: frameLen }, (_, i) => 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (frameLen - 1)));
  const out = new Float32Array(nFrames * o.nCeps);
  const frame = new Float64Array(o.nfft);
  const logMel = new Float64Array(o.nMel);
  for (let t = 0; t < nFrames; t++) {
    frame.fill(0);
    const start = t * hop;
    for (let i = 0; i < frameLen; i++) {
      const x = pcm[start + i]! - (start + i > 0 ? o.preEmphasis * pcm[start + i - 1]! : 0);
      frame[i] = x * window[i]!;
    }
    const ps = powerSpectrum(frame);
    for (let m = 0; m < o.nMel; m++) {
      let e = 0;
      const f = bank[m]!;
      for (let k = 0; k < f.length; k++) e += f[k]! * ps[k]!;
      logMel[m] = Math.log(e + 1e-10);
    }
    for (let c = 0; c < o.nCeps; c++) {
      let s = 0;
      for (let m = 0; m < o.nMel; m++) s += logMel[m]! * Math.cos((Math.PI * c * (m + 0.5)) / o.nMel);
      out[t * o.nCeps + c] = s;
    }
  }
  return { data: out, nFrames, dims: o.nCeps };
}

/** Добавляет дельты (разности по ±2 кадрам). */
export function withDeltas(f: Features, n = 2): Features {
  const { nFrames, dims, data } = f;
  const out = new Float32Array(nFrames * dims * 2);
  const denom = 2 * Array.from({ length: n }, (_, i) => (i + 1) ** 2).reduce((s, x) => s + x, 0);
  for (let t = 0; t < nFrames; t++) {
    for (let d = 0; d < dims; d++) {
      out[t * dims * 2 + d] = data[t * dims + d]!;
      let acc = 0;
      for (let k = 1; k <= n; k++) {
        const a = data[Math.min(nFrames - 1, t + k) * dims + d]!;
        const b = data[Math.max(0, t - k) * dims + d]!;
        acc += k * (a - b);
      }
      out[t * dims * 2 + dims + d] = acc / denom;
    }
  }
  return { data: out, nFrames, dims: dims * 2 };
}

/** Нормализация среднего и дисперсии по высказыванию: громкость и микрофон перестают влиять. */
export function cmvn(f: Features): Features {
  const { nFrames, dims, data } = f;
  const out = new Float32Array(data.length);
  for (let d = 0; d < dims; d++) {
    let mean = 0;
    for (let t = 0; t < nFrames; t++) mean += data[t * dims + d]!;
    mean /= Math.max(1, nFrames);
    let v = 0;
    for (let t = 0; t < nFrames; t++) v += (data[t * dims + d]! - mean) ** 2;
    const sd = Math.sqrt(v / Math.max(1, nFrames)) || 1;
    for (let t = 0; t < nFrames; t++) out[t * dims + d] = (data[t * dims + d]! - mean) / sd;
  }
  return { data: out, nFrames, dims };
}

/** Признаки для сравнения слов: MFCC + дельты + CMVN. */
export function wordFeatures(pcm: Float32Array, opts: Partial<MfccOptions> = {}): Features {
  return cmvn(withDeltas(mfcc(pcm, opts)));
}
