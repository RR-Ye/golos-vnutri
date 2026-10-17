// Локальный синтез речи (Piper): фонемы — espeak-ng в WASM, звук — модель ONNX в onnxruntime-web.
// Всё работает в браузере без сети; файлы берутся из кэша service worker.
/* global ort, createPiperPhonemize */
importScripts("/ort/ort.wasm.min.js", "/piper/piper_phonemize.js");

ort.env.wasm.wasmPaths = "/ort/";
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
  wasmModule ??= await WebAssembly.compile(await (await fetch("/piper/piper_phonemize.wasm")).arrayBuffer());
  dataBuffer ??= await (await fetch("/piper/piper_phonemize.data")).arrayBuffer();
}

async function phonemeIds(text, espeakVoice, fresh) {
  const key = espeakVoice + "|" + text;
  const hit = !fresh && phonemeCache.get(key);
  if (hit) return hit;
  await assets();
  let result = null;
  const m = await createPiperPhonemize({
    print: (line) => {
      result = JSON.parse(line).phoneme_ids;
    },
    printErr: () => {},
    locateFile: (url) => "/piper/" + url.split("/").pop(),
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

async function synthesize(lang, text, fresh) {
  const v = await voice(lang);
  const t0 = performance.now();
  let stage = "phonemize";
  try {
    const ids = await phonemeIds(text, v.config.espeak.voice, fresh);
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
      const k = Math.min(0.9 / peak, 10);
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
  if (data.type === "cancel") {
    for (const id of data.ids) cancelled.add(id);
    return;
  }
  if (data.type === "speak") {
    chain = chain.then(() =>
      cancelled.delete(data.id)
        ? self.postMessage({ id: data.id, error: "cancelled" })
        : synthesize(data.lang, data.text, data.fresh)
        .then((r) => self.postMessage({ id: data.id, ...r }, [r.pcm.buffer]))
        .catch((e) => self.postMessage({ id: data.id, error: String(e && e.message ? e.message : e) })),
    );
  }
};
