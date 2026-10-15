// Составные сообщения: цепочка подтверждённых предложений со связками.
import { frameById } from "../ontology/index.ts";
import { framePhrase, joinSentences, type NlgOptions, type SentencePart } from "../nlg/index.ts";
import type { Candidate } from "../inference/types.ts";
import type { ConnectiveId, Entity, Lang } from "../types.ts";

export interface MessageSentence {
  candidate: Candidate;
  /** Связка перед предложением (у первого нет). */
  connective?: ConnectiveId;
}

export function resolveSlots(c: Candidate, entities: ReadonlyMap<string, Entity>): Record<string, Entity> {
  const out: Record<string, Entity> = {};
  for (const [k, v] of Object.entries(c.slots)) {
    const e = v ? entities.get(v) : undefined;
    if (e) out[k] = e;
  }
  return out;
}

/** Текст одного предложения от её лица. */
export function sentenceText(c: Candidate, entities: ReadonlyMap<string, Entity>, lang: Lang, opts: NlgOptions): string {
  return framePhrase(c.frame, resolveSlots(c, entities), "say", lang, opts).text;
}

/** Вопрос о целой гипотезе («Вы хотите увидеть Алию?»). */
export function hypothesisQuestion(c: Candidate, entities: ReadonlyMap<string, Entity>, lang: Lang, opts: NlgOptions): string {
  return framePhrase(c.frame, resolveSlots(c, entities), "ask", lang, opts).text;
}

/** Всё сообщение целиком на одном языке. */
export function messageText(sentences: readonly MessageSentence[], entities: ReadonlyMap<string, Entity>, lang: Lang, opts: NlgOptions): string {
  const parts: SentencePart[] = sentences.map((s, i) => {
    const prev = sentences[i - 1];
    const prevLeads = !!prev && !!frameById(prev.candidate.frame)?.leadsOn;
    const next = sentences[i + 1];
    const kind = frameById(s.candidate.frame)?.leadsOn && next ? "lead" : "say";
    const r = framePhrase(s.candidate.frame, resolveSlots(s.candidate, entities), kind, lang, opts);
    return { text: r.text, startsWithName: r.startsWithName, connective: prevLeads ? undefined : s.connective, afterLead: prevLeads };
  });
  return joinSentences(parts, lang);
}

/** Сущности из подтверждённых предложений: в следующем предложении им повышается априор. */
export function contextEntities(sentences: readonly MessageSentence[]): string[] {
  return [...new Set(sentences.flatMap((s) => Object.values(s.candidate.slots).filter((v): v is string => !!v)))];
}
