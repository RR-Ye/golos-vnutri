// Скачивает выбранные голоса Piper в public/voices/ и пишет manifest.json.
// Нужен интернет один раз, при сборке; в приложении голоса берутся из кэша.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";

const BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/";
const MANIFEST = "public/voices/manifest.json";
const cfg = JSON.parse(readFileSync("voices.config.json", "utf8")) as Record<string, { path: string; speaker: number; lengthScale: number }>;
const before = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as Record<string, { source?: string }>) : {};
mkdirSync("public/voices", { recursive: true });
const manifest: Record<string, unknown> = {};
for (const [lang, v] of Object.entries(cfg)) {
  if (lang.startsWith("$")) continue;
  for (const ext of [".onnx", ".onnx.json"]) {
    const dst = `public/voices/${lang}${ext}`;
    if (before[lang]?.source === v.path && existsSync(dst) && statSync(dst).size > 0) continue;
    const res = await fetch(BASE + v.path + ext);
    if (!res.ok) throw new Error(`${v.path}${ext}: HTTP ${res.status}`);
    writeFileSync(dst, Buffer.from(await res.arrayBuffer()));
    console.log(`скачан ${dst}`);
  }
  manifest[lang] = {
    // Относительно манифеста: приложение может жить не в корне сайта.
    model: `${lang}.onnx`,
    config: `${lang}.onnx.json`,
    speaker: v.speaker,
    lengthScale: v.lengthScale,
    name: v.path.split("/").pop(),
    source: v.path,
  };
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
console.log("голоса:", Object.keys(manifest).join(", "));
