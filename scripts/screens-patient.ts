// Скриншоты экрана бабушки: node --experimental-strip-types scripts/screens-patient.ts <префикс> [ширина] [высота]
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prefix = process.argv[2] ?? "p3";
const W = Number(process.argv[3] ?? 1180);
const H = Number(process.argv[4] ?? 820);
const out = (n: string) => `screenshots/${prefix}-${n}.png`;

async function press(page: Page, id: string) {
  const box = await page.getByTestId(id).first().boundingBox();
  if (!box) throw new Error(`нет ${id}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(110);
  await page.mouse.up();
  await page.waitForTimeout(850);
}

async function tap(page: Page, id: string) {
  for (let i = 0; i < 6 && !(await page.getByTestId(id).first().isVisible()); i++) {
    if (!(await page.getByTestId("btn-more").first().isVisible())) break;
    await press(page, "btn-more");
  }
  await press(page, id);
}

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
await page.goto(BASE + "/");
await page.getByTestId("setup-pin").fill("1234");
await page.getByTestId("setup-pin2").fill("1234");
await page.getByTestId("setup-demo").click();
await page.getByTestId("btn-start").waitFor();
await tap(page, "btn-start");
await page.screenshot({ path: out("01-home") });
await tap(page, "topic-needs");
await page.screenshot({ path: out("02-needs") });
await tap(page, "frame-need.drink");
await page.screenshot({ path: out("03-confirm") });
await tap(page, "btn-yes");
await page.waitForTimeout(300);
await page.screenshot({ path: out("04-final") });
await tap(page, "btn-restart");
await tap(page, "topic-people");
await page.screenshot({ path: out("05-people") });
await tap(page, "entity-p.erlan");
await page.screenshot({ path: out("06-actions") });
await tap(page, "btn-restart");
await tap(page, "topic-health");
await tap(page, "tile-body");
await page.screenshot({ path: out("07-body") });
await tap(page, "zone-body.lowback").catch(async () => {
  await tap(page, "btn-flip");
  await tap(page, "zone-body.lowback");
});
await page.screenshot({ path: out("08-severity") });
await tap(page, "face-4");
await page.screenshot({ path: out("09-after-severity") });
await tap(page, "btn-restart");
await tap(page, "topic-feelings");
await tap(page, "tile-faces");
await page.screenshot({ path: out("10-faces") });
await tap(page, "face-4");
await page.screenshot({ path: out("11-question") });
await tap(page, "btn-help");
await page.screenshot({ path: out("12-help") });
await browser.close();
console.log("готово");
