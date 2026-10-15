"use client";

import {
  learnConfirmed,
  learnRejected,
  messageText,
  type Candidate,
  type EngineModel,
  type Evidence,
  type MessageSentence,
  type NlgOptions,
} from "@/engine";
import type { Entity } from "@/engine/types";
import { db, newId } from "@/lib/db";
import type { LearnedState } from "@/lib/db/types";

async function loadLearned(): Promise<LearnedState> {
  return (await db().learned.get("main")) ?? { id: "main", frameTime: {}, entityFreq: {}, wordMeaning: {}, answerErrors: [0, 0] };
}

/** Сохраняет подтверждённое сообщение в историю и обучает модель на нём. */
export async function saveMessage(args: {
  message: MessageSentence[];
  evidence: Evidence[][];
  model: EngineModel;
  entities: ReadonlyMap<string, Entity>;
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
    sentences: message.map((s, i) => ({
      frame: s.candidate.frame,
      slots: Object.fromEntries(Object.entries(s.candidate.slots).filter((kv): kv is [string, string] => !!kv[1])),
      connective: s.connective,
      text: {
        ru: messageText(message.slice(i, i + 1), entities, "ru", opts),
        kk: messageText(message.slice(i, i + 1), entities, "kk", opts),
      },
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
