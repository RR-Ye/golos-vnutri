// Рендерит PNG-иконки приложения из public/app-icon.svg через локальный Chromium.
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const svg = readFileSync("public/app-icon.svg", "utf8");
const browser = await chromium.launch();
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: `public/app-icon-${size}.png`, omitBackground: true });
  await page.close();
}
await browser.close();
console.log("готово");
