import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:3100", trace: "off", serviceWorkers: "block" },
  webServer: {
    command: "npx http-server out -p 3100 -c-1 -s",
    url: "http://localhost:3100",
    reuseExistingServer: true,
  },
  projects: [
    { name: "планшет-альбом", use: { viewport: { width: 1180, height: 820 }, hasTouch: true } },
    { name: "планшет-портрет", use: { viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: "телефон", use: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true } },
  ],
});
