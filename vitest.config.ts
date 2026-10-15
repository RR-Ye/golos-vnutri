import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)) } },
  test: {
    include: ["engine/**/*.test.ts", "lib/**/*.test.ts", "scripts/**/*.test.ts"],
    environment: "node",
  },
});
