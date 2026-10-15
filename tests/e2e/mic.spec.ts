import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { screenKind, setupDemo, tap } from "./helpers";

// Вместо микрофона Chromium читает WAV по кругу: «су», потом тишина.
const SU = fileURLToPath(new URL("./fixtures/su.wav", import.meta.url));

test.use({
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${SU}`],
  },
  permissions: ["microphone"],
});

test("её слово «су»: образцы у близких → «Сказать» у бабушки → догадка «пить»", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "достаточно одного вьюпорта");
  await setupDemo(page);
  await page.goto("/care/?s=words");
  await page.getByText("су", { exact: true }).first().click();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Записать" }).last().click();
    await page.waitForTimeout(2300);
    await page.getByRole("button", { name: "Стоп" }).click();
    await page.waitForTimeout(400);
  }
  await expect(page.getByText("Записей: 3 из 10")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: "screenshots/p4-word-samples.png", fullPage: true });

  await page.goto("/care/?s=recognition");
  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(page.getByTestId("loo-result")).toBeVisible();
  if (process.env.SHOTS) await page.screenshot({ path: "screenshots/p4-recognition.png", fullPage: true });

  await page.goto("/");
  await tap(page, "btn-start");
  await tap(page, "btn-say");
  await expect(page.getByTestId("btn-say")).toHaveAccessibleName("Сказать", { timeout: 15_000 });
  await page.waitForTimeout(500);
  if (process.env.SHOTS) await page.screenshot({ path: "screenshots/p4-after-say.png" });
  const kind = await screenKind(page);
  expect(["confirm", "question", "didYouSay"]).toContain(kind);
  const attempts = await page.evaluate(async () => {
    const req = indexedDB.open("golos-vnutri");
    const dbh: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    return new Promise<{ wordId: string | null }[]>((r) => {
      const all = dbh.transaction("attempts").objectStore("attempts").getAll();
      all.onsuccess = () => r(all.result);
    });
  });
  expect(attempts.some((a) => a.wordId === "w.su")).toBe(true);
});
