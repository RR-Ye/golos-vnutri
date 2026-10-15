// Лучевой поиск кандидатов и апостериорное распределение.
//
// Оценка кандидата = лог-априор + Σ лог-правдоподобий свидетельств (наивный Байес).
// Поиск: сначала все фреймы с открытыми слотами (оптимистичная оценка), лучшие K раскрываются
// по одному слоту, после каждого шага остаются B лучших частичных кандидатов.
import { logLik, logLikOther, logPrior } from "./likelihood.ts";
import type { EngineModel } from "./model.ts";
import { candidateKey, type Candidate, type Evidence, type Posterior, type Scored } from "./types.ts";

export interface SearchOptions {
  /** Сколько фреймов раскрывать. */
  frameBeam: number;
  /** Ширина луча частичных кандидатов. */
  beam: number;
  /** Отсечь всё, что хуже лучшего на столько натов. */
  margin: number;
}

export const DEFAULT_SEARCH: SearchOptions = { frameBeam: 40, beam: 600, margin: 12 };

export function scoreCandidate(model: EngineModel, evidence: readonly Evidence[], c: Candidate): number {
  let s = logPrior(model, c);
  for (const e of evidence) {
    if (s === -Infinity) break;
    s += logLik(model, e, c);
  }
  return s;
}

function isComplete(model: EngineModel, c: Candidate): boolean {
  const f = model.frameIndex.get(c.frame);
  return !!f && f.slots.every((s) => s.name in c.slots);
}

interface Partial {
  c: Candidate;
  s: number;
}

export function beamSearch(model: EngineModel, evidence: readonly Evidence[], opts: SearchOptions = DEFAULT_SEARCH): Partial[] {
  const roots: Partial[] = model.frames.map((f) => {
    const c: Candidate = { frame: f.id, slots: {} };
    return { c, s: scoreCandidate(model, evidence, c) };
  });
  roots.sort((a, b) => b.s - a.s);
  const best = roots[0]?.s ?? -Infinity;
  let frontier = roots.filter((r, i) => i < opts.frameBeam && r.s >= best - opts.margin);

  const done: Partial[] = [];
  while (frontier.length) {
    const next: Partial[] = [];
    for (const p of frontier) {
      if (isComplete(model, p.c)) {
        done.push(p);
        continue;
      }
      const f = model.frameIndex.get(p.c.frame)!;
      const slot = f.slots.find((s) => !(s.name in p.c.slots))!;
      const values: (string | null)[] = slot.types.flatMap((t) => (model.byType.get(t) ?? []).map((e) => e.id));
      if (slot.optional) values.push(null);
      for (const v of values) {
        const c: Candidate = { frame: p.c.frame, slots: { ...p.c.slots, [slot.name]: v } };
        next.push({ c, s: scoreCandidate(model, evidence, c) });
      }
    }
    next.sort((a, b) => b.s - a.s);
    const top = Math.max(next[0]?.s ?? -Infinity, done.reduce((m, d) => Math.max(m, d.s), -Infinity));
    frontier = next.filter((p, i) => i < opts.beam && p.s >= top - opts.margin && p.s > -Infinity);
  }
  return done.sort((a, b) => b.s - a.s);
}

export function posterior(model: EngineModel, evidence: readonly Evidence[], opts: SearchOptions = DEFAULT_SEARCH): Posterior {
  const found = beamSearch(model, evidence, opts);
  let otherLog = Math.log(model.L.other.prior);
  for (const e of evidence) otherLog += logLikOther(model, e);
  const max = Math.max(otherLog, found[0]?.s ?? -Infinity);
  const weights = found.map((f) => Math.exp(f.s - max));
  const otherW = Math.exp(otherLog - max);
  const z = weights.reduce((s, w) => s + w, otherW);
  const ranked: Scored[] = found.map((f, i) => ({ candidate: f.c, key: candidateKey(f.c), logScore: f.s, p: weights[i]! / z }));
  const other = otherW / z;
  let entropy = other > 0 ? -other * Math.log(other) : 0;
  for (const r of ranked) if (r.p > 0) entropy -= r.p * Math.log(r.p);
  return { ranked, other, entropy };
}

export interface Contribution {
  /** Номер свидетельства в списке или -1 для априора. */
  index: number;
  label: string;
  /** Вклад относительно «ничего из этого», в натах. */
  weight: number;
}

/** «Почему так»: вклад априора и каждого свидетельства в оценку кандидата. */
export function explain(model: EngineModel, evidence: readonly Evidence[], c: Candidate): Contribution[] {
  const out: Contribution[] = [{ index: -1, label: "prior", weight: logPrior(model, c) - Math.log(model.L.other.prior) }];
  evidence.forEach((e, i) => {
    out.push({ index: i, label: e.kind, weight: logLik(model, e, c) - logLikOther(model, e) });
  });
  return out;
}
