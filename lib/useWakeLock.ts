"use client";

import { useEffect } from "react";

/** Не даёт экрану погаснуть, пока открыт экран бабушки. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let alive = true;
    const request = async () => {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* браузер отказал (например, экономия батареи) */
      }
    };
    const onVisible = () => {
      if (alive && document.visibilityState === "visible") void request();
    };
    void request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release().catch(() => undefined);
    };
  }, [active]);
}
