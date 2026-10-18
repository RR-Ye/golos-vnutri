// Проверка APK на эмуляторе Android (запускается в CI): первый запуск, голос синтеза
// внутри WebView, синтез фразы с именем. Снимок экрана — android-smoke.png.
import { writeFileSync } from "node:fs";
import { _android } from "playwright";

const PKG = "kz.golosvnutri.app";
const [device] = await _android.devices();
if (!device) throw new Error("нет устройства adb");
console.log("устройство:", device.model(), device.serial());

await device.shell(`am start -n ${PKG}/.MainActivity`);
const webview = await device.webView({ pkg: PKG }, { timeout: 120_000 });
const page = await webview.page();
page.on("console", (m) => console.log("console:", m.text().slice(0, 300)));
page.on("pageerror", (e) => console.log("pageerror:", e.message));
console.log("адрес:", page.url());

await page.getByTestId("setup-pin").fill("1234", { timeout: 60_000 });
await page.getByTestId("setup-pin2").fill("1234");
await page.getByTestId("setup-demo").click();
await page.getByTestId("btn-start").waitFor({ timeout: 60_000 });
await page.waitForFunction(() => (window as { __golosSynth?: string }).__golosSynth !== "loading" && (window as { __golosSynth?: string }).__golosSynth !== undefined, undefined, {
  timeout: 180_000,
});
const synth = await page.evaluate(() => (window as { __golosSynth?: string }).__golosSynth);
console.log("голос синтеза:", synth);

// Синтез фразы отдельным воркером — без звуковой карты эмулятора.
const r = await page.evaluate(async () => {
  const res = await fetch("/app/voices/manifest.json");
  const voices = await res.json();
  for (const v of Object.values(voices) as { model: string; config: string }[]) {
    v.model = new URL(v.model, res.url).pathname;
    v.config = new URL(v.config, res.url).pathname;
  }
  const w = new Worker("/app/workers/tts-worker.js");
  let n = 0;
  const call = (msg: object) =>
    new Promise<{ error?: string; pcm?: Float32Array; rate?: number; ms?: number }>((resolve) => {
      const id = ++n;
      const h = (e: MessageEvent) => {
        if (e.data.id !== id) return;
        w.removeEventListener("message", h);
        resolve(e.data);
      };
      w.addEventListener("message", h);
      w.postMessage({ ...msg, id });
    });
  await call({ type: "init", voices });
  const out: Record<string, unknown> = {};
  for (const [lang, text, fixes] of [
    ["ru", "Позвони Асели, пожалуйста.", [{ word: "Асели", vowel: 2, total: 3 }]],
    ["kk", "Арияннаға қоңырау шалшы.", [{ word: "Арияннаға", vowel: 5, total: 5 }]],
  ] as const) {
    const s = await call({ type: "speak", lang, text, fixes });
    out[lang] = s.error ?? { seconds: +((s.pcm?.length ?? 0) / (s.rate ?? 1)).toFixed(1), ms: Math.round(s.ms ?? 0) };
  }
  return out;
});
console.log("синтез:", JSON.stringify(r));

writeFileSync("android-smoke.png", await device.screenshot());
await device.close();

const ok = synth === "ready" && typeof r.ru === "object" && typeof r.kk === "object";
if (!ok) {
  console.error("✗ голос в APK не работает");
  process.exit(1);
}
console.log("✓ APK: приложение открылось, голос синтеза работает на обоих языках");
