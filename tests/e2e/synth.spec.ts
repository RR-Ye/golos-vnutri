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
