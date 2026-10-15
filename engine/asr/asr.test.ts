import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { collapseSeries } from "./series.ts";
import { leaveOneOut, recognize, type Template } from "./classifier.ts";
import { dtwDistance } from "./dtw.ts";
import { fftInPlace } from "./fft.ts";
import { mfcc, wordFeatures } from "./mfcc.ts";
import { decodeWav, resample, trimSilence } from "./pcm.ts";
import { segmentSpeech, speechEnded } from "./vad.ts";

// Прокси-набор: 10 слов × 8 вариантов, синтезированы локально espeak-ng разными голосами,
// темпом и высотой. Проверяет конвейер, а не её речь: настоящую точность покажет экран
// теста распознавания на её записях.
const DIR = join(import.meta.dirname, "fixtures");
const manifest = JSON.parse(readFileSync(join(DIR, "manifest.json"), "utf8")) as { items: { file: string; word: string }[] };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function load(file: string): Float32Array {
  const { pcm, rate } = decodeWav(new Uint8Array(readFileSync(join(DIR, file))));
  return trimSilence(resample(pcm, rate, 16000), 16000);
}

/** Белый шум с заданным отношением сигнал/шум. */
function addNoise(pcm: Float32Array, snrDb: number, r: () => number): Float32Array {
  let p = 0;
  for (const x of pcm) p += x * x;
  p /= pcm.length || 1;
  const sd = Math.sqrt(p / 10 ** (snrDb / 10));
  return pcm.map((x) => x + sd * (r() * 2 - 1) * Math.sqrt(3));
}

const clean = manifest.items.map((it) => ({ word: it.word, pcm: load(it.file) }));

describe("распознавание: части конвейера", () => {
  it("БПФ находит частоту синуса", () => {
    const n = 512;
    const re = Float64Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * 32 * i) / n));
    const im = new Float64Array(n);
    fftInPlace(re, im);
    let best = 0;
    for (let k = 1; k < n / 2; k++) if (Math.hypot(re[k]!, im[k]!) > Math.hypot(re[best]!, im[best]!)) best = k;
    expect(best).toBe(32);
  });

  it("MFCC: 13 коэффициентов на кадр 10 мс", () => {
    const f = mfcc(new Float32Array(16000).map((_, i) => Math.sin(i / 7)));
    expect(f.dims).toBe(13);
    expect(f.nFrames).toBe(98);
  });

  it("DTW: запись ближе к самой себе в другом темпе, чем к другому слову", () => {
    const su = clean.filter((c) => c.word === "w.su");
    const nan = clean.find((c) => c.word === "w.nan")!;
    const a = wordFeatures(su[0]!.pcm);
    const b = wordFeatures(su[1]!.pcm);
    expect(dtwDistance(a, a)).toBe(0);
    expect(dtwDistance(a, b)).toBeLessThan(dtwDistance(a, wordFeatures(nan.pcm)));
  });

  it("VAD делит серию «сен, сен, сен» на три слова и видит конец речи", () => {
    const sen = clean.find((c) => c.word === "w.sen")!.pcm;
    const gap = new Float32Array(16000 * 0.4);
    const tail = new Float32Array(16000 * 1.5);
    const series = new Float32Array(sen.length * 3 + gap.length * 2 + tail.length);
    let o = 0;
    for (let i = 0; i < 3; i++) {
      series.set(sen, o);
      o += sen.length + (i < 2 ? gap.length : 0);
    }
    expect(segmentSpeech(series)).toHaveLength(3);
    expect(speechEnded(series, 1200)).toBe(true);
    expect(speechEnded(series.slice(0, o - 100), 1200)).toBe(false);
  });

  it("серия одинаковых слов в пределах 3 с — одно слово с повтором", () => {
    const s = collapseSeries([
      { wordId: "w.sen", confidence: 0.7, at: 0 },
      { wordId: "w.sen", confidence: 0.8, at: 900 },
      { wordId: "w.sen", confidence: 0.6, at: 1800 },
      { wordId: "w.su", confidence: 0.9, at: 2500 },
      { wordId: "w.su", confidence: 0.9, at: 6000 },
    ]);
    expect(s.map((x) => [x.wordId, x.repeats])).toEqual([
      ["w.sen", 3],
      ["w.su", 1],
      ["w.su", 1],
    ]);
    expect(s[0]!.confidence).toBe(0.8);
  });
});

describe("распознавание: точность на прокси-наборе (10 слов)", () => {
  const templates: Template[] = clean.map((c) => ({ wordId: c.word, features: wordFeatures(c.pcm) }));

  it("без шума — не ниже 85 %", () => {
    const r = leaveOneOut(templates);
    console.log(`точность без шума: ${(r.accuracy * 100).toFixed(1)} % (${r.total} записей)`);
    expect(r.accuracy).toBeGreaterThanOrEqual(0.85);
  });

  it("с шумом 15 дБ на распознаваемой записи — не ниже 85 %", () => {
    const r = rng(11);
    let correct = 0;
    clean.forEach((c, i) => {
      const rest = templates.filter((_, j) => j !== i);
      const q = wordFeatures(addNoise(c.pcm, 15, r));
      if (recognize(q, rest).matches[0]?.wordId === c.word) correct++;
    });
    const acc = correct / clean.length;
    console.log(`точность с шумом 15 дБ: ${(acc * 100).toFixed(1)} %`);
    expect(acc).toBeGreaterThanOrEqual(0.85);
  });

  it("жёсткие условия (шум 5 дБ и темп ±15 %) — отчёт, порог 70 %", () => {
    const r = rng(5);
    let correct = 0;
    clean.forEach((c, i) => {
      const rest = templates.filter((_, j) => j !== i);
      const tempo = 0.85 + 0.3 * r();
      const q = wordFeatures(addNoise(resample(c.pcm, 16000, Math.round(16000 / tempo)), 5, r));
      if (recognize(q, rest).matches[0]?.wordId === c.word) correct++;
    });
    const acc = correct / clean.length;
    console.log(`точность в жёстких условиях: ${(acc * 100).toFixed(1)} %`);
    expect(acc).toBeGreaterThanOrEqual(0.7);
  });

  it("шум без слова не принимается за слово", () => {
    const r = rng(3);
    const noise = new Float32Array(12000).map(() => (r() * 2 - 1) * 0.05);
    const res = recognize(wordFeatures(noise), templates);
    expect(res.unknown || (res.matches[0]?.confidence ?? 0) < 0.5).toBe(true);
  });
});
