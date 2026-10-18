// Проверка собранного сайта по любому адресу: первый запуск, голос синтеза, затем без сети.
// node --experimental-strip-types scripts/smoke.ts http://localhost:3200/golos-vnutri
import { chromium } from "@playwright/test";
const ROOT = process.argv[2]!; // например http://localhost:3200/golos-vnutri
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
const p = await ctx.newPage();
const bad: string[] = [];
p.on("response", (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
p.on("pageerror", (e) => bad.push("pageerror " + e.message));
await p.goto(ROOT + "/");
await p.evaluate(async () => { await navigator.serviceWorker.ready; });
await p.waitForFunction(async (root) => {
  const list = await (await fetch(root + "/precache.json")).json();
  const n = (await (await caches.open(list.shell)).keys()).length + (await (await caches.open(list.voices)).keys()).length;
  return n >= list.files.length;
}, ROOT.replace(/^https?:\/\/[^/]+/, ""), { timeout: 90_000 });
await ctx.setOffline(true);
await p.reload();
await p.getByTestId("setup-pin").fill("1234");
await p.getByTestId("setup-pin2").fill("1234");
await p.getByTestId("setup-demo").click();
await p.getByTestId("btn-start").waitFor();
await p.waitForFunction(() => (window as any).__golosSynth === "ready", undefined, { timeout: 30_000 });
const tap = async (id: string) => { const el = p.getByTestId(id).first(); await el.waitFor(); const bx = (await el.boundingBox())!; await p.mouse.move(bx.x + bx.width / 2, bx.y + bx.height / 2); await p.mouse.down(); await p.waitForTimeout(120); await p.mouse.up(); await p.waitForTimeout(900); };
await tap("btn-start");
await tap("topic-people");
await tap("entity-p.aliya");
await tap("frame-people.call");
await tap("btn-yes");
await p.waitForFunction(() => ((window as any).__golosSpoken ?? []).some((e: any) => e.text === "Позвони Алии, пожалуйста." && e.source === "synth"), undefined, { timeout: 20_000 });
console.log("фраза:", await p.getByTestId("final-text").textContent());
const icons = await p.evaluate(() => [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.src));
await p.goto(ROOT + "/care/?s=general");
console.log("статус:", await p.getByTestId("offline-status").textContent());
console.log("иконки без картинки:", icons.length, "ошибки:", bad.length ? bad.slice(0, 5) : "нет");
await b.close();
