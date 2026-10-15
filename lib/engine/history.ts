"use client";

import {
  candidateKey,
  explain,
  framePhrase,
  learnConfirmed,
  posterior,
  resolveSlots,
  learnRejected,
  messageText,
  type Candidate,
  type EngineModel,
  type Evidence,
  type MessageSentence,
  type NlgOptions,
} from "@/engine";
import type { Entity, WordEntry } from "@/engine/types";
import { ru } from "@/lib/i18n";
import { describeEvidence } from "./describe";
import { db, newId } from "@/lib/db";
import type { LearnedState, WhyItem } from "@/lib/db/types";

/** «Почему так»: три лучшие гипотезы и вклад каждого свидетельства. */
export function whyFor(
  model: EngineModel,
  evidence: readonly Evidence[],
  chosen: Candidate,
  entities: ReadonlyMap<string, Entity>,
  words: readonly WordEntry[],
  opts: NlgOptions,
): WhyItem[] {
  const post = posterior(model, evidence);
  const top = post.ranked.slice(0, 3);
  const chosenKey = candidateKey(chosen);
  if (!top.some((r) => r.key === chosenKey)) top.unshift({ candidate: chosen, key: chosenKey, logScore: 0, p: 0 });
  return top.slice(0, 3).map((r) => ({
    key: r.key,
    p: r.p,
    text: framePhrase(r.candidate.frame, resolveSlots(r.candidate, entities), "say", "ru", opts).text,
    contributions: explain(model, evidence, r.candidate).map((c) => ({
      label: c.index < 0 ? ru.care.why.prior : describeEvidence(evidence[c.index]!, entities, words),
      weight: Math.round(c.weight * 100) / 100,
    })),
  }));
}

async function loadLearned(): Promise<LearnedState> {
  return (await db().learned.get("main")) ?? { id: "main", frameTime: {}, entityFreq: {}, wordMeaning: {}, answerErrors: [0, 0] };
}

/** Сохраняет подтверждённое сообщение в историю и обучает модель на нём. */
export async function saveMessage(args: {
  message: MessageSentence[];
  evidence: Evidence[][];
  model: EngineModel;
  entities: ReadonlyMap<string, Entity>;
  words: readonly WordEntry[];
  opts: NlgOptions;
  steps: number;
  repeatSeries: number;
}): Promise<string> {
  const { message, evidence, model, entities, opts } = args;
  const id = newId("msg");
  const questions = evidence.flat().filter((e) => e.kind === "answer").length;
  await db().history.put({
    id,
    at: Date.now(),
    text: { ru: messageText(message, entities, "ru", opts), kk: messageText(message, entities, "kk", opts) },
    sentences: message.map((s, i) => ({
      frame: s.candidate.frame,
      slots: Object.fromEntries(Object.entries(s.candidate.slots).filter((kv): kv is [string, string] => !!kv[1])),
      connective: s.connective,
      text: {
        ru: messageText(message.slice(i, i + 1), entities, "ru", opts),
        kk: messageText(message.slice(i, i + 1), entities, "kk", opts),
      },
      why: whyFor(model, evidence[i] ?? [], s.candidate, entities, args.words, opts),
    })),
    steps: args.steps,
    questions,
    repeatSeries: args.repeatSeries,
    repeat: {},
  });
  let learned = await loadLearned();
  message.forEach((s, i) => {
    learned = { ...learnConfirmed(learned, model, s.candidate, evidence[i] ?? []), id: "main" };
  });
  await db().learned.put(learned);
  return id;
}

/** «Нет» на итоговую фразу: отрицательное обновление. */
export async function saveRejection(model: EngineModel, candidate: Candidate): Promise<void> {
  const learned = await loadLearned();
  await db().learned.put({ ...learnRejected(learned, candidate, model.band), id: "main" });
}
