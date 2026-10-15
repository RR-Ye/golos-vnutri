"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./index";
import { saveSettings } from "./settings";
import type { Settings } from "./types";

/** Настройки из базы. undefined — ещё загружаются, null — первый запуск. */
export function useSettings(): [Settings | null | undefined, (patch: Partial<Settings>) => Promise<Settings>] {
  const s = useLiveQuery(async () => (await db().settings.get("main")) ?? null, []);
  return [s, saveSettings];
}
