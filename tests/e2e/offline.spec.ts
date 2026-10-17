import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { screenKind, tap, tapFind } from "./helpers";

// Голоса синтеза скачиваются отдельно (`npm run voices`); без них проверяется только остальное.
const withVoices = existsSync("out/voices/manifest.json");

// Здесь service worker нужен: включаем его вопреки общей настройке.
test.use({ serviceWorkers: "allow" });

test("после первой загрузки работает без интернета и не делает ни одного сетевого запроса", async ({ page, context }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "достаточно одного вьюпорта");
  const external: string[] = [];
  page.on("request", (r) => {
    const u = new URL(r.url());
    if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) external.push(r.url());
  });

  // Первая загрузка: service worker ставится и кладёт в кэш все файлы.
  await page.goto("/");
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    if (!reg.active) throw new Error("service worker не активен");
  });
  await page.waitForFunction(async () => {
    const list = (await (await fetch("/precache.json")).json()) as { shell: string; voices: string; files: string[] };
    const keys = (await (await caches.open(list.shell)).keys()).length + (await (await caches.open(list.voices)).keys()).length;
    return keys >= list.files.length;
  }, undefined, { timeout: 60_000 });

  // Дальше — без сети.
  await context.setOffline(true);
  const network: string[] = [];
  const failed: string[] = [];
  let fromSw = 0;
  page.on("requestfinished", async (r) => {
    const resp = await r.response();
    if (!resp || !r.url().startsWith("http")) return;
    if (resp.fromServiceWorker()) fromSw++;
    else network.push(r.url());
  });
  // Обрыв загрузки при переходе на другую страницу — не сетевая ошибка.
  page.on("requestfailed", (r) => {
    if (r.failure()?.errorText !== "net::ERR_ABORTED") failed.push(`${r.url()} ${r.failure()?.errorText}`);
  });

  await page.reload();
  await page.getByTestId("setup-pin").fill("1234");
  await page.getByTestId("setup-pin2").fill("1234");
  await page.getByTestId("setup-demo").click();
  await page.getByTestId("btn-start").waitFor();
  // Голос синтеза загружается из кэша без сети.
  if (withVoices) await page.waitForFunction(() => window.__golosSynth === "ready", undefined, { timeout: 30_000 });
  await tap(page, "btn-start");
  await tapFind(page, "topic-people");
  await tapFind(page, "entity-p.aliya");
  await tapFind(page, "frame-people.call");
  await tap(page, "btn-yes");
  expect(await screenKind(page)).toBe("final");
  await expect(page.getByTestId("final-text")).toHaveText("Позвони Алии, пожалуйста.");
  if (withVoices) {
    await page.waitForFunction(
      () => (window.__golosSpoken ?? []).some((e) => e.text === "Позвони Алии, пожалуйста." && e.source === "synth"),
      undefined,
      { timeout: 20_000 },
    );
  }
  await page.goto("/care/?s=people");
  await expect(page.getByText("Алия").first()).toBeVisible();
  await page.goto("/care/?s=general");
  await expect(page.getByTestId("offline-status")).toHaveText("Готово к работе без интернета");
  await page.goto("/practice/");
  await expect(page.getByTestId("practice-start")).toBeVisible();

  expect(fromSw, "service worker отдал файлы").toBeGreaterThan(10);
  expect(failed, "запросы, которые не удалось выполнить без сети").toEqual([]);
  expect(network, "запросы мимо service worker").toEqual([]);
  expect(external, "запросы на чужие адреса").toEqual([]);
});
