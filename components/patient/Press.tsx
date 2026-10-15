"use client";

import { useCallback, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { PressFilter } from "@/lib/input/pressFilter";

// Один фильтр на весь экран: пауза 800 мс и мультитач считаются глобально.
const filter = new PressFilter();
const TARGET_ATTR = "data-press-id";

function targetAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  const owner = el?.closest(`[${TARGET_ATTR}]`);
  return owner?.getAttribute(TARGET_ATTR) ?? null;
}

export interface PressProps {
  onPress: () => void;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Подпись для экранного диктора и тестов. */
  label: string;
  disabled?: boolean;
  testId?: string;
}

/** Кнопка экрана бабушки: срабатывает только по правилам PressFilter. */
export function Press({ onPress, children, className, style, label, disabled, testId }: PressProps) {
  const id = useId();
  const [pressed, setPressed] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const sample = (e: React.PointerEvent) => ({
    pointerId: e.pointerId,
    time: e.timeStamp,
    width: e.width,
    height: e.height,
    target: id,
  });

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled) return;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
      filter.down(sample(e));
      setPressed(filter.isPressing(id));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, id],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      setPressed(false);
      if (disabled) return;
      const outcome = filter.up(sample(e), targetAt(e.clientX, e.clientY));
      if (outcome.fire) onPress();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disabled, id, onPress],
  );

  return (
    <button
      ref={ref}
      type="button"
      {...{ [TARGET_ATTR]: id }}
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-testid={testId}
      data-pressed={pressed}
      className={`press-feedback ${className ?? ""}`}
      style={style}
      onPointerDown={onPointerDown}
      onPointerMove={(e) => filter.move(sample(e))}
      onPointerUp={onPointerUp}
      onPointerCancel={(e) => {
        filter.cancel(e.pointerId);
        setPressed(false);
      }}
      onPointerLeave={() => setPressed(false)}
      onClick={(e) => {
        // Клавиатура (Enter/Пробел) даёт click без указателя: для доступности оставляем.
        if (e.detail === 0 && !disabled) onPress();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
