import { expect, test } from "@playwright/test";
import { setupDemo, spoken, tap, tapFind } from "./helpers";

const MODES = [
  { mode: "ru", label: "Только русский", expected: ["Алия"] },
  { mode: "ru-kk", label: "Русский, затем казахский", expected: ["Алия", "Әлия"] },
  { mode: "kk-ru", label: "Казахский, затем русский", expected: ["Әлия", "Алия"] },
  { mode: "kk", label: "Только казахский", expected: ["Әлия"] },
] as const;

test("режимы звучания: плитка человека звучит в выбранном порядке языков", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await setupDemo(page);
  // Демо-люди помечены «для развития» (всегда двуязычно) — снимаем отметку у Алии, чтобы проверить режим категории.
  await page.goto("/care/?s=people");
  await page.getByText("Алия").first().click();
  await page.getByLabel("Слово для развития").uncheck();
  await page.getByRole("button", { name: "Сохранить" }).click();
  await page.getByRole("button", { name: "Добавить" }).waitFor(); // карточка закрылась — сохранено

  for (const m of MODES) {
    await page.goto("/care/?s=languages");
    await page.getByLabel("Люди и семья").selectOption(m.mode);
    await expect(page.getByLabel("Люди и семья")).toHaveValue(m.mode);
    await page.waitForTimeout(200);
    await page.goto("/");
    await tap(page, "btn-start");
    await page.evaluate(() => (window.__golosSpoken = []));
    await tapFind(page, "topic-people");
    await page.evaluate(() => (window.__golosSpoken = []));
    await tapFind(page, "entity-p.aliya");
    const said = (await spoken(page)).map((s) => s.text).filter((t) => t === "Алия" || t === "Әлия");
    expect(said.slice(0, m.expected.length), m.label).toEqual([...m.expected]);
  }
});

test("слово для развития всегда звучит на двух языках", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await setupDemo(page);
  await page.goto("/care/?s=languages");
  await page.getByLabel("Люди и семья").selectOption("ru");
  await expect(page.getByLabel("Люди и семья")).toHaveValue("ru");
  await page.waitForTimeout(200);
  await page.goto("/");
  await tap(page, "btn-start");
  await tapFind(page, "topic-people");
  await page.evaluate(() => (window.__golosSpoken = []));
  await tapFind(page, "entity-p.erlan");
  const said = (await spoken(page)).map((s) => s.lang);
  expect(said.slice(0, 2)).toEqual(["ru", "kk"]);
});
