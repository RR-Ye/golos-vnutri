// Скриншоты для отчёта по фазе: node --experimental-strip-types scripts/screens.ts <фаза>
import { chromium, type Page } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const phase = process.argv[2] ?? "p";
const out = (name: string) => `screenshots/${phase}-${name}.png`;

async function tap(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`нет элемента ${testId}`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.up();
  await page.waitForTimeout(850);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(BASE + "/");
await page.screenshot({ path: out("01-setup") });
await page.getByTestId("setup-pin").fill("1234");
await page.getByTestId("setup-pin2").fill("1234");
await page.getByTestId("setup-demo").click();
await page.waitForURL(BASE + "/");
await page.getByTestId("btn-start").waitFor();
await page.screenshot({ path: out("02-start") });
await tap(page, "btn-start");
await page.screenshot({ path: out("03-home-landscape") });

await page.setViewportSize({ width: 820, height: 1180 });
await page.waitForTimeout(300);
await page.screenshot({ path: out("04-home-portrait") });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(300);
await page.screenshot({ path: out("05-home-phone") });

await page.setViewportSize({ width: 1180, height: 820 });
for (const s of ["people", "words", "languages", "buttons", "routine", "notes", "general"]) {
  await page.goto(`${BASE}/care/?s=${s}`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: out(`care-${s}`), fullPage: true });
}
await page.goto(`${BASE}/care/?s=people`);
await page.getByText("Алия").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out("care-person-edit"), fullPage: true });
await page.goto(`${BASE}/care/?s=words`);
await page.getByText("сен").first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: out("care-word-edit"), fullPage: true });

console.log(errors.length ? "ОШИБКИ:\n" + errors.join("\n") : "без ошибок в консоли");
await browser.close();
