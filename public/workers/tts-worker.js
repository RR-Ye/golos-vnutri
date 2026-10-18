// Локальный синтез речи (Piper): фонемы — espeak-ng в WASM, звук — модель ONNX в onnxruntime-web.
// Всё работает в браузере без сети; файлы берутся из кэша service worker.
/* global ort, createPiperPhonemize */
// Приложение может жить не в корне сайта (GitHub Pages, APK): префикс берётся из адреса воркера.
const BASE = self.location.pathname.replace(/\/workers\/tts-worker\.js$/, "");
importScripts(BASE + "/ort/ort.wasm.min.js", BASE + "/piper/piper_phonemize.js");

ort.env.wasm.wasmPaths = BASE + "/ort/";
// Потоки требуют изоляции страницы (COOP/COEP), которой на обычном хостинге нет.
ort.env.wasm.numThreads = 1;

// Сборка espeak-ng в WASM при каждом вызове заново читает словарь и не освобождает память
// (куча фиксирована, 16 МБ): русский словарь кончает её на третьем вызове. Поэтому WASM
// компилируется один раз, данные хранятся в памяти, а на каждый вызов создаётся свежий
// экземпляр модуля. Плюс кэш: одни и те же фразы звучат часто.
let wasmModule = null;
let dataBuffer = null;
const phonemeCache = new Map();

const voices = new Map(); // язык -> Promise<{ session, config, speaker, lengthScale }>
let specs = {};

async function assets() {
  wasmModule ??= await WebAssembly.compile(await (await fetch(BASE + "/piper/piper_phonemize.wasm")).arrayBuffer());
  dataBuffer ??= await (await fetch(BASE + "/piper/piper_phonemize.data")).arrayBuffer();
}

/** Фонемы espeak-ng: { ids — номера для модели, phonemes — те же фонемы символами МФА }. */
async function phonemize(text, espeakVoice, fresh) {
  const key = espeakVoice + "|" + text;
  const hit = !fresh && phonemeCache.get(key);
  if (hit) return hit;
  await assets();
  let result = null;
  const m = await createPiperPhonemize({
    print: (line) => {
      const r = JSON.parse(line);
      result = { ids: r.phoneme_ids, phonemes: r.phonemes };
    },
    printErr: () => {},
    locateFile: (url) => BASE + "/piper/" + url.split("/").pop(),
    instantiateWasm: (imports, done) => {
      WebAssembly.instantiate(wasmModule, imports).then((inst) => done(inst));
      return {};
    },
    getPreloadedPackage: () => dataBuffer,
  });
  m.callMain(["-l", espeakVoice, "--input", JSON.stringify([{ text }]), "--espeak_data", "/espeak-ng-data"]);
  if (!result) throw new Error("фонемизатор ничего не вернул");
  if (phonemeCache.size > 500) phonemeCache.delete(phonemeCache.keys().next().value);
  phonemeCache.set(key, result);
  return result;
}

// Ударения в именах (список слов готовит lib/audio/stress.ts).
// Русский: espeak всегда ударяет «ё», поэтому ударная гласная подменяется на «ё» — так
// безударные гласные вокруг редуцируются правильно, — а потом в фонемах «ё» меняется
// обратно на нужный звук. Казахский: качество гласных от ударения не зависит, знак
// ударения просто переносится на нужный слог.
const RU_VOWELS = "аеёиоуыэюя";
const IPA_VOWELS = new Set([..."aɑæeəɛɪiɨoɔɵuʊyʏœøɯɐʌ"]);
const RU_STRESSED = { а: "ɑ", я: "a", е: "e", э: "e", и: "i", ы: "ɨ", о: "o", у: "u", ю: "u", ё: "ɵ" };
const RU_HARD = "аоуыэ";
const RU_IOTATED = "яюеё";
const BOUNDARY = new Set([..." .,?!;:…—–-\"«»()"]);

