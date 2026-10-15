// Лог-правдоподобие свидетельств и априор кандидата. Для частично раскрытых кандидатов
// (слоты ещё не выбраны) оценка оптимистична: открытый слот считается лучшим из возможных.
// Поэтому лучевой поиск отсекает только то, что заведомо хуже.
import { frameTopics } from "../ontology/index.ts";
import type { Entity, EntityType, FrameDef, SlotDef, TopicId } from "../types.ts";
import type { EngineModel } from "./model.ts";
import { candidateKey, type Candidate, type Evidence, type Question } from "./types.ts";

const log = Math.log;

export interface SlotOption {
  value: string | null;
  logP: number;
}

const slotCache = new WeakMap<EngineModel, Map<string, SlotOption[]>>();

/** Ключ счётчика заполненности необязательного слота в learned.entityFreq. */
export function slotUsageKey(frameId: string, slotName: string, filled: boolean): string {
  return `slot:${frameId}.${slotName}:${filled ? "filled" : "absent"}`;
}

function optionalAbsentShare(model: EngineModel, frameId: string, slotName: string): number {
  const k = model.L.prior.optionalAbsentStrength;
  const nAbsent = model.slotUsage.get(slotUsageKey(frameId, slotName, false)) ?? 0;
  const nFilled = model.slotUsage.get(slotUsageKey(frameId, slotName, true)) ?? 0;
  return (model.L.prior.optionalAbsent * k + nAbsent) / (k + nAbsent + nFilled);
}

