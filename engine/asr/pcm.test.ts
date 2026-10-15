import { describe, expect, it } from "vitest";
import { decodeWav, encodeWav, resample, trimSilence } from "./pcm.ts";

const tone = (n: number, rate: number, f = 440, amp = 0.5) =>
  Float32Array.from({ length: n }, (_, i) => amp * Math.sin((2 * Math.PI * f * i) / rate));

describe("pcm", () => {
  it("WAV туда и обратно сохраняет сигнал", () => {
    const x = tone(1600, 16000);
    const { pcm, rate } = decodeWav(encodeWav(x));
    expect(rate).toBe(16000);
    expect(pcm.length).toBe(x.length);
    for (let i = 0; i < x.length; i += 97) expect(pcm[i]).toBeCloseTo(x[i]!, 3);
  });

  it("передискретизация 48 кГц → 16 кГц даёт втрое меньше отсчётов", () => {
    expect(resample(tone(48000, 48000), 48000).length).toBe(16000);
  });

  it("обрезает тишину по краям, оставляя речь", () => {
    const rate = 16000;
    const silence = new Float32Array(rate / 2).map(() => (Math.random() - 0.5) * 0.002);
    const x = new Float32Array(rate * 1.5);
    x.set(silence, 0);
    x.set(tone(rate / 2, rate), rate / 2);
    x.set(silence, rate);
    const y = trimSilence(x, rate);
    expect(y.length).toBeGreaterThan(rate * 0.5);
    expect(y.length).toBeLessThan(rate * 0.75);
  });
});
