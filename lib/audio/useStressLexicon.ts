"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useEffect } from "react";
import { db } from "@/lib/db";
import { buildLexicon, setStressLexicon } from "./stress";

/** Держит словарь ударений синтеза в согласии с анкетой (ударения из карточек). */
export function useStressLexicon(): void {
  const entities = useLiveQuery(() => db().entities.toArray(), []);
  useEffect(() => {
    if (entities) setStressLexicon(buildLexicon(entities));
  }, [entities]);
}
