import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { setupDemo, tap, tapFind } from "./helpers";

async function audit(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  const issues = r.violations.map((v) => `${where}: ${v.id} — ${v.help} (${v.nodes.length}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("; ")}`);
  expect(issues).toEqual([]);
}

test("доступность: экраны бабушки и близких (WCAG 2.1 AA)", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await page.goto("/");
  await audit(page, "первый запуск");
  await setupDemo(page);
  await audit(page, "старт");
  await tap(page, "btn-start");
  await audit(page, "главный");
  await tapFind(page, "topic-health");
  await tapFind(page, "tile-body");
  await audit(page, "тело");
  await tap(page, "zone-body.head");
  await audit(page, "сила боли");
  await tap(page, "face-5");
  await audit(page, "после силы");
  await tap(page, "btn-restart");
  await tapFind(page, "topic-needs");
  await tapFind(page, "frame-need.drink");
  await audit(page, "Так?");
  await tap(page, "btn-yes");
  await audit(page, "итоговая фраза");
  for (const s of ["people", "words", "languages", "buttons", "routine", "notes", "general", "history", "progress", "phrases", "recognition", "backup"]) {
    await page.goto(`/care/?s=${s}`);
    await page.waitForTimeout(300);
    await audit(page, `близкие: ${s}`);
  }
  await page.goto("/practice/");
  await tap(page, "practice-start");
  await audit(page, "развитие речи");
});

test("доступность: тёмная тема у близких", async ({ page }) => {
  test.skip(test.info().project.name !== "планшет-альбом", "один вьюпорт достаточно");
  await page.emulateMedia({ colorScheme: "dark" });
  await setupDemo(page);
  for (const s of ["people", "words", "general", "history", "phrases", "backup"]) {
    await page.goto(`/care/?s=${s}`);
    await page.waitForTimeout(300);
    await audit(page, `тёмная: ${s}`);
  }
  if (process.env.SHOTS) {
    await page.goto("/care/?s=words");
    await page.screenshot({ path: "screenshots/p7-care-dark.png" });
  }
});
