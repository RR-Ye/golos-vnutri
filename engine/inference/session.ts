// Состояние одного разговора: свидетельства, заданные вопросы, счётчики шагов.
// Неизменяемое: каждая операция возвращает новое состояние (удобно для React и симулятора).
import { decide, type Decision, type DialogState, type PolicyOptions } from "../questions/index.ts";
import type { EngineModel } from "./model.ts";
import { posterior } from "./search.ts";
import { questionKey, type AnswerValue, type Candidate, type Evidence, type Posterior, type Question } from "./types.ts";

export interface SessionState extends DialogState {
  /** Действия бабушки: нажатия, слова, ответы. */
  steps: number;
  /** Сколько серий повторов слова было. */
  repeatSeries: number;
  /** Она только что сказала «Нет» на «Так?» — дать ей снова выбрать на экране. */
  justRejected: boolean;
}

export function newSession(): SessionState {
  return { evidence: [], asked: new Set(), questionsSinceGrid: 0, rejectedInGrid: new Set(), steps: 0, repeatSeries: 0, justRejected: false };
}

export function addEvidence(s: SessionState, e: Evidence): SessionState {
  const repeat = e.kind === "word" && e.repeats > 1 ? 1 : 0;
  return { ...s, evidence: [...s.evidence, e], steps: s.steps + 1, repeatSeries: s.repeatSeries + repeat, justRejected: false };
}

export function answerQuestion(s: SessionState, question: Question, answer: AnswerValue): SessionState {
  const next = addEvidence(s, { kind: "answer", question, answer });
  const asked = new Set(s.asked);
  asked.add(questionKey(question));
  return { ...next, asked, questionsSinceGrid: s.questionsSinceGrid + 1 };
}

/** «Нет» на «Так?»: свидетельство против гипотезы, и следующий шаг — снова её выбор. */
export function rejectConfirm(s: SessionState, candidate: Candidate): SessionState {
  return { ...answerQuestion(s, { level: "hypothesis", candidate }, "no"), justRejected: true };
}

export function answerGrid(s: SessionState, shown: string[], picked: string | null): SessionState {
  const next = addEvidence(s, { kind: "grid", shown, picked });
  const rejected = new Set(s.rejectedInGrid);
  if (picked === null) for (const k of shown) rejected.add(k);
  return { ...next, rejectedInGrid: rejected, questionsSinceGrid: 0 };
}

export interface StepResult {
  post: Posterior;
  decision: Decision;
}

export function evaluate(model: EngineModel, s: SessionState, opts: PolicyOptions): StepResult {
  const post = posterior(model, s.evidence);
  if (s.justRejected) return { post, decision: { kind: "wait" } };
  return { post, decision: decide(model, post, s, opts) };
}
