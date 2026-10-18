"use client";

import { useEffect } from "react";
import { inAndroidApp } from "@/lib/android";
import { href } from "@/lib/base";

/** Регистрирует service worker в собранной версии и просит браузер не стирать данные. */
export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    // В APK все файлы уже внутри приложения.
    if ("serviceWorker" in navigator && !inAndroidApp()) {
      navigator.serviceWorker.register(href("/sw.js"), { scope: href("/") }).catch(() => {
        /* без service worker приложение работает, но не офлайн */
      });
    }
    navigator.storage?.persist?.().catch(() => undefined);
  }, []);
  return null;
}