async function ruStressed(word, k, espeakVoice) {
  const letters = [...word];
  let n = 0;
  let at = -1;
  for (let i = 0; i < letters.length; i++) {
    if (RU_VOWELS.includes(letters[i].toLowerCase()) && ++n === k) {
      at = i;
      break;
    }
  }
  if (at < 0) return null;
  const target = letters[at].toLowerCase();
  letters[at] = letters[at] === target ? "ё" : "Ё";
  const ipa = (await phonemize(letters.join(""), espeakVoice)).phonemes.join("");
  const s = ipa.indexOf("ˈ");
  if (s < 0 || ipa.indexOf("ˈ", s + 1) >= 0 || ipa[s + 1] !== "ɵ") return null;
  let before = ipa.slice(0, s);
  const after = ipa.slice(s + 2);
  if (RU_HARD.includes(target)) {
    // «ё» смягчила согласную или дала «й» — для твёрдой гласной это лишнее.
    if (before.endsWith("ʲ") && !/[ʃʒɕ]ʲ$/.test(before)) before = before.slice(0, -1);
    else if (before.endsWith("j")) before = before.slice(0, -1);
  } else if (RU_IOTATED.includes(target) && (before === "" || IPA_VOWELS.has(before.at(-1)))) {
    before += "j"; // Ари-я́-нна: после гласной «я» звучит с «й»
  }
  // Так пишет сам espeak: «а» после мягкой — a, ударная «и» в конце слова — ɪ (позвони́).
  const vowel = target === "а" && /[ʲj]$/.test(before) ? "a" : target === "и" && after === "" ? "ɪ" : RU_STRESSED[target];
  return before + "ˈ" + vowel + after;
}

async function kkStressed(word, k, total, espeakVoice) {
  const plain = (await phonemize(word, espeakVoice)).phonemes.filter((c) => c !== "ˈ");
  const nuclei = [];
  plain.forEach((c, i) => {
    if (IPA_VOWELS.has(c) && !IPA_VOWELS.has(plain[i - 1])) nuclei.push(i);
  });
  if (nuclei.length !== total) return null; // слоги не совпали с буквами — не трогаем
  plain.splice(nuclei[k - 1], 0, "ˈ");
  return plain.join("");
}

function findWord(ipa, token, from) {
  for (let i = ipa.indexOf(token, from); i >= 0; i = ipa.indexOf(token, i + 1)) {
    const end = i + token.length;
    if ((i === 0 || BOUNDARY.has(ipa[i - 1])) && (end === ipa.length || BOUNDARY.has(ipa[end]))) return i;
  }
  return -1;
}

/** Фонемы в номера для модели так же, как это делает piper: предложения в ^…$, между фонемами пауза _. */
function toIds(phonemes, map) {
  const pad = map["_"];
  const ids = [...map["^"], ...pad];
  phonemes.forEach((p, i) => {
    if (map[p]) ids.push(...map[p], ...pad);
    if (".?!".includes(p) && i < phonemes.length - 1) ids.push(...map["$"], ...map["^"], ...pad);
  });
  ids.push(...map["$"]);
  return ids;
}

const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

/** Фонемы фразы с исправленными ударениями. Если что-то не сходится — как сказал espeak. */
async function fixedPhonemes(lang, text, v, fixes, fresh) {
  const espeakVoice = v.config.espeak.voice;
  const base = await phonemize(text, espeakVoice, fresh);
  const map = v.config.phoneme_id_map;
  if (!fixes || !fixes.length || !sameIds(toIds(base.phonemes, map), base.ids)) return { ids: base.ids, ipa: base.phonemes.join("") };
  let ipa = base.phonemes.join("");
  let from = 0;
  for (const f of fixes) {
    const plain = (await phonemize(f.word, espeakVoice)).phonemes.join("");
    const at = findWord(ipa, plain, from);
    if (at < 0) continue;
    const fixed = lang === "ru" ? await ruStressed(f.word, f.vowel, espeakVoice) : await kkStressed(f.word, f.vowel, f.total, espeakVoice);
    const next = fixed ?? plain;
    ipa = ipa.slice(0, at) + next + ipa.slice(at + plain.length);
    from = at + next.length;
  }
  return { ids: toIds([...ipa], map), ipa };
}

