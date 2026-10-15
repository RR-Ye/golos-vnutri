"use client";

// Распознавание её слов в приложении: образцы из хранилища, запись с микрофона до паузы,
// сегментация, сравнение, склейка серий повторов.
import {
  collapseSeries,
  decodeWav,
  encodeWav,
  leaveOneOut,
  recognize,
  resample,
  segmentSpeech,
  speechEnded,
  TARGET_RATE,
  trimSilence,
  wordFeatures,
  type Features,
  type Heard,
  type LooResult,
  type Recognition,
  type Series,
  type Template,
} from "@/engine/asr";
import { db } from "@/lib/db";
import { putMedia } from "@/lib/db/media";
import type { SampleRecord } from "@/lib/db/types";
import { MicStream } from "./recorder";

export function featuresFromPcm(pcm: Float32Array): Pick<SampleRecord, "features" | "nFrames" | "dims"> {
  const f = wordFeatures(pcm);
  return { features: f.data, nFrames: f.nFrames, dims: f.dims };
}

async function pcmOfMedia(mediaId: string): Promise<Float32Array | null> {
  const rec = await db().media.get(mediaId);
  if (!rec) return null;
  const { pcm, rate } = decodeWav(new Uint8Array(await rec.blob.arrayBuffer()));
  return trimSilence(resample(pcm, rate, TARGET_RATE), TARGET_RATE);
}

/** Досчитывает признаки для образцов, записанных до появления распознавания. */
export async function ensureSampleFeatures(): Promise<void> {
  const missing = await db().samples.filter((s) => !s.features).toArray();
  for (const s of missing) {
    const pcm = await pcmOfMedia(s.mediaId);
    if (pcm) await db().samples.update(s.id, featuresFromPcm(pcm));
  }
}

export async function loadTemplates(): Promise<Template[]> {
  await ensureSampleFeatures();
  const all = await db().samples.toArray();
  return all
    .filter((s): s is SampleRecord & { features: Float32Array } => !!s.features && s.nFrames > 0)
    .map((s) => ({ wordId: s.wordId, features: { data: s.features, nFrames: s.nFrames, dims: s.dims } as Features }));
}

/** Проверка с исключением по одной записи на её образцах (слова, у которых ≥ 2 записей). */
export async function evaluateMySamples(): Promise<LooResult> {
  const t = await loadTemplates();
  const counts = new Map<string, number>();
  for (const x of t) counts.set(x.wordId, (counts.get(x.wordId) ?? 0) + 1);
  return leaveOneOut(t.filter((x) => (counts.get(x.wordId) ?? 0) >= 2));
}

export interface HeardSeries extends Series {
  /** Лучшие совпадения для первого слова серии (для переспроса и теста). */
  recognition: Recognition;
  mediaId: string;
}

export interface ListenOptions {
  /** Пауза после речи, после которой запись заканчивается. */
  endSilenceMs: number;
  /** Самая длинная запись. */
  maxMs: number;
  /** Если речь так и не началась. */
  noSpeechMs: number;
}

export const DEFAULT_LISTEN: ListenOptions = { endSilenceMs: 1200, maxMs: 8000, noSpeechMs: 5000 };

/** Слушает до паузы и возвращает распознанные слова (серии повторов склеены). */
export class Listener {
  private mic = new MicStream();
  private chunks: Float32Array[] = [];
  private resolve: ((r: Float32Array) => void) | null = null;
  private startedAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  async listen(opts: ListenOptions = DEFAULT_LISTEN): Promise<Float32Array> {
    this.chunks = [];
    this.startedAt = Date.now();
    const done = new Promise<Float32Array>((r) => (this.resolve = r));
    await this.mic.start((c) => this.chunks.push(c));
    this.timer = setInterval(() => {
      const pcm = this.current();
      const elapsed = Date.now() - this.startedAt;
      const any = segmentSpeech(pcm).length > 0;
      if (elapsed >= opts.maxMs || (any && speechEnded(pcm, opts.endSilenceMs)) || (!any && elapsed >= opts.noSpeechMs)) {
        void this.stop();
      }
    }, 250);
    return done;
  }

  private current(): Float32Array {
    const total = this.chunks.reduce((s, c) => s + c.length, 0);
    const raw = new Float32Array(total);
    let o = 0;
    for (const c of this.chunks) {
      raw.set(c, o);
      o += c.length;
    }
    return resample(raw, this.mic.rate, TARGET_RATE);
  }

  /** Остановить досрочно (повторное нажатие «Сказать»). */
  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const pcm = this.current();
    await this.mic.stop();
    this.resolve?.(pcm);
    this.resolve = null;
  }
}

/** Распознаёт записанное: каждое слово по отдельности, серии склеиваются. */
export async function recognizeRecording(pcm: Float32Array, templates: readonly Template[]): Promise<HeardSeries[]> {
  const segs = segmentSpeech(pcm);
  const heard: (Heard & { recognition: Recognition; pcm: Float32Array })[] = segs.map((sg) => {
    const piece = pcm.slice(sg.start, sg.end);
    const recognition = recognize(wordFeatures(piece), templates);
    const top = recognition.matches[0];
    return {
      wordId: recognition.unknown || !top ? null : top.wordId,
      confidence: recognition.unknown ? 0 : (top?.confidence ?? 0),
      at: Math.round((sg.end / TARGET_RATE) * 1000),
      recognition,
      pcm: piece,
    };
  });
  const series = collapseSeries(heard);
  // Для каждой серии сохраняем её первую запись — родственник сможет прослушать попытку.
  const out: HeardSeries[] = [];
  let idx = 0;
  for (const s of series) {
    const first = heard[idx]!;
    idx += s.repeats;
    const mediaId = await putMedia(new Blob([encodeWav(first.pcm)], { type: "audio/wav" }), "audio");
    out.push({ ...s, recognition: first.recognition, mediaId });
  }
  return out;
}
