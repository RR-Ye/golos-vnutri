// Набор карточек для развития речи: слова для развития, имена родных, её словарь.
import { frameById } from "@/engine/ontology";
import type { Bilingual, Entity, SoundMode, WordEntry } from "@/engine/types";
import type { SoundCategory } from "@/lib/db/types";

export interface PracticeItem {
  key: string;
  text: Bilingual;
  audio?: Partial<Record<"ru" | "kk", string>>;
  mode?: SoundMode;
  develop: boolean;
  category: SoundCategory;
  /** Картинка: сущность (фото) или иконка. */
  entity?: Entity;
  icon?: string;
}

export function practiceItems(entities: readonly Entity[], words: readonly WordEntry[]): PracticeItem[] {
  const out: PracticeItem[] = [];
  for (const e of entities) {
    if (e.hidden) continue;
    if (!(e.develop || e.type === "person")) continue;
    out.push({
      key: `entity:${e.id}`,
      text: e.name,
      audio: e.audio,
      mode: e.soundMode,
      develop: !!e.develop,
      category: e.type === "person" ? "people" : "words",
      entity: e,
    });
  }
  for (const w of words) {
    const text: Bilingual = w.lang === "ru" ? { ru: w.text, kk: w.translation ?? "" } : { kk: w.text, ru: w.translation ?? "" };
    const ent = w.meanings.find((m) => m.target.kind === "entity");
    const frame = w.meanings.find((m) => m.target.kind === "frame");
    const entity = ent && ent.target.kind === "entity" ? entities.find((e) => e.id === (ent.target as { entity: string }).entity) : undefined;
    // имя, уже вошедшее как карточка человека, не дублируем
    if (entity && out.some((o) => o.key === `entity:${entity.id}`)) continue;
    out.push({
      key: `word:${w.id}`,
      text,
      audio: w.audio ? { [w.lang]: w.audio } : undefined,
      mode: w.soundMode,
      develop: w.develop,
      category: "words",
      entity,
      icon: frame && frame.target.kind === "frame" ? (frameById(frame.target.frame)?.icon ?? "chat") : "chat",
    });
  }
  return out;
}
