"use client";

import { useEffect } from "react";

/** Регистрирует service worker в собранной версии и просит браузер не стирать данные. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* без service worker приложение работает, но не офлайн */
      });
    }
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);
  return null;
}
