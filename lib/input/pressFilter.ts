// Фильтр нажатий для экрана бабушки. Чистая логика без DOM, чтобы её можно было тестировать.
//
// Правила из ТЗ: срабатывание по pointerup; касания короче 60 мс игнорируются; повторное
// срабатывание в течение 800 мс игнорируется; мультитач и касание ладонью (большая площадь
// контакта) не срабатывают.

export interface PressConfig {
  minDurationMs: number;
  cooldownMs: number;
  /** Площадь контакта в px², выше которой касание считается ладонью. */
  maxContactArea: number;
}

export const DEFAULT_PRESS_CONFIG: PressConfig = {
  minDurationMs: 60,
  cooldownMs: 800,
  maxContactArea: 60 * 60,
};

export interface PointerSample {
  pointerId: number;
  time: number;
  /** Ширина и высота контакта; 0 или 1, если браузер их не сообщает. */
  width: number;
  height: number;
  /** Идентификатор цели (кнопки), на которой началось касание. */
  target: string;
}

export type PressRejection = "short" | "cooldown" | "multitouch" | "palm" | "moved-off" | "unknown";

export type PressOutcome = { fire: true; target: string } | { fire: false; reason: PressRejection };

interface Active {
  start: number;
  target: string;
  palm: boolean;
}

export class PressFilter {
  private readonly active = new Map<number, Active>();
  private tainted = false;
  private lastFire = Number.NEGATIVE_INFINITY;

  constructor(private readonly config: PressConfig = DEFAULT_PRESS_CONFIG) {}

  down(p: PointerSample): void {
    if (this.active.size > 0) this.tainted = true;
    const area = p.width > 1 && p.height > 1 ? p.width * p.height : 0;
    this.active.set(p.pointerId, { start: p.time, target: p.target, palm: area > this.config.maxContactArea });
  }

  /** Обновление контакта во время касания: ладонь может «расплыться» не сразу. */
  move(p: PointerSample): void {
    const a = this.active.get(p.pointerId);
    if (!a) return;
    const area = p.width > 1 && p.height > 1 ? p.width * p.height : 0;
    if (area > this.config.maxContactArea) a.palm = true;
  }

  /**
   * @param releasedOn цель, над которой палец поднят (null — вне любой цели).
   */
  up(p: PointerSample, releasedOn: string | null): PressOutcome {
    const a = this.active.get(p.pointerId);
    this.active.delete(p.pointerId);
    const wasTainted = this.tainted;
    if (this.active.size === 0) this.tainted = false;
    if (!a) return { fire: false, reason: "unknown" };
    if (wasTainted) return { fire: false, reason: "multitouch" };
    if (a.palm) return { fire: false, reason: "palm" };
    if (releasedOn !== a.target) return { fire: false, reason: "moved-off" };
    if (p.time - a.start < this.config.minDurationMs) return { fire: false, reason: "short" };
    if (p.time - this.lastFire < this.config.cooldownMs) return { fire: false, reason: "cooldown" };
    this.lastFire = p.time;
    return { fire: true, target: a.target };
  }

  cancel(pointerId: number): void {
    this.active.delete(pointerId);
    if (this.active.size === 0) this.tainted = false;
  }

  isPressing(target: string): boolean {
    for (const a of this.active.values()) if (a.target === target && !this.tainted && !a.palm) return true;
    return false;
  }
}
