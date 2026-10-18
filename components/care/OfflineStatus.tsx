"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { inAndroidApp } from "@/lib/android";
import { href } from "@/lib/base";

type Status = "ready" | "noVoices" | "notReady";

/** Проверяет, что service worker активен и все файлы приложения лежат в кэше. */
export function OfflineStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (inAndroidApp()) return setStatus("ready"); // в APK всё внутри приложения
        if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) return setStatus("notReady");
        const list = (await (await fetch(href("/precache.json"))).json()) as { shell: string; voices: string; files: string[] };
        const shell = await caches.open(list.shell);
        const voices = await caches.open(list.voices);
        let missingShell = 0;
        let missingVoices = 0;
        for (const f of list.files) {
          if (f.startsWith(href("/voices/"))) missingVoices += (await voices.match(f)) ? 0 : 1;
          else missingShell += (await shell.match(f)) ? 0 : 1;
        }
        if (alive) setStatus(missingShell ? "notReady" : missingVoices ? "noVoices" : "ready");
      } catch {
        if (alive) setStatus("notReady");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  if (status === null) return null;
  const ok = status === "ready";
  return (
    <p data-testid="offline-status" className={`rounded-lg border px-4 py-3 text-[16px] ${ok ? "border-ok/40 text-ok" : "border-danger/40 text-danger"}`}>
      {t.care.offline[status]}
    </p>
  );
}
