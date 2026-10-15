// Что показать на подэкране темы: мысли и сущности в порядке их текущей вероятности.
import { frameTopics } from "../ontology/index.ts";
import type { EntityType, TopicId } from "../types.ts";
import type { EngineModel } from "./model.ts";
import type { Posterior } from "./types.ts";

/**
 * Фреймы темы по убыванию маргинальной вероятности (с учётом априора, если её нет в луче).
 * Фреймы с обязательным слотом показываются, только если этот слот нельзя выбрать фото
 * прямо в теме (например, «Сделай…» в потребностях, «Скучаю по…» в чувствах).
 */
export function topicFrames(model: EngineModel, post: Posterior, topic: TopicId, photoTypes: readonly EntityType[] = []): string[] {
  const mass = new Map<string, number>();
  for (const r of post.ranked) mass.set(r.candidate.frame, (mass.get(r.candidate.frame) ?? 0) + r.p);
  return model.frames
    .filter(
      (f) =>
        frameTopics(f).includes(topic) &&
        f.slots.every((s) => s.optional || (!s.types.includes("bodypart") && !s.types.includes("severity") && !s.types.some((t) => photoTypes.includes(t)))),
    )
    .map((f) => ({ id: f.id, m: (mass.get(f.id) ?? 0) + Math.exp(model.logFramePrior.get(f.id) ?? -Infinity) * 1e-3 }))
    .sort((a, b) => b.m - a.m)
    .map((x) => x.id);
}

/** Сущности заданных типов по убыванию маргинальной вероятности, затем по порядку анкеты. */
export function rankedEntities(model: EngineModel, post: Posterior, types: readonly EntityType[]): string[] {
  const mass = new Map<string, number>();
  for (const r of post.ranked) {
    for (const v of Object.values(r.candidate.slots)) if (v) mass.set(v, (mass.get(v) ?? 0) + r.p);
  }
  return types
    .flatMap((t) => model.byType.get(t) ?? [])
    .filter((e) => !e.hidden)
    .map((e) => ({ id: e.id, m: mass.get(e.id) ?? 0, w: model.entityWeight.get(e.id) ?? 1, o: e.order ?? 999 }))
    .sort((a, b) => b.m - a.m || b.w - a.w || a.o - b.o)
    .map((x) => x.id);
}
