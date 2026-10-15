"use client";

import { useEffect } from "react";

/**
 * Невидимая зона в правом верхнем углу: удержание 3 секунды открывает вход для близких.
 * Зона не перекрывает кнопки: слушаем касания на уровне окна и пропускаем их дальше.
 * Долгое нажатие допустимо только здесь — бабушке оно не нужно.
 */
export function CornerHold({
  onUnlock,
  holdMs = 3000,
  size = 72,
  side = "right",
}: {
  onUnlock: () => void;
  holdMs?: number;
  size?: number;
  side?: "right" | "left";
}) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pointer: number | null = null;
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      pointer = null;
    };
    const inZone = (x: number, y: number) =>
      y <= size && (side === "right" ? x >= window.innerWidth - size : x <= size);
    const down = (e: PointerEvent) => {
      if (!inZone(e.clientX, e.clientY)) return;
      clear();
      pointer = e.pointerId;
      timer = setTimeout(() => {
        clear();
        onUnlock();
      }, holdMs);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId === pointer && !inZone(e.clientX, e.clientY)) clear();
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId === pointer) clear();
    };
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointermove", move, true);
    window.addEventListener("pointerup", up, true);
    window.addEventListener("pointercancel", up, true);
    return () => {
      clear();
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointermove", move, true);
      window.removeEventListener("pointerup", up, true);
      window.removeEventListener("pointercancel", up, true);
    };
  }, [onUnlock, holdMs, size, side]);
  return null;
}
