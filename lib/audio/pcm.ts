// Чистые функции для звука: передискретизация, обрезка тишины, WAV. Без DOM.

export const TARGET_RATE = 16_000;

/** Передискретизация с усреднением окна (простое подавление наложения при понижении частоты). */
export function resample(input: Float32Array, fromRate: number, toRate = TARGET_RATE): Float32Array {
  if (fromRate === toRate) return input.slice();
  const ratio = fromRate / toRate;
  const outLen = Math.floor(input.length / ratio);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const start = i * ratio;
    const end = Math.min(input.length, start + ratio);
    let sum = 0;
    let n = 0;
    for (let j = Math.floor(start); j < end; j++) {
      sum += input[j]!;
      n++;
    }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

/** Энергия (RMS) по кадрам. */
export function frameRms(pcm: Float32Array, frame = 320): number[] {
  const out: number[] = [];
  for (let i = 0; i + frame <= pcm.length; i += frame) {
    let s = 0;
    for (let j = i; j < i + frame; j++) s += pcm[j]! * pcm[j]!;
    out.push(Math.sqrt(s / frame));
  }
  return out;
}

/**
 * Обрезает тишину по краям. Порог — от уровня шума (нижний перцентиль энергии).
 * Возвращает исходный сигнал, если речи не нашлось.
 */
export function trimSilence(pcm: Float32Array, rate = TARGET_RATE, padMs = 80): Float32Array {
  const frame = Math.round(rate * 0.02);
  const rms = frameRms(pcm, frame);
  if (rms.length === 0) return pcm;
  const sorted = [...rms].sort((a, b) => a - b);
  const noise = sorted[Math.floor(sorted.length * 0.1)] ?? 0;
  const peak = sorted[sorted.length - 1] ?? 0;
  const thr = Math.max(noise * 3, noise + (peak - noise) * 0.12, 0.004);
  const first = rms.findIndex((v) => v > thr);
  if (first < 0) return pcm;
  let last = rms.length - 1;
  while (last > first && rms[last]! <= thr) last--;
  const pad = Math.round((padMs / 1000) * rate);
  const start = Math.max(0, first * frame - pad);
  const end = Math.min(pcm.length, (last + 1) * frame + pad);
  return pcm.slice(start, end);
}

/** 16-битный моно WAV. */
export function encodeWav(pcm: Float32Array, rate = TARGET_RATE): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  v.setUint32(4, 36 + pcm.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) {
    const s = Math.max(-1, Math.min(1, pcm[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Uint8Array(buf);
}

/** Разбор 16-битного PCM WAV (моно или стерео → моно). */
export function decodeWav(bytes: Uint8Array): { pcm: Float32Array; rate: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let off = 12;
  let rate = TARGET_RATE;
  let channels = 1;
  let bits = 16;
  while (off + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[off]!, bytes[off + 1]!, bytes[off + 2]!, bytes[off + 3]!);
    const size = v.getUint32(off + 4, true);
    if (id === "fmt ") {
      channels = v.getUint16(off + 10, true);
      rate = v.getUint32(off + 12, true);
      bits = v.getUint16(off + 22, true);
    } else if (id === "data") {
      if (bits !== 16) throw new Error(`поддерживается только 16-битный WAV, а не ${bits}`);
      const n = Math.floor(size / 2 / channels);
      const pcm = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let c = 0; c < channels; c++) s += v.getInt16(off + 8 + (i * channels + c) * 2, true);
        pcm[i] = s / channels / 0x8000;
      }
      return { pcm, rate };
    }
    off += 8 + size + (size % 2);
  }
  throw new Error("в WAV нет блока data");
}
