import { expect, test } from "@playwright/test";
import { setupDemo, tap } from "./helpers";

test("развитие речи: карточка, отметка «сама», ступень подсказки растёт, результат в прогрессе", async ({ page }) => {
  test.skip(test.info().project.name === "телефон", "занятие проверяем на планшете");
  await setupDemo(page);
  await page.goto("/practice/");
  await tap(page, "practice-start");
  await expect(page.getByTestId("practice-card")).toBeVisible();
  await expect(page.getByTestId("practice-level")).toContainText("полное слово");
  const first = await page.getByTestId("practice-card").locator("p").first().textContent();
  if (process.env.SHOTS) await page.screenshot({ path: "screenshots/p6-practice.png" });

  // отмечаем «сама», пока снова не попадётся та же карточка — у неё подсказка станет меньше
  await page.getByTestId("practice-self").click();
  const spoken = await page.evaluate(() => window.__golosSpoken?.length ?? 0);
  expect(spoken).toBeGreaterThan(0);
  const states = await page.evaluate(async () => {
    const req = indexedDB.open("golos-vnutri");
    const dbh: IDBDatabase = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    return new Promise<{ key: string; level: number }[]>((r) => {
      const all = dbh.transaction("practice").objectStore("practice").getAll();
      all.onsuccess = () => r(all.result);
    });
  });
  expect(states).toHaveLength(1);
  expect(states[0]!.level).toBe(1);
  expect(first).toBeTruthy();

  await page.goto("/care/?s=progress");
  await expect(page.getByText("раз: 1").first()).toBeVisible();
});
