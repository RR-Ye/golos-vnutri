import type { FaceLevel, TopicId } from "../types.ts";

/**
 * Кандидат: фрейм и значения слотов.
 * Значение слота: id сущности; null — необязательный слот пуст; отсутствие ключа — слот ещё
 * не раскрыт (только во время поиска).
 */
export interface Candidate {
  frame: string;
  slots: Record<string, string | null>;
}

export const OTHER_KEY = "__other__";

export function candidateKey(c: Candidate): string {
  const parts = Object.keys(c.slots)
    .sort()
    .map((k) => `${k}=${c.slots[k] ?? "-"}`);
  return parts.length ? `${c.frame}|${parts.join(",")}` : c.frame;
}

export function parseCandidateKey(key: string): Candidate {
  const [frame, rest] = key.split("|", 2) as [string, string?];
  const slots: Record<string, string | null> = {};
  for (const p of rest ? rest.split(",") : []) {
    const [k, v] = p.split("=") as [string, string];
    slots[k] = v === "-" ? null : v;
  }
  return { frame, slots };
}

export type AnswerValue = "yes" | "no" | "almost";

export type Question =
  | { level: "topic"; topic: TopicId }
  | { level: "slot"; entity: string }
  | { level: "hypothesis"; candidate: Candidate };

export function questionKey(q: Question): string {
  if (q.level === "topic") return `t:${q.topic}`;
  if (q.level === "slot") return `s:${q.entity}`;
  return `h:${candidateKey(q.candidate)}`;
}

export type Evidence =
  | { kind: "topic"; topic: TopicId }
  | { kind: "frame"; frame: string }
  | { kind: "face"; level: FaceLevel }
  | { kind: "severity"; level: FaceLevel }
  | { kind: "body"; entity: string }
  | { kind: "entity"; entity: string }
  | { kind: "word"; word: string; confidence: number; repeats: number }
  | { kind: "answer"; question: Question; answer: AnswerValue }
  | { kind: "grid"; shown: string[]; picked: string | null };

export type EvidenceKind = Evidence["kind"];

export interface Scored {
  candidate: Candidate;
  key: string;
  logScore: number;
  p: number;
}

export interface Posterior {
  /** Кандидаты по убыванию вероятности (без «другого»). */
  ranked: Scored[];
  /** Вероятность того, что мысли нет среди кандидатов. */
  other: number;
  entropy: number;
}
