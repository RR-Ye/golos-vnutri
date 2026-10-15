"use client";

import { useId } from "react";
import type { Entity } from "@/engine/types";
import { deleteMedia, putMedia, resizePhoto } from "@/lib/db/media";
import { t } from "@/lib/i18n";
import { EntityPicture } from "../EntityPicture";
import { Btn } from "./ui";

export function PhotoPicker({
  entity,
  onChange,
}: {
  entity: Pick<Entity, "id" | "type" | "photo" | "icon" | "name">;
  onChange: (photo: string | undefined) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-4 py-3">
      <EntityPicture entity={entity} size={96} />
      <div className="flex flex-wrap gap-2">
        <label
          htmlFor={id}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-line bg-surface px-5 text-[17px] font-medium hover:bg-surface-2"
        >
          {t.care.common.photoAdd}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const small = await resizePhoto(file);
            const mediaId = await putMedia(small, "photo");
            await deleteMedia(entity.photo);
            onChange(mediaId);
            e.target.value = "";
          }}
        />
        {entity.photo && (
          <Btn
            tone="quiet"
            onClick={async () => {
              await deleteMedia(entity.photo);
              onChange(undefined);
            }}
          >
            {t.care.common.photoRemove}
          </Btn>
        )}
      </div>
    </div>
  );
}
