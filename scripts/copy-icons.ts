// Копирует нужные иконки OpenMoji из node_modules в public/icons/<id>.svg.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const map = JSON.parse(readFileSync("engine/data/icons.json", "utf8")) as Record<string, string>;
mkdirSync("public/icons", { recursive: true });
let n = 0;
for (const [id, code] of Object.entries(map)) {
  if (id.startsWith("$")) continue;
  copyFileSync(`node_modules/openmoji/color/svg/${code}.svg`, `public/icons/${id}.svg`);
  n++;
}
console.log(`скопировано иконок: ${n}`);
