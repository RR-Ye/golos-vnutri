"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { buildModel, type EngineModel, type LearnedCounts, type NlgOptions } from "@/engine";
import type { DayNote, Entity, RoutineItem, WordEntry } from "@/engine/types";
import { db } from "@/lib/db";
import type { Settings, TemplateOverride } from "@/lib/db/types";

export interface EngineData {
  entities: Entity[];
  words: WordEntry[];
  notes: DayNote[];
  routine: RoutineItem[];
  learned: LearnedCounts | undefined;
  overrides: TemplateOverride[];
}

export function useEngineData(): EngineData | undefined {
  return useLiveQuery(async () => {
    const d = db();
    const [entities, words, notes, routine, learned, overrides] = await Promise.all([
      d.entities.toArray(),
      d.words.toArray(),
      d.notes.toArray(),
      d.routine.toArray(),
      d.learned.get("main"),
      d.overrides.toArray(),
    ]);
    return { entities, words, notes, routine, learned, overrides };
  }, []);
}

/** Текущее время с шагом в 5 минут: модель пересобирается, когда меняется время суток. */
function useCoarseNow(stepMs = 5 * 60 * 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), stepMs);
    return () => clearInterval(t);
  }, [stepMs]);
  return now;
}

export function useEngineModel(settings: Settings, data: EngineData | undefined, context: string[]): EngineModel | null {
  const now = useCoarseNow();
  const contextKey = context.join(",");
  return useMemo(() => {
    if (!data) return null;
    return buildModel({
      entities: data.entities,
      words: data.words,
      notes: data.notes,
      routine: data.routine,
      frameToggles: settings.frameToggles,
      learned: data.learned,
      now,
      epsilon: settings.epsilon,
      context,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, settings.frameToggles, settings.epsilon, now, contextKey]);
}

export function nlgOptions(settings: Settings, overrides: TemplateOverride[] = []): NlgOptions {
  const map: Record<string, string> = {};
  for (const o of overrides) if (o.text) map[o.key] = o.text;
  return {
    speakerGender: settings.speakerGender,
    addressForm: settings.addressForm,
    softSignFeminineDeclines: settings.declineSoftSignNames,
    overrides: map,
  };
}
