// Замер локального синтеза в Chromium: модели кладутся в out/bench/, сервер отдаёт out/.
// WAV_DIR=путь — сохранить звучание тестовых фраз (то, что услышит бабушка).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

function wav(pcm: number[], rate: number): Buffer {
  const b = Buffer.alloc(44 + pcm.length * 2);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + pcm.length * 2, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write("data", 36);
  b.writeUInt32LE(pcm.length * 2, 40);
  pcm.forEach((x, i) => b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x)) * 32767), 44 + i * 2));
  return b;
}
const wavDir = process.env.WAV_DIR;
if (wavDir) mkdirSync(wavDir, { recursive: true });
const phr = {
  ru: ["Я хочу пить.", "У меня сильно болит голова.", "Позвони Алии, пожалуйста.", "Мне грустно, потому что Алия давно не звонила.", "Вы хотите увидеть Ерлана?"],
  kk: ["Мен су ішкім келеді.", "Басым қатты ауырып тұр.", "Әлияға қоңырау шалшы.", "Көңілім жоқ, себебі Әлия көптен бері хабарласпады.", "Ерланды көргіңіз келе ме?"],
};
const voices = [["ru_RU-irina-medium", 0], ["ru_RU-denis-medium", 0], ["ru_RU-dmitri-medium", 0], ["kk_KZ-raya-x_low", 0], ["kk_KZ-iseke-x_low", 0], ["kk_KZ-issai-high", 3], ["kk_KZ-issai-high", 4]] as const;
// ONLY=raya — только голоса с этим словом в имени; LENGTH_SCALE — темп (больше — медленнее).
const only = process.env.ONLY;
const lengthScale = Number(process.env.LENGTH_SCALE ?? 1.12);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("" + (process.env.BASE_URL ?? "http://localhost:3101") + "/");
for (const [name, spk] of voices) {
  if (only && !name.includes(only)) continue;
  const lang = name.slice(0, 2) as "ru" | "kk";
  const r = await page.evaluate(async ({ name, spk, lang, texts, keep, lengthScale }) => {
    const w = new Worker("/workers/tts-worker.js");
    let n = 0;
    const call = (msg: object) => new Promise<any>((res) => { const id = ++n; const h = (e: MessageEvent) => { if (e.data.id === id) { w.removeEventListener("message", h); res(e.data); } }; w.addEventListener("message", h); w.postMessage({ ...msg, id }); });
    await call({ type: "init", voices: { [lang]: { model: `/bench/${name}.onnx`, config: `/bench/${name}.onnx.json`, speaker: spk, lengthScale } } });
    const t0 = performance.now();
    const warm = await call({ type: "warmup" });
    const load = performance.now() - t0;
    let ms = 0, audio = 0, rms = 0;
    const first: number[] = [];
    const clips: { pcm: number[]; rate: number }[] = [];
    for (const text of texts) {
      const t = performance.now();
      const o = await call({ type: "speak", lang, text });
      if (o.error) return { error: o.error };
      const dt = performance.now() - t;
      first.push(Math.round(dt));
      ms += dt; audio += o.pcm.length / o.rate;
      let s = 0; for (const x of o.pcm) s += x * x; rms += Math.sqrt(s / o.pcm.length);
      if (keep) clips.push({ pcm: Array.from(o.pcm as Float32Array), rate: o.rate });
    }
    w.terminate();
    return { clips, warm: warm.error ?? "ok", load_ms: Math.round(load), synth_ms: Math.round(ms), audio_s: +audio.toFixed(1), rtf: +(ms / 1000 / audio).toFixed(3), per_phrase_ms: first, rms: +(rms / texts.length).toFixed(3) };
  }, { name, spk, lang, texts: phr[lang], keep: !!wavDir, lengthScale });
  const label = name + (spk ? `-s${spk}` : "");
  if ("clips" in r) {
    const { clips, ...rest } = r;
    (clips ?? []).forEach((c, i) => writeFileSync(join(wavDir!, `${label}-${i + 1}.wav`), wav(c.pcm, c.rate)));
    console.log(label, JSON.stringify(rest));
  } else console.log(label, JSON.stringify(r));
}
await browser.close();
