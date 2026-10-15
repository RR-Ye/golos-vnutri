// Содержимое экранов бабушки: какие плитки показать в теме и после выбора фото.
// Общая логика для интерфейса и симулятора — чтобы симулятор проверял то же, что видит она.
import { frameTopics } from "../ontology/index.ts";
import { rankedEntities, topicFrames } from "../inference/items.ts";
import type { EngineModel } from "../inference/model.ts";
import type { Evidence, Posterior } from "../inference/types.ts";
import type { Decision } from "../questions/index.ts";
import type { EntityType, TopicId } from "../types.ts";

export type FlowTile =
  | { kind: "frame"; frame: string }
  /** Догадка по её истории: целая мысль одной плиткой. */
  | { kind: "candidate"; key: string }
  | { kind: "topic"; topic: TopicId }
  | { kind: "entity"; entity: string }
  | { kind: "body" }
  | { kind: "faces" }
  | { kind: "more" };

export function tileKey(t: FlowTile): string {
  switch (t.kind) {
    case "frame":
      return `f:${t.frame}`;
    case "entity":
      return `e:${t.entity}`;
    case "candidate":
      return `c:${t.key}`;
    case "topic":
      return `t:${t.topic}`;
    default:
      return t.kind;
  }
}

/**
 * Главный экран: темы, а первой — догадка, если по её истории одна мысль заметно вероятнее
 * остальных в это время суток. Появляется только после обучения.
 */
export function homeTiles(model: EngineModel, prior: Posterior, topics: readonly TopicId[]): FlowTile[] {
  const tiles: FlowTile[] = topics.map((topic) => ({ kind: "topic", topic }));
  const top = prior.ranked[0];
  if (top && top.p >= model.L.policy.suggestMinP) tiles.unshift({ kind: "candidate", key: top.key });
  return tiles;
}

/** Какие фото показывать в теме. */
const TOPIC_ENTITY_TYPES: Partial<Record<TopicId, EntityType[]>> = {
  people: ["person"],
  things: ["thing", "food", "medicine"],
  places: ["place"],
  memories: ["event", "person"],
};

/** Полный список плиток темы в порядке показа (листание — paginate). */
export function topicTiles(model: EngineModel, post: Posterior, topic: TopicId): FlowTile[] {
  const pinned: FlowTile[] = [];
  if (topic === "health") pinned.push({ kind: "body" }, { kind: "faces" });
  if (topic === "feelings") pinned.push({ kind: "faces" });

  const types = TOPIC_ENTITY_TYPES[topic];
  const frames = topicFrames(model, post, topic, types ?? []).map((frame): FlowTile => ({ kind: "frame", frame }));
  const entities = types ? rankedEntities(model, post, types).map((entity): FlowTile => ({ kind: "entity", entity })) : [];

  // Для тем людей, вещей и воспоминаний фото важнее, для остальных — мысли.
  const photosFirst = topic === "people" || topic === "things" || topic === "memories";
  if (topic === "health") {
    const meds = rankedEntities(model, post, ["medicine"]).map((entity): FlowTile => ({ kind: "entity", entity }));
    return [...pinned, ...frames, ...meds];
  }
  return [...pinned, ...(photosFirst ? [...entities, ...frames] : [...frames, ...entities])];
}

/** Мысль с незаполненным слотом («Позвонить…», «Сделай…»): кого или что выбрать. */
export function slotChoiceTiles(model: EngineModel, post: Posterior, frameId: string): FlowTile[] {
  const f = model.frameIndex.get(frameId);
  const slot = f?.slots.find((sl) => !sl.optional && !sl.types.includes("severity"));
  if (!f || !slot) return [];
  const mass = new Map<string, number>();
  for (const r of post.ranked) {
    if (r.candidate.frame !== frameId) continue;
    const v = r.candidate.slots[slot.name];
    if (v) mass.set(v, (mass.get(v) ?? 0) + r.p);
  }
  return rankedEntities(model, post, slot.types)
    .map((id, i) => ({ id, m: mass.get(id) ?? 0, i }))
    .sort((a, b) => b.m - a.m || a.i - b.i)
    .map((x): FlowTile => ({ kind: "entity", entity: x.id }));
}

/** Нужно ли после нажатия на плитку мысли показать выбор «кого / что». */
export function needsSlotChoice(model: EngineModel, decision: Decision, last: Evidence | undefined): boolean {
  if (last?.kind !== "frame" || decision.kind === "accept" || decision.kind === "confirm") return false;
  const f = model.frameIndex.get(last.frame);
  return !!f?.slots.some((sl) => !sl.optional && !sl.types.includes("severity"));
}

/** После выбора фото: мысли, в которых участвует эта сущность, по вероятности. */
export function entityActionTiles(model: EngineModel, post: Posterior, entityId: string): FlowTile[] {
  const e = model.entities.get(entityId);
  if (!e) return [];
  const mass = new Map<string, number>();
  for (const r of post.ranked) {
    if (Object.values(r.candidate.slots).includes(entityId)) mass.set(r.candidate.frame, (mass.get(r.candidate.frame) ?? 0) + r.p);
  }
  return model.frames
    .filter((f) => f.slots.some((s) => s.types.includes(e.type)))
    .map((f) => ({ id: f.id, m: mass.get(f.id) ?? 0, p: Math.exp(model.logFramePrior.get(f.id) ?? -Infinity) }))
    .sort((a, b) => b.m - a.m || b.p - a.p)
    .map((x): FlowTile => ({ kind: "frame", frame: x.id }));
}

export interface Page {
  tiles: FlowTile[];
  pages: number;
}

/** Листание без прокрутки: если не помещается, последняя плитка — «Ещё». */
export function paginate(all: readonly FlowTile[], perPage: number, page: number): Page {
  if (all.length <= perPage) return { tiles: [...all], pages: 1 };
  const size = perPage - 1;
  const pages = Math.ceil(all.length / size);
  const p = ((page % pages) + pages) % pages;
  return { tiles: [...all.slice(p * size, p * size + size), { kind: "more" }], pages };
}

/**
 * После выбора фото человека или вещи спрашивать «да/нет» долго: проще показать картинки
 * с тем, что можно с ним сделать. Возвращает true, если стоит показать такой экран.
 */
export function preferEntityActions(decision: Decision, last: Evidence | undefined, actions: readonly FlowTile[]): boolean {
  return decision.kind === "ask" && last?.kind === "entity" && actions.length >= 2;
}

/** Основная тема фрейма (для симулятора и подсказок). */
export function mainTopic(model: EngineModel, frameId: string): TopicId | undefined {
  const f = model.frameIndex.get(frameId);
  return f ? (frameTopics(f)[0] as TopicId) : undefined;
}
