"use client";

import type { Entity } from "@/engine/types";
import { useMediaUrl } from "@/lib/db/media";
import { Icon } from "./Icon";

const PLACEHOLDER_TONES = ["#d2e8ef", "#e3e0f0", "#dcebd9", "#f1e3d3", "#e5e9ec", "#efdbe0"];

function toneFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_TONES[h % PLACEHOLDER_TONES.length]!;
}

/** Фото сущности; если фото нет — иконка, а для людей заглушка с первой буквой имени. */
export function EntityPicture({
  entity,
  size,
  className = "",
  lang = "ru",
}: {
  entity: Pick<Entity, "id" | "type" | "photo" | "icon" | "name">;
  size: number;
  className?: string;
  lang?: "ru" | "kk";
}) {
  const url = useMediaUrl(entity.photo);
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        aria-hidden
        draggable={false}
        width={size}
        height={size}
        className={`rounded-xl object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  if (entity.type === "person" || !entity.icon) {
    const letter = (entity.name[lang] || entity.name.ru || "?").slice(0, 1).toUpperCase();
    return (
      <div
        aria-hidden
        className={`flex items-center justify-center rounded-xl font-semibold text-ink ${className}`}
        style={{ width: size, height: size, background: toneFor(entity.id), fontSize: size * 0.46 }}
      >
        {letter}
      </div>
    );
  }
  return <Icon id={entity.icon} size={size} className={className} />;
}
