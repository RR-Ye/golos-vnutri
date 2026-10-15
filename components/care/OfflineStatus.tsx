"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

/** Проверяет, что service worker активен и все файлы приложения лежат в кэше. */
export function OfflineStatus() {
  const [ready, setReady] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return setReady(false);
        const list = (await (await fetch("/precache.json")).json()) as { shell: string; voices: string; files: string[] };
        const shell = await caches.open(list.shell);
        const voices = await caches.open(list.voices);
        let missing = 0;
        for (const f of list.files) if (!(await shell.match(f)) && !(await voices.match(f))) missing++;
        if (alive) setReady(missing === 0);
      } catch {
        if (alive) setReady(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (ready === null) return null;
  return (
    <p data-testid="offline-status" className={`rounded-lg border px-4 py-3 text-[16px] ${ready ? "border-ok/40 text-ok" : "border-danger/40 text-danger"}`}>
      {ready ? t.care.offline.ready : t.care.offline.notReady}
    </p>
  );
}
