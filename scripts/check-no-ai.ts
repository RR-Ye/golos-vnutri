// Проверка жёстких ограничений ТЗ: никаких внешних ИИ, облачных сервисов и сетевых адресов
// в коде приложения и зависимостях. Запускается в `npm run check`.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_PACKAGES = [
  /openai/i, /anthropic/i, /@google\/genai/i, /google-cloud/i, /@google-cloud\//i, /googleapis/i, /yandex/i,
  /elevenlabs/i, /huggingface/i, /@xenova\/transformers/i, /transformers\.js/i, /langchain/i, /ollama/i,
  /mistral/i, /cohere/i, /replicate/i, /deepgram/i, /assemblyai/i, /azure/i, /aws-sdk/i, /@aws-sdk/i,
  /analytics/i, /sentry/i, /mixpanel/i, /amplitude/i, /posthog/i, /firebase/i, /supabase/i, /speech-to-text/i,
  /web-llm/i, /llama/i, /gpt/i,
];

// Адреса, которых не должно быть в исполняемом коде приложения.
// appassets.androidplatform.net — внутренний адрес WebView в APK: запросы к нему перехватывает
// сама оболочка и отдаёт файлы из APK, в сеть они не уходят.
const URL_RE = /https?:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org|appassets\.androidplatform\.net)[a-z0-9.-]+\.[a-z]{2,}/gi;
const CODE_DIRS = ["app", "components", "lib", "engine", "public/worklets", "public/workers", "android/app/src"];
const ALLOW_URL_FILES = [/\.test\.ts$/, /\.md$/];

let problems = 0;
const report = (m: string) => {
  problems++;
  console.error("✗", m);
};

const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
for (const name of Object.keys(pkg.dependencies ?? {})) {
  if (FORBIDDEN_PACKAGES.some((re) => re.test(name))) report(`запрещённая зависимость: ${name}`);
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "node_modules" || n === "fixtures") return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

for (const dir of CODE_DIRS) {
  for (const file of walk(dir)) {
    if (!/\.(ts|tsx|js|mjs|json|java)$/.test(file) || ALLOW_URL_FILES.some((re) => re.test(file))) continue;
    const text = readFileSync(file, "utf8");
    for (const m of text.matchAll(URL_RE)) report(`${file}: внешний адрес ${m[0]}`);
    if (/\bfetch\(\s*["'`]https?:/.test(text)) report(`${file}: сетевой запрос`);
    if (/new\s+WebSocket\(|EventSource\(|navigator\.sendBeacon/.test(text)) report(`${file}: сетевой канал`);
  }
}

// Голос устройства — только локальный (облачные голоса браузера отфильтрованы).
const speakerSrc = readFileSync("lib/audio/speaker.ts", "utf8");
if (!/localService/.test(speakerSrc)) report("lib/audio/speaker.ts: голос устройства без фильтра localService");

if (problems) {
  console.error(`\nНарушений: ${problems}`);
  process.exit(1);
}
console.log("✓ внешних ИИ, облачных сервисов и сетевых адресов в коде нет");
