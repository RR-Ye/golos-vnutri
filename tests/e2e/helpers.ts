import { expect, type Page } from "@playwright/test";

/** Нажатие как у бабушки: палец на кнопке ~120 мс, потом пауза больше 800 мс. */
export async function tap(page: Page, testId: string): Promise<void> {
  const el = page.getByTestId(testId).first();
  await el.waitFor({ state: "visible" });
  const box = await el.boundingBox();
  if (!box) throw new Error(`нет элемента ${testId}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(850);
}

/** Первый запуск с демо-данными. */
export async function setupDemo(page: Page): Promise<void> {
  await page.goto("/");
  await page.getByTestId("setup-pin").fill("1234");
  await page.getByTestId("setup-pin2").fill("1234");
  await page.getByTestId("setup-demo").click();
  await page.getByTestId("btn-start").waitFor();
}

/** Сколько раз что-то прозвучало (журнал очереди озвучки). */
export async function spoken(page: Page): Promise<{ lang: string; text: string }[]> {
  return page.evaluate(() => (window.__golosSpoken ?? []).map((e) => ({ lang: e.lang, text: e.text })));
}

export async function screenKind(page: Page): Promise<string | null> {
  return page.locator(".patient-root").getAttribute("data-screen");
}

export async function expectNoScroll(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({
    sh: document.documentElement.scrollHeight,
    ih: window.innerHeight,
    sw: document.documentElement.scrollWidth,
    iw: window.innerWidth,
  }));
  expect(r.sh).toBeLessThanOrEqual(r.ih);
  expect(r.sw).toBeLessThanOrEqual(r.iw);
}

/** Найти плитку, листая «Ещё», и нажать её. */
export async function tapFind(page: Page, testId: string, maxPages = 8): Promise<void> {
  for (let i = 0; i < maxPages; i++) {
    if (await page.getByTestId(testId).first().isVisible()) return tap(page, testId);
    await tap(page, "btn-more");
  }
  throw new Error(`не нашла ${testId} за ${maxPages} страниц`);
}