function voice(lang) {
  if (!voices.has(lang)) {
    const spec = specs[lang];
    if (!spec) return Promise.reject(new Error(`нет голоса для ${lang}`));
    voices.set(
      lang,
      (async () => {
        const [session, config] = await Promise.all([
          ort.InferenceSession.create(spec.model, { executionProviders: ["wasm"] }),
          fetch(spec.config).then((r) => r.json()),
        ]);
        return { session, config, speaker: spec.speaker ?? 0, lengthScale: spec.lengthScale ?? 1 };
      })(),
    );
  }
  return voices.get(lang);
}

async function synthesize(lang, text, fixes, fresh) {
  const v = await voice(lang);
  const t0 = performance.now();
  let stage = "phonemize";
  try {
    const { ids } = await fixedPhonemes(lang, text, v, fixes, fresh);
    stage = "run";
    const inf = v.config.inference ?? {};
    const feeds = {
      input: new ort.Tensor("int64", BigInt64Array.from(ids.map((x) => BigInt(x))), [1, ids.length]),
      input_lengths: new ort.Tensor("int64", BigInt64Array.from([BigInt(ids.length)]), [1]),
      scales: new ort.Tensor(
        "float32",
        Float32Array.from([inf.noise_scale ?? 0.667, (inf.length_scale ?? 1) * v.lengthScale, inf.noise_w ?? 0.8]),
        [3],
      ),
    };
    if ((v.config.num_speakers ?? 1) > 1) feeds.sid = new ort.Tensor("int64", BigInt64Array.from([BigInt(v.speaker)]), [1]);
    const out = await v.session.run(feeds);
    const pcm = new Float32Array(out.output.data);
    // Голоса записаны с разной громкостью (raya втрое тише denis): выравниваем пик.
    let peak = 0;
    for (const x of pcm) peak = Math.max(peak, Math.abs(x));
    if (peak > 0) {
      const k = Math.min(0.9 / peak, 16);
      for (let i = 0; i < pcm.length; i++) pcm[i] *= k;
    }
    return { pcm, rate: v.config.audio.sample_rate, ms: performance.now() - t0 };
  } catch (e) {
    throw new Error(`${stage}: ${e && e.message ? e.message : e}`);
  }
}

// Очередь: фонемизатор однопоточный, запросы выполняются по одному. Отменённые
// (бабушка уже нажала дальше) пропускаются, чтобы не задерживать новую фразу.
let chain = Promise.resolve();
const cancelled = new Set();

self.onmessage = ({ data }) => {
  if (data.type === "init") {
    specs = data.voices || {};
    voices.clear();
    self.postMessage({ id: data.id, ok: true });
    return;
  }
  if (data.type === "warmup") {
    chain = chain.then(() =>
      assets()
        .then(() => Promise.all(Object.keys(specs).map((l) => voice(l))))
        .then(() => self.postMessage({ id: data.id, ok: true }))
        .catch((e) => self.postMessage({ id: data.id, error: String(e && e.message ? e.message : e) })),
    );
    return;
  }
  if (data.type === "ipa") {
    // Для проверки ударений: фонемы фразы символами МФА.
    chain = chain.then(() =>
      voice(data.lang)
        .then((v) => fixedPhonemes(data.lang, data.text, v, data.fixes))
        .then((r) => self.postMessage({ id: data.id, ipa: r.ipa }))
        .catch((e) => self.postMessage({ id: data.id, error: String(e && e.message ? e.message : e) })),
    );
    return;
  }
  if (data.type === "cancel") {
    for (const id of data.ids) cancelled.add(id);
    return;
  }
  if (data.type === "speak") {
    chain = chain.then(() =>
      cancelled.delete(data.id)
        ? self.postMessage({ id: data.id, error: "cancelled" })
        : synthesize(data.lang, data.text, data.fixes, data.fresh)
        .then((r) => self.postMessage({ id: data.id, ...r }, [r.pcm.buffer]))
        .catch((e) => self.postMessage({ id: data.id, error: String(e && e.message ? e.message : e) })),
    );
  }
};
