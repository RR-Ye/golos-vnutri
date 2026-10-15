// Человеческие подписи к свидетельствам для экрана «Почему так».
import { frameLabel, topicById } from "@/engine/ontology";
import type { Evidence, Question } from "@/engine";
import type { Entity, WordEntry } from "@/engine/types";
import { ru } from "@/lib/i18n";

const W = ru.care.why;

function questionLabel(q: Question, name: (id: string) => string): string {
  if (q.level === "topic") return `${W.qTopic} «${topicById(q.topic)?.name.ru ?? q.topic}»`;
  if (q.level === "slot") return `${W.qSlot} «${name(q.entity)}»`;
  const slots = Object.values(q.candidate.slots).filter((v): v is string => !!v).map(name);
  return `${W.qHypothesis} «${frameLabel(q.candidate.frame)}${slots.length ? `: ${slots.join(", ")}` : ""}»`;
}

export function describeEvidence(e: Evidence, entities: ReadonlyMap<string, Entity>, words: readonly WordEntry[]): string {
  const name = (id: string) => entities.get(id)?.name.ru ?? id;
  switch (e.kind) {
    case "topic":
      return `${W.topic} «${topicById(e.topic)?.name.ru ?? e.topic}»`;
    case "frame":
      return `${W.frame} «${frameLabel(e.frame)}»`;
    case "face":
      return `${W.face}: ${ru.patient.faces[e.level].toLowerCase()}`;
    case "severity":
      return `${W.severity}: ${e.level} ${W.of5}`;
    case "body":
      return `${W.body}: ${name(e.entity)}`;
    case "entity":
      return `${W.photo}: ${name(e.entity)}`;
    case "word": {
      const w = words.find((x) => x.id === e.word);
      return `${W.word} «${w?.text ?? e.word}»${e.repeats > 1 ? ` ×${e.repeats}` : ""} (${Math.round(e.confidence * 100)} %)`;
    }
    case "answer": {
      const a = e.answer === "yes" ? ru.care.buttons.meanings.yes : e.answer === "no" ? ru.care.buttons.meanings.no : ru.care.buttons.meanings.almost;
      return `${W.answer} «${a}» ${W.on} ${questionLabel(e.question, name)}`;
    }
    case "grid":
      return e.picked ? W.gridPick : W.gridNone;
  }
}
