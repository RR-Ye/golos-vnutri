"use client";

// Локальный синтез Piper в Web Worker. Подключается к очереди озвучки, если голоса установлены.
import type { Lang } from "@/engine/types";
import type { SynthBackend } from "./speaker";
import { loadClip, saveClip } from "./speechCache";

interface VoiceSpec {
  model: string;
  config: string;
  speaker: number;
  lengthScale: number;
  name: string;
}

interface Synthesized {
  pcm: Float32Array;
  rate: number;
  ms: number;
}

export class PiperBackend implements SynthBackend {
  private worker: Worker;
  private seq = 0;
  private waiting = new Map<number, (d: { error?: string } & Partial<Synthesized> & { ok?: boolean }) => void>();
  private cache = new Map<string, Promise<Synthesized>>();
  /** Запросы синтеза, которые ещё не вернулись: id → ключ кэша. */
  private queued = new Map<number, string>();
  /** Растёт при каждой отмене: запрос, начатый до отмены, в синтез уже не идёт. */
  private generation = 0;
  private ctx: AudioContext | null = null;
  /** Модели загружены. До этого звучит голос устройства, чтобы первое нажатие не ждало загрузку. */
  ready = false;

  private constructor(readonly voices: Record<string, VoiceSpec>) {
    this.worker = new Worker("/workers/tts-worker.js");
    this.worker.onmessage = (e) => {
      const cb = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      this.queued.delete(e.data.id);
      cb?.(e.data);
    };
  }

  /** null — голоса не установлены (тогда звучат записи и голос устройства). */
  static async create(): Promise<PiperBackend | null> {
    try {
      const res = await fetch("/voices/manifest.json");
      if (!res.ok) return null;
      const voices = (await res.json()) as Record<string, VoiceSpec>;
      if (!Object.keys(voices).length) return null;
      const b = new PiperBackend(voices);
      await b.call({ type: "init", voices });
      return b;
    } catch {
      return null;
    }
  }

  private call(msg: { type: string; [k: string]: unknown }, key?: string): Promise<{ error?: string; ok?: boolean } & Partial<Synthesized>> {
    const id = ++this.seq;
    if (key) this.queued.set(id, key);
    return new Promise((resolve) => {
      this.waiting.set(id, resolve);
      this.worker.postMessage({ ...msg, id });
    });
  }

  /** Снять из очереди синтеза всё, что ещё не начато. */
  cancel(): void {
    if (!this.queued.size) return;
    this.generation++;
    this.worker.postMessage({ type: "cancel", ids: [...this.queued.keys()] });
    for (const key of this.queued.values()) this.cache.delete(key);
    this.queued.clear();
  }

  supports(lang: Lang): boolean {
    return this.ready && lang in this.voices;
  }

  private loading: Promise<boolean> | null = null;

  /** Загрузить модели заранее (иначе первая фраза ждёт загрузку). false — не загрузились. */
  whenReady(): Promise<boolean> {
    this.loading ??= this.call({ type: "warmup" }).then((r) => {
      this.ready = !r.error;
      return this.ready;
    });
    return this.loading;
  }

  /** Синтез с кэшем в памяти и на устройстве; повторный запрос той же фразы ждёт уже начатый. */
  synthesize(text: string, lang: Lang): Promise<Synthesized> {
    const key = `${lang}|${text}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const v = this.voices[lang];
    // Смена голоса или темпа — другой ключ: старые записи вытеснятся сами.
    const stored = `${v?.name}|${v?.lengthScale}|${key}`;
    const generation = this.generation;
    const p = loadClip(stored).then(async (clip): Promise<Synthesized> => {
      if (clip) return { ...clip, ms: 0 };
      if (generation !== this.generation) throw new Error("cancelled");
      const r = await this.call({ type: "speak", lang, text }, key);
      if (r.error || !r.pcm || !r.rate) throw new Error(r.error ?? "синтез не удался");
      void saveClip(stored, r.pcm, r.rate);
      return { pcm: r.pcm, rate: r.rate, ms: r.ms ?? 0 };
    });
    p.catch(() => {
      if (this.cache.get(key) === p) this.cache.delete(key);
    });
    if (this.cache.size > 120) this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, p);
    return p;
  }

  /** Синтез мимо всех кэшей — для замера скорости на устройстве. */
  async measure(text: string, lang: Lang): Promise<Synthesized> {
    const r = await this.call({ type: "speak", lang, text, fresh: true });
    if (r.error || !r.pcm || !r.rate) throw new Error(r.error ?? "синтез не удался");
    return { pcm: r.pcm, rate: r.rate, ms: r.ms ?? 0 };
  }

  /** Начать синтез заранее, пока звучит предыдущая фраза. */
  prefetch(text: string, lang: Lang): void {
    if (this.supports(lang)) this.synthesize(text, lang).catch(() => {});
  }

  async speak(text: string, lang: Lang, signal: AbortSignal): Promise<void> {
    const { pcm, rate } = await this.synthesize(text, lang);
    if (signal.aborted) return;
    this.ctx ??= new AudioContext();
    await this.ctx.resume();
    const buf = this.ctx.createBuffer(1, pcm.length, rate);
    buf.copyToChannel(pcm as Float32Array<ArrayBuffer>, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
      signal.addEventListener("abort", () => {
        try {
          src.stop();
        } catch {
          /* уже остановлен */
        }
        resolve();
      });
      src.start();
    });
  }
}

declare global {
  interface Window {
    /** Состояние синтеза — для тестов. */
    __golosSynth?: "none" | "loading" | "ready" | "failed";
  }
}

let started: Promise<PiperBackend | null> | null = null;

/** Подключает синтез к очереди озвучки один раз за сеанс. */
export function ensurePiper(attach: (b: PiperBackend) => void): Promise<PiperBackend | null> {
  started ??= PiperBackend.create().then((b) => {
    window.__golosSynth = b ? "loading" : "none";
    if (b) {
      attach(b);
      void b.whenReady().then((ok) => (window.__golosSynth = ok ? "ready" : "failed"));
    }
    return b;
  });
  return started;
}
