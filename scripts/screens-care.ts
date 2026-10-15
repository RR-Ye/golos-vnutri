// Скриншоты разделов для близких после пары разговоров.
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const prefix = process.argv[2] ?? "p5";
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
const page = await (await browser.newContext({ viewport: { width: 1180, height: 820 } })).newPage();
await page.goto(BASE + "/");
await page.getByTestId("setup-pin").fill("1234");
await page.getByTestId("setup-pin2").fill("1234");
await page.getByTestId("setup-demo").click();
await page.getByTestId("btn-start").waitFor();
await tap(page, "btn-start");
// 1: составное сообщение
await tap(page, "topic-feelings");
await tap(page, "frame-feel.sad");
await tap(page, "btn-yes");
await page.waitForTimeout(4800);
await tap(page, "btn-yes");
await tap(page, "conn-because");
await tap(page, "topic-people");
await tap(page, "entity-p.aliya");
await tap(page, "frame-feel.miss");
await tap(page, "btn-yes");
await tap(page, "btn-restart");
// 2: боль с вопросом
await tap(page, "topic-health");
await tap(page, "tile-body");
await tap(page, "zone-body.head");
await tap(page, "face-4");
for (let i = 0; i < 4 && (await page.locator(".patient-root").getAttribute("data-screen")) === "question"; i++) await tap(page, "btn-yes");
await tap(page, "btn-yes");
await tap(page, "btn-restart");

await page.goto(BASE + "/care/?s=history");
await page.waitForTimeout(500);
await page.getByRole("radio", { name: "сама" }).first().click();
await page.getByRole("button", { name: "Почему так" }).first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: out("history"), fullPage: true });
await page.goto(BASE + "/care/?s=progress");
await page.waitForTimeout(500);
await page.screenshot({ path: out("progress"), fullPage: true });
await page.goto(BASE + "/care/?s=phrases");
await page.waitForTimeout(800);
await page.screenshot({ path: out("phrases"), clip: { x: 0, y: 0, width: 1180, height: 1400 }, fullPage: true });
await page.goto(BASE + "/care/?s=backup");
await page.waitForTimeout(500);
await page.screenshot({ path: out("backup") });
await browser.close();
console.log("готово");
