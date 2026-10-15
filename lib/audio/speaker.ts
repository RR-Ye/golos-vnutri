"use client";

// Очередь озвучки. Источники по приоритету: запись голосом → локальный синтез (подключается
// в фазе 4) → голос устройства (только локальные голоса, без облачных).
import type { Lang } from "@/engine/types";
import { db } from "@/lib/db";
import type { Utterance } from "./sound";

export type SpeechSource = "recording" | "synth" | "system" | "none";

export interface SpokenLogEntry {
  at: number;
  lang: Lang;
  text: string;
  source: SpeechSource;
}

/** Локальный синтезатор (Piper и т. п.) — подключается позже, если доступен. */
export interface SynthBackend {
  supports(lang: Lang): boolean;
  speak(text: string, lang: Lang, signal: AbortSignal): Promise<void>;
}

declare global {
  interface Window {
    __golosSpoken?: SpokenLogEntry[];
  }
}

const BCP47: Record<Lang, string> = { ru: "ru", kk: "kk" };

function log(entry: SpokenLogEntry) {
  if (typeof window === "undefined") return;
  const list = (window.__golosSpoken ??= []);
  list.push(entry);
  if (list.length > 300) list.splice(0, list.length - 300);
}

function localVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === "undefined") return null;
  const voices = speechSynthesis.getVoices().filter((v) => v.localService && v.lang.toLowerCase().startsWith(BCP47[lang]));
  return voices[0] ?? null;
}

async function playBlob(mediaId: string, signal: AbortSignal): Promise<boolean> {
  const rec = await db().media.get(mediaId);
  if (!rec || signal.aborted) return false;
  const url = URL.createObjectURL(rec.blob);
  try {
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      const done = () => resolve();
      audio.onended = done;
      audio.onerror = done;
      signal.addEventListener("abort", () => {
        audio.pause();
        done();
      });
      audio.play().catch(done);
    });
    return true;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function speakSystem(text: string, lang: Lang, signal: AbortSignal): Promise<boolean> {
  const voice = localVoice(lang);
  if (!voice || !text) return Promise.resolve(false);
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85; // медленнее обычного: ей легче понять и повторить
    u.onend = () => resolve(true);
    u.onerror = () => resolve(true);
    signal.addEventListener("abort", () => {
      speechSynthesis.cancel();
      resolve(true);
    });
    speechSynthesis.speak(u);
  });
}

const pause = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

export class Speaker {
  private controller: AbortController | null = null;
  private chain: Promise<void> = Promise.resolve();
  synth: SynthBackend | null = null;
  systemVoice = true;

  /** Говорит по очереди; interrupt — прервать то, что звучит сейчас. */
  speak(list: Utterance[], opts: { interrupt?: boolean; gapMs?: number } = {}): Promise<void> {
    if (opts.interrupt) this.stop();
    const controller = (this.controller ??= new AbortController());
    const signal = controller.signal;
    const run = async () => {
      for (const [i, u] of list.entries()) {
        if (signal.aborted) return;
        if (i > 0) await pause(opts.gapMs ?? 350, signal);
        let source: SpeechSource = "none";
        if (u.mediaId && (await playBlob(u.mediaId, signal))) source = "recording";
        else if (this.synth?.supports(u.lang) && u.text) {
          await this.synth.speak(u.text, u.lang, signal);
          source = "synth";
        } else if (this.systemVoice && (await speakSystem(u.text, u.lang, signal))) source = "system";
        log({ at: Date.now(), lang: u.lang, text: u.text, source });
      }
    };
    this.chain = this.chain.then(run, run);
    return this.chain;
  }

  stop(): void {
    this.controller?.abort();
    this.controller = null;
    this.chain = Promise.resolve();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }
}

export const speaker = new Speaker();
