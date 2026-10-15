// После `next build` собирает список всех файлов из out/ и пишет out/sw.js.
// Оболочка приложения и голоса кэшируются при установке в разные кэши:
// голоса большие и меняются редко, их не нужно скачивать заново при каждом обновлении кода.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const OUT = "out";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(OUT)
  .map((p) => "/" + relative(OUT, p).split(sep).join("/"))
  .filter((u) => u !== "/sw.js" && u !== "/precache.json" && !u.endsWith(".txt") && !u.endsWith(".map"));

const toKey = (u: string) => (u.endsWith("/index.html") ? u.slice(0, -"index.html".length) : u);

const shell = files.filter((u) => !u.startsWith("/voices/")).map(toKey);
const voices = files.filter((u) => u.startsWith("/voices/"));

const hashOf = (list: string[]) => {
  const h = createHash("sha256");
  for (const u of list) {
    h.update(u);
    h.update(readFileSync(join(OUT, u.endsWith("/") ? u + "index.html" : u)));
  }
  return h.digest("hex").slice(0, 12);
};

const shellVersion = hashOf(shell);
const voicesVersion = hashOf(voices);

const sw = `// Сгенерировано scripts/gen-precache.ts. Не редактировать вручную.
const SHELL = "golos-shell-${shellVersion}";
const VOICES = "golos-voices-${voicesVersion}";
const SHELL_FILES = ${JSON.stringify(shell)};
const VOICE_FILES = ${JSON.stringify(voices)};

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const shell = await caches.open(SHELL);
      await shell.addAll(SHELL_FILES);
      const voices = await caches.open(VOICES);
      for (const url of VOICE_FILES) {
        if (!(await voices.match(url))) await voices.add(url);
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== SHELL && key !== VOICES) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

function cacheKey(url) {
  let path = url.pathname;
  if (!path.includes(".") && !path.endsWith("/")) path += "/";
  return path;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(
    (async () => {
      const key = cacheKey(url);
      const hit = (await caches.match(key)) || (req.mode === "navigate" ? await caches.match("/") : undefined);
      if (hit) return hit;
      return fetch(req);
    })(),
  );
});
`;

writeFileSync(join(OUT, "sw.js"), sw);
writeFileSync(
  join(OUT, "precache.json"),
  JSON.stringify({ shell: `golos-shell-${shellVersion}`, voices: `golos-voices-${voicesVersion}`, files: [...shell, ...voices] }),
);
console.log(`sw.js: оболочка ${shell.length} файлов, голоса ${voices.length}`);
