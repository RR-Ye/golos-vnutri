// Выбор следующего шага: вопрос с наибольшим ожидаемым приростом информации,
// подтверждение полной фразы или выбор из картинок.
import { frameTopics } from "../ontology/index.ts";
import type { TopicId } from "../types.ts";
import { questionTruth } from "../inference/likelihood.ts";
import type { EngineModel } from "../inference/model.ts";
import { questionKey, type Evidence, type Posterior, type Question, type Scored } from "../inference/types.ts";

/** Сколько лучших кандидатов использовать для генерации вопросов. */
const QUESTION_POOL = 40;

export function generateQuestions(model: EngineModel, post: Posterior, asked: ReadonlySet<string>): Question[] {
  const pool = post.ranked.slice(0, QUESTION_POOL);
  const out = new Map<string, Question>();
  const add = (q: Question) => {
    const k = questionKey(q);
    if (!asked.has(k) && !out.has(k)) out.set(k, q);
  };
  for (const r of pool) {
    const f = model.frameIndex.get(r.candidate.frame);
    if (!f) continue;
    for (const t of frameTopics(f)) add({ level: "topic", topic: t as TopicId });
    for (const v of Object.values(r.candidate.slots)) if (v) add({ level: "slot", entity: v });
  }
  for (const r of pool.slice(0, 10)) add({ level: "hypothesis", candidate: r.candidate });
  return [...out.values()];
}

const H = (ps: number[]) => ps.reduce((s, p) => (p > 0 ? s - p * Math.log(p) : s), 0);

/** Ожидаемое снижение энтропии от ответа «да/нет» с учётом вероятности ошибочного нажатия. */
export function expectedInfoGain(model: EngineModel, post: Posterior, q: Question): number {
  const eps = model.epsilon;
  const truths = post.ranked.map((r) => questionTruth(model, q, r.candidate) === true);
  // «Ничего из этого» отвечает наугад.
  const pYesGiven = truths.map((t) => (t ? 1 - eps : eps));
  const pYes = post.ranked.reduce((s, r, i) => s + r.p * pYesGiven[i]!, post.other * 0.5);
  const pNo = 1 - pYes;
  if (pYes <= 1e-9 || pNo <= 1e-9) return 0;
  const postYes = post.ranked.map((r, i) => (r.p * pYesGiven[i]!) / pYes);
  const postNo = post.ranked.map((r, i) => (r.p * (1 - pYesGiven[i]!)) / pNo);
  const hYes = H([...postYes, (post.other * 0.5) / pYes]);
  const hNo = H([...postNo, (post.other * 0.5) / pNo]);
  return post.entropy - (pYes * hYes + pNo * hNo);
}

export interface PolicyOptions {
  threshold: number;
  maxQuestions: number;
}

export type Decision =
  | { kind: "wait" }
  | { kind: "confirm"; top: Scored }
  /** Она уже ответила «да» на вопрос о целой гипотезе, и уверенность выше порога. */
  | { kind: "accept"; top: Scored }
  | { kind: "ask"; question: Question; gain: number }
  | { kind: "grid"; options: Scored[] };

export interface DialogState {
  evidence: readonly Evidence[];
  /** Ключи уже заданных вопросов. */
  asked: ReadonlySet<string>;
  /** Сколько уточняющих вопросов задано с последнего выбора из картинок. */
  questionsSinceGrid: number;
  /** Кандидаты, отвергнутые в сетке картинок. */
  rejectedInGrid: ReadonlySet<string>;
}

/** Только навигация (темы) — ещё рано спрашивать, интерфейс показывает плитки темы. */
function onlyNavigation(evidence: readonly Evidence[]): boolean {
  return evidence.every((e) => e.kind === "topic");
}

export function decide(model: EngineModel, post: Posterior, state: DialogState, opts: PolicyOptions): Decision {
  if (state.evidence.length === 0) return { kind: "wait" };
  const top = post.ranked[0];
  // Только тема: если по её истории мысль почти очевидна, сразу предлагаем фразу, иначе ждём плиток.
  if (onlyNavigation(state.evidence)) {
    return top && top.p >= opts.threshold && top.p > post.other ? { kind: "confirm", top } : { kind: "wait" };
  }
  if (top && top.p >= opts.threshold && top.p > post.other) {
    const last = state.evidence[state.evidence.length - 1];
    const saidYesToTop =
      last?.kind === "answer" &&
      last.answer === "yes" &&
      last.question.level === "hypothesis" &&
      questionKey(last.question) === questionKey({ level: "hypothesis", candidate: top.candidate });
    return saidYesToTop ? { kind: "accept", top } : { kind: "confirm", top };
  }
  // Данных мало (слово невпопад, «нет» обнулило догадки): не спрашиваем вслепую, ждём её нажатий.
  const topMass = post.ranked.slice(0, model.L.policy.topK).reduce((sum, r) => sum + r.p, 0);
  if (topMass < model.L.policy.minTopMass) return { kind: "wait" };
  // Если она часто ошибается, картинки предлагаются раньше.
  const limit = model.epsilon > 0.2 ? Math.max(2, opts.maxQuestions - 2) : opts.maxQuestions;
  if (state.questionsSinceGrid >= limit) {
    const options = post.ranked.filter((r) => !state.rejectedInGrid.has(r.key)).slice(0, 4);
    if (options.length) return { kind: "grid", options };
  }
  const qs = generateQuestions(model, post, state.asked);
  let best: { q: Question; g: number } | null = null;
  for (const q of qs) {
    const g = expectedInfoGain(model, post, q);
    if (!best || g > best.g + 1e-9) best = { q, g };
  }
  if (best && best.g > 0.01) return { kind: "ask", question: best.q, gain: best.g };
  const options = post.ranked.filter((r) => !state.rejectedInGrid.has(r.key)).slice(0, 4);
  return options.length ? { kind: "grid", options } : { kind: "wait" };
}
