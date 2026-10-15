"use client";

import { useEffect, useRef, useState } from "react";
import { Press } from "./Press";

export type BodySide = "front" | "back";

interface Zone {
  entity: string;
  x: number;
  y: number;
  w: number;
  h: number;
  round?: boolean;
}

// Фигура из крупных блоков: каждый не меньше 120×120 и с промежутками 24 px.
// Спереди её правая рука и нога — слева от зрителя, сзади — как у неё самой.
export const FIGURE_W = 488;
export const FIGURE_H = 752;

const ZONES: Record<BodySide, Zone[]> = {
  front: [
    { entity: "body.head", x: 179, y: 0, w: 130, h: 130, round: true },
    { entity: "body.chest", x: 144, y: 154, w: 200, h: 150 },
    { entity: "body.belly", x: 144, y: 328, w: 200, h: 150 },
    { entity: "body.rarm", x: 0, y: 154, w: 120, h: 324 },
    { entity: "body.larm", x: 368, y: 154, w: 120, h: 324 },
    { entity: "body.rleg", x: 0, y: 502, w: 232, h: 250 },
    { entity: "body.lleg", x: 256, y: 502, w: 232, h: 250 },
  ],
  back: [
    { entity: "body.head", x: 179, y: 0, w: 130, h: 130, round: true },
    { entity: "body.back", x: 144, y: 154, w: 200, h: 150 },
    { entity: "body.lowback", x: 144, y: 328, w: 200, h: 150 },
    { entity: "body.larm", x: 0, y: 154, w: 120, h: 324 },
    { entity: "body.rarm", x: 368, y: 154, w: 120, h: 324 },
    { entity: "body.lleg", x: 0, y: 502, w: 232, h: 250 },
    { entity: "body.rleg", x: 256, y: 502, w: 232, h: 250 },
  ],
};

export function zonesOf(side: BodySide): string[] {
  return ZONES[side].map((z) => z.entity);
}

/** Масштаб под доступное место, но не мельче, чем позволяют цели 120×120. */
function useFit(ref: React.RefObject<HTMLDivElement | null>): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const s = Math.min(1, el.clientWidth / FIGURE_W, el.clientHeight / FIGURE_H);
      setScale(Math.max(0.6, s));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

export function BodyFigure({
  side,
  labels,
  onZone,
  selected,
}: {
  side: BodySide;
  labels: Record<string, string>;
  onZone: (entity: string) => void;
  selected?: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const scale = useFit(box);
  return (
    <div ref={box} className="flex h-full w-full items-center justify-center">
      <div className="relative shrink-0" style={{ width: FIGURE_W * scale, height: FIGURE_H * scale }}>
        {ZONES[side].map((z) => (
          <Press
            key={z.entity}
            label={labels[z.entity] ?? z.entity}
            testId={`zone-${z.entity}`}
            onPress={() => onZone(z.entity)}
            className={`absolute flex items-end justify-center border-[3px] pb-2 ${z.round ? "rounded-full items-center pb-0" : "rounded-[28px]"} ${
              selected === z.entity ? "border-accent bg-accent-soft" : "border-[#c9a88f] bg-[#f3e1d3]"
            }`}
            style={{ left: z.x * scale, top: z.y * scale, width: z.w * scale, height: z.h * scale }}
          >
            <span className="px-1 text-center text-[15px] leading-tight font-medium text-[#5a4130]">{labels[z.entity]}</span>
          </Press>
        ))}
      </div>
    </div>
  );
}

/** Маленькая фигура с подсвеченной зоной — картинка для вопросов и плиток. */
export function BodyMini({ zone, size }: { zone: string; size: number }) {
  const side: BodySide = ZONES.back.some((z) => z.entity === zone) && !ZONES.front.some((z) => z.entity === zone) ? "back" : "front";
  const faceZones: Record<string, [number, number, number, number]> = {
    "body.eyes": [204, 40, 80, 26],
    "body.ears": [170, 46, 148, 30],
    "body.teeth": [214, 84, 60, 24],
    "body.throat": [214, 132, 60, 20],
  };
  const hi = "var(--accent)";
  const skin = zone === "body.skin";
  return (
    <svg width={size} height={size} viewBox="-60 -10 608 772" aria-hidden>
      {ZONES[side].map((z) =>
        z.round ? (
          <circle key={z.entity} cx={z.x + z.w / 2} cy={z.y + z.h / 2} r={z.w / 2} fill={z.entity === zone || skin ? hi : "#f3e1d3"} stroke="#c9a88f" strokeWidth="8" />
        ) : (
          <rect key={z.entity} x={z.x} y={z.y} width={z.w} height={z.h} rx="28" fill={z.entity === zone || skin ? hi : "#f3e1d3"} stroke="#c9a88f" strokeWidth="8" />
        ),
      )}
      {faceZones[zone] && <rect x={faceZones[zone]![0]} y={faceZones[zone]![1]} width={faceZones[zone]![2]} height={faceZones[zone]![3]} rx="10" fill={hi} />}
    </svg>
  );
}
