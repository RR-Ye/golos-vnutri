// Готовит файлы локального синтеза в public/: onnxruntime-web (только WASM) и фонемизатор
// espeak-ng, урезанный до русского и казахского (вместо 18 МБ данных на все языки).
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const ORT = "node_modules/onnxruntime-web/dist";
const PW = "node_modules/@diffusionstudio/piper-wasm/build";
mkdirSync("public/ort", { recursive: true });
mkdirSync("public/piper", { recursive: true });

for (const f of ["ort.wasm.min.js", "ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) copyFileSync(`${ORT}/${f}`, `public/ort/${f}`);

const KEEP = new Set([
  "/espeak-ng-data/intonations",
  "/espeak-ng-data/phondata",
  "/espeak-ng-data/phondata-manifest",
  "/espeak-ng-data/phonindex",
  "/espeak-ng-data/phontab",
  "/espeak-ng-data/ru_dict",
  "/espeak-ng-data/kk_dict",
  "/espeak-ng-data/lang/zle/ru",
  "/espeak-ng-data/lang/trk/kk",
]);

const js = readFileSync(`${PW}/piper_phonemize.js`, "utf8");
const data = readFileSync(`${PW}/piper_phonemize.data`);
const m = js.match(/loadPackage\((\{"files":.*?"remote_package_size":\d+\})\)/);
if (!m) throw new Error("не нашла описание пакета данных в piper_phonemize.js");
const meta = JSON.parse(m[1]!) as { files: { filename: string; start: number; end: number }[]; remote_package_size: number };
const parts: Buffer[] = [];
const files: { filename: string; start: number; end: number }[] = [];
let offset = 0;
for (const f of meta.files) {
  if (!KEEP.has(f.filename)) continue;
  const chunk = data.subarray(f.start, f.end);
  parts.push(chunk);
  files.push({ filename: f.filename, start: offset, end: offset + chunk.length });
  offset += chunk.length;
}
if (files.length !== KEEP.size) throw new Error(`нашлось ${files.length} файлов из ${KEEP.size}`);
const newMeta = JSON.stringify({ ...meta, files, remote_package_size: offset });
writeFileSync("public/piper/piper_phonemize.js", js.replace(m[1]!, newMeta));
writeFileSync("public/piper/piper_phonemize.data", Buffer.concat(parts));
copyFileSync(`${PW}/piper_phonemize.wasm`, "public/piper/piper_phonemize.wasm");
console.log(`фонемизатор: ${files.length} файлов, ${(offset / 1e6).toFixed(1)} МБ вместо ${(data.length / 1e6).toFixed(1)} МБ`);