/** Распределение значений слота (с пустым вариантом для необязательного). */
export function slotOptions(model: EngineModel, frame: FrameDef, slot: SlotDef): SlotOption[] {
  let cache = slotCache.get(model);
  if (!cache) slotCache.set(model, (cache = new Map()));
  const key = `${frame.id}.${slot.name}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const values: Entity[] = slot.types.flatMap((t) => model.byType.get(t) ?? []);
  const total = values.reduce((s, e) => s + (model.entityWeight.get(e.id) ?? 1), 0);
  // Доля «без уточнения» у необязательного слота учится по истории (бета-счётчик).
  const absentShare = slot.optional ? optionalAbsentShare(model, frame.id, slot.name) : 0;
  const filledShare = 1 - absentShare;
  const opts: SlotOption[] = values.map((e) => ({
    value: e.id,
    logP: log((filledShare * (model.entityWeight.get(e.id) ?? 1)) / (total || 1)),
  }));
  if (slot.optional) opts.push({ value: null, logP: log(absentShare) });
  opts.sort((a, b) => b.logP - a.logP);
  cache.set(key, opts);
  return opts;
}

/** Априор кандидата; для открытых слотов — максимум (верхняя граница). */
export function logPrior(model: EngineModel, c: Candidate): number {
  const f = model.frameIndex.get(c.frame);
  if (!f) return -Infinity;
  let lp = model.logFramePrior.get(f.id) ?? -Infinity;
  for (const s of f.slots) {
    const opts = slotOptions(model, f, s);
    if (!(s.name in c.slots)) {
      lp += opts[0]?.logP ?? -Infinity;
      continue;
    }
    const v = c.slots[s.name];
    const o = opts.find((x) => x.value === v);
    lp += o ? o.logP : -Infinity;
  }
  return lp;
}

type Presence = "yes" | "open" | "no";

/** Есть ли сущность в слотах кандидата: точно, возможно (открытый слот её примет), нет. */
function presence(model: EngineModel, f: FrameDef, c: Candidate, entityId: string): Presence {
  const e = model.entities.get(entityId);
  let open = false;
  for (const s of f.slots) {
    if (!(s.name in c.slots)) {
      if (e && s.types.includes(e.type)) open = true;
      continue;
    }
    if (c.slots[s.name] === entityId) return "yes";
  }
  return open ? "open" : "no";
}

/** Как фрейм относится к типу сущности: значение другое, пусто, нет такого слота. */
function slotRelation(f: FrameDef, c: Candidate, type: EntityType): "other" | "absent" | "none" {
  let rel: "other" | "absent" | "none" = "none";
  for (const s of f.slots) {
    if (!s.types.includes(type)) continue;
    const v = c.slots[s.name];
    if (v === null) rel = rel === "other" ? "other" : "absent";
    else rel = "other";
  }
  return rel;
}

function topicMatch(f: FrameDef, topic: TopicId): "main" | "also" | "no" {
  if (f.topic === topic) return "main";
  if (f.alsoTopics?.includes(topic)) return "also";
  return "no";
}

function severitySlot(f: FrameDef): SlotDef | undefined {
  return f.slots.find((s) => s.types.includes("severity"));
}

/** Совпадает ли кандидат с гипотезой: да, возможно (открытые слоты), нет. */
function matchesHypothesis(c: Candidate, h: Candidate): "yes" | "open" | "no" {
  if (c.frame !== h.frame) return "no";
  let open = false;
  for (const [k, v] of Object.entries(h.slots)) {
    if (!(k in c.slots)) {
      open = true;
      continue;
    }
    if (c.slots[k] !== v) return "no";
  }
  return open ? "open" : "yes";
}

/** Истинность вопроса для кандидата (для «открытых» — undefined). */
export function questionTruth(model: EngineModel, q: Question, c: Candidate): boolean | undefined {
  const f = model.frameIndex.get(c.frame);
  if (!f) return false;
  if (q.level === "topic") return frameTopics(f).includes(q.topic);
  if (q.level === "slot") {
    const p = presence(model, f, c, q.entity);
    return p === "yes" ? true : p === "open" ? undefined : false;
  }
  const m = matchesHypothesis(c, q.candidate);
  return m === "yes" ? true : m === "open" ? undefined : false;
}

function answerLik(truth: boolean, answer: "yes" | "no", eps: number): number {
  return (answer === "yes") === truth ? 1 - eps : eps;
}

/** Лог-правдоподобие одного свидетельства для кандидата. */
export function logLik(model: EngineModel, e: Evidence, c: Candidate): number {
  const f = model.frameIndex.get(c.frame);
  if (!f) return -Infinity;
  const L = model.L;
  switch (e.kind) {
    case "topic": {
      const m = topicMatch(f, e.topic);
      if (m === "main") return log(L.topic.main);
      if (m === "also") return log(L.topic.also);
      const types = (L.topic.slotTypesByTopic as Record<string, string[]>)[e.topic] ?? [];
      if (f.slots.some((s) => s.types.some((t) => types.includes(t)))) return log(L.topic.slotType);
      return log(L.topic.miss);
    }
    case "frame": {
      if (c.frame === e.frame) return log(L.frameTile.hit);
      const other = model.frameIndex.get(e.frame);
      return log(other && other.topic === f.topic ? L.frameTile.sameTopic : L.frameTile.miss);
    }
    case "face":
    case "severity": {
      const profile = L.face[f.face] as number[];
      const sev = severitySlot(f);
      const byLevel = L.severity.byLevel as Record<string, number[]>;
      if (!sev) {
        const p = profile[e.level - 1] ?? 0.2;
        return log(e.kind === "severity" ? p * L.severity.noSlotSeverity : p);
      }
      if (!(sev.name in c.slots)) {
        // открытый слот: лучший из вариантов (оптимистично)
        let best = profile[e.level - 1] ?? 0.2;
        for (const t of Object.values(byLevel)) best = Math.max(best, t[e.level - 1] ?? 0);
        return log(best);
      }
      const v = c.slots[sev.name];
      if (v === null) {
        const p = profile[e.level - 1] ?? 0.2;
        return log(p * (e.kind === "severity" ? L.severity.unfilledSeverity : L.severity.unfilledFace));
      }
      return log((v ? byLevel[v]?.[e.level - 1] : undefined) ?? 0.05);
    }
    case "body": {
      const hasBodySlot = f.slots.some((s) => s.types.includes("bodypart"));
      if (hasBodySlot) {
        const p = presence(model, f, c, e.entity);
        return log(p === "no" ? L.body.mismatch : L.body.match);
      }
      const hint = (L.body.hints as Record<string, Record<string, number>>)[e.entity]?.[f.id];
      if (hint) return log(hint);
      return log(frameTopics(f).includes("health") ? L.body.healthNoSlot : L.body.miss);
    }
    case "entity": {
      const p = presence(model, f, c, e.entity);
      if (p !== "no") return log(L.entity.inSlot);
      const ent = model.entities.get(e.entity);
      const rel = ent ? slotRelation(f, c, ent.type) : "none";
      if (rel === "other") return log(L.entity.slotOtherValue);
      if (rel === "absent") return log(L.entity.slotOpenOptional);
      return log(L.entity.noSlot);
    }
    case "word": {
      const w = model.words.get(e.word);
      if (!w) return log(L.word.uniform);
      let m = 0;
      for (const { target, weight } of w.meanings) {
        if (target.kind === "frame") m += c.frame === target.frame ? weight : 0;
        else if (target.kind === "topic") {
          const t = topicMatch(f, target.topic);
          m += t === "main" ? weight : t === "also" ? weight * L.word.topicAlso : 0;
        } else {
          const p = presence(model, f, c, target.entity);
          if (p !== "no") m += weight;
          else {
            const ent = model.entities.get(target.entity);
            if (ent && slotRelation(f, c, ent.type) === "absent") m += weight * L.word.entityOpen;
          }
        }
      }
      const lik = L.word.floor + m;
      const mixed = e.confidence * lik + (1 - e.confidence) * L.word.uniform;
      const exponent = e.repeats > 1 && !w.entry.oftenRepeats ? L.word.repeatExponent : 1;
      return exponent * log(mixed);
    }
    case "answer": {
      const eps = model.epsilon;
      const truth = questionTruth(model, e.question, c);
      if (e.answer === "almost") {
        if (e.question.level === "hypothesis") {
          const h = e.question.candidate;
          if (truth === true) return log(L.answer.almostOther);
          if (c.frame === h.frame || truth === undefined) return log(L.answer.almostSameFrame);
          const hf = model.frameIndex.get(h.frame);
          return log(hf && hf.topic === f.topic ? L.answer.almostSameFrame / 2 : L.answer.almostOther / 2);
        }
        if (truth === undefined) return log(L.answer.almostSoftYes);
        return log(truth ? L.answer.almostSoftYes : L.answer.almostSoftNo);
      }
      if (truth === undefined) return Math.max(log(answerLik(true, e.answer, eps)), log(answerLik(false, e.answer, eps)));
      return log(answerLik(truth, e.answer, eps));
    }
    case "grid": {
      const key = candidateKey(c);
      const complete = f.slots.every((s) => s.name in c.slots);
      if (e.picked === null) {
        // «Нет» на всех показанных
        if (!complete) return log(1 - L.grid.noneEpsilon);
        return log(e.shown.includes(key) ? L.grid.noneEpsilon : 1 - L.grid.noneEpsilon);
      }
      if (!complete) return e.picked.split("|")[0] === c.frame ? log(L.grid.pick) : log(L.grid.pickOther);
      if (key === e.picked) return log(L.grid.pick);
      if (e.picked.split("|")[0] === c.frame) return log(L.grid.pickSameFrame);
      return log(L.grid.pickOther);
    }
  }
}

/** Правдоподобие свидетельства для псевдокандидата «ничего из этого». */
export function logLikOther(model: EngineModel, e: Evidence): number {
  return log((model.L.other.uniform as Record<string, number>)[e.kind] ?? 0.1);
}
