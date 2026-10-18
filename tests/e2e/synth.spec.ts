import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { setupDemo, tap, tapFind } from "./helpers";

// Нужны голоса: `npm run voices`, затем `npm run build`.
test.skip(!existsSync("out/voices/manifest.json"), "голоса синтеза не скачаны");

test("фраза звучит локальным синтезом и сохраняется на устройстве", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await setupDemo(page);
  await page.waitForFunction(() => window.__golosSynth === "ready", undefined, { timeout: 30_000 });
  await tap(page, "btn-start");
  await tapFind(page, "topic-needs");
  await tapFind(page, "frame-need.toilet");
  await tap(page, "btn-yes");
  await page.waitForFunction(
    () => (window.__golosSpoken ?? []).some((e) => e.text === "Мне нужно в туалет." && e.source === "synth"),
    undefined,
    { timeout: 20_000 },
  );
  const stored = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open("golos-speech-cache");
        req.onsuccess = () => {
          const count = req.result.transaction("clips").objectStore("clips").count();
          count.onsuccess = () => resolve(count.result);
        };
      }),
  );
  expect(stored).toBeGreaterThan(0);
});

test("проверка голоса показывает скорость на этом устройстве", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await setupDemo(page);
  await page.goto("/care/?s=general");
  await page.getByRole("button", { name: "Проверить голос" }).click();
  await expect(page.getByTestId("voice-ru")).toContainText("готов через", { timeout: 60_000 });
  await expect(page.getByTestId("voice-kk")).toContainText("следующая");
});

test("ударения в именах: русское через «ё», казахское переносом знака", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await page.goto("/");
  const ipa = await page.evaluate(async () => {
    const res = await fetch("/voices/manifest.json");
    const voices = await res.json();
    // Пути в манифесте — относительно него самого, как их разворачивает PiperBackend.
    for (const v of Object.values(voices) as { model: string; config: string }[]) {
      v.model = new URL(v.model, res.url).pathname;
      v.config = new URL(v.config, res.url).pathname;
    }
    const w = new Worker("/workers/tts-worker.js");
    let n = 0;
    const call = (msg: object) =>
      new Promise<{ ipa?: string; error?: string }>((resolve) => {
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
    const get = async (lang: string, text: string, fixes?: object[]) => (await call({ type: "ipa", lang, text, fixes })).ipa;
    return {
      // Где espeak и так прав, правка на ту же гласную ничего не меняет.
      same: [await get("ru", "Махамбета"), await get("ru", "Махамбет", [{ word: "Махамбет", vowel: 3, total: 3 }])],
      same2: [await get("ru", "голова"), await get("ru", "голова", [{ word: "голова", vowel: 3, total: 3 }])],
      asel: await get("ru", "Асель", [{ word: "Асель", vowel: 2, total: 2 }]),
      aldiyar: await get("ru", "Когда придёт Алдияр?", [{ word: "Алдияр", vowel: 3, total: 3 }]),
      kk: await get("kk", "Рақмет, Ариянна!", [{ word: "Ариянна", vowel: 3, total: 4 }]),
    };
  });
  expect(ipa.same[1]).toBe("mʌxamʲbʲˈet");
  expect(ipa.same2[0]).toBe(ipa.same2[1]);
  expect(ipa.asel).toBe("asʲˈeɭ");
  expect(ipa.aldiyar).toContain("aɭdʲijˈar?");
  expect(ipa.kk).toContain("ɑɾəjjˈannɑ!");
});

test("ударение в карточке: нажать гласную и послушать", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await setupDemo(page);
  await page.goto("/care/?s=people");
  await page.getByRole("button", { name: "Добавить" }).click();
  await page.getByLabel("По-русски").fill("Алдияр");
  await page.getByLabel("По-казахски").fill("Алдияр");
  await page.getByText("Формы слова").click();
  await page.getByRole("radio", { name: "мужской" }).click();
  const picker = page.getByTestId("stress-picker");
  // По встроенному словарю ударение уже на «я».
  await expect(picker.getByRole("button", { name: "я, слог 3" }).first()).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "и, слог 2" }).first().click();
  await expect(picker.getByRole("button", { name: "и, слог 2" }).first()).toHaveAttribute("aria-pressed", "true");
  await picker.getByRole("button", { name: "Послушать" }).first().click();
  await page.waitForFunction(
    () => (window.__golosSpoken ?? []).some((e) => e.text === "Позвони Алдияру, пожалуйста." && e.source === "synth"),
    undefined,
    { timeout: 30_000 },
  );
});
