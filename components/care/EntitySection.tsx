"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import type { Entity, EntityType, RuGender, SoundMode, TimeBand } from "@/engine/types";
import { TIME_BANDS } from "@/engine/types";
import { db, newId } from "@/lib/db";
import { deleteMedia } from "@/lib/db/media";
import { t } from "@/lib/i18n";
import { EntityPicture } from "../EntityPicture";
import { PhotoPicker } from "./PhotoPicker";
import { Btn, Choice, Field, Rows, SectionHeader, Select, TextInput, Toggle } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

type EditableType = Extract<EntityType, "person" | "place" | "thing" | "food" | "medicine" | "event">;

const DEFAULT_ICON: Record<EditableType, string | undefined> = {
  person: undefined,
  place: "pin",
  thing: "box",
  food: "food",
  medicine: "pill",
  event: "thought",
};

const RU_FORM_KEYS: Record<EditableType, string[]> = {
  person: ["gen", "dat", "acc", "ins", "pre"],
  place: ["acc", "pre", "dir", "loc"],
  thing: ["gen", "acc", "pre"],
  food: ["gen", "acc", "pre"],
  medicine: ["gen", "acc", "pre"],
  event: ["acc", "pre"],
};
const KK_FORM_KEYS = ["gen", "dat", "acc", "loc", "abl", "ins"];

const SOUND_MODES: SoundMode[] = ["ru", "ru-kk", "kk-ru", "kk"];

export function blankEntity(type: EditableType): Entity {
  return {
    id: newId(type.slice(0, 2)),
    type,
    name: { ru: "", kk: "" },
    ruMorph: { gender: type === "person" ? "f" : "m", animate: type === "person" },
    icon: DEFAULT_ICON[type],
    develop: type === "person",
  };
}

export function EntitySection({ type, title, lead }: { type: EditableType; title: string; lead: string }) {
  const items = useLiveQuery(() => db().entities.where("type").equals(type).sortBy("order"), [type]);
  const [editing, setEditing] = useState<Entity | null>(null);

  if (editing) {
    return <EntityEditor key={editing.id} initial={editing} onDone={() => setEditing(null)} />;
  }

  return (
    <section>
      <SectionHeader title={title} lead={lead} />
      <Rows>
        {items?.length === 0 && <p className="py-4 text-ink-2">{t.care.common.empty}</p>}
        {items?.map((e) => (
          <button
            key={e.id}
            type="button"
            onClick={() => setEditing(e)}
            className="flex w-full items-center gap-4 py-3 text-left hover:bg-surface-2"
          >
            <EntityPicture entity={e} size={56} />
            <span className="flex flex-col">
              <span className="text-[18px] font-medium">
                {e.name.ru || "—"}
                {e.name.kk && e.name.kk !== e.name.ru && <span className="font-normal text-ink-2"> / {e.name.kk}</span>}
              </span>
              {e.relation && <span className="text-[15px] text-ink-2">{e.relation}</span>}
              {e.hidden && <span className="text-[14px] text-ink-2">{t.care.common.hidden}</span>}
            </span>
          </button>
        ))}
      </Rows>
      <div className="mt-4">
        <Btn
          tone="primary"
          onClick={() => {
            const fresh = blankEntity(type);
            fresh.order = (items?.length ?? 0) + 1;
            setEditing(fresh);
          }}
        >
          {t.care.common.add}
        </Btn>
      </div>
    </section>
  );
}

function EntityEditor({ initial, onDone }: { initial: Entity; onDone: () => void }) {
  const [e, setE] = useState<Entity>(initial);
  const type = e.type as EditableType;
  const set = (patch: Partial<Entity>) => setE((prev) => ({ ...prev, ...patch }));
  const setForm = (lang: "ru" | "kk", key: string, value: string) =>
    setE((prev) => {
      const forms = { ru: { ...prev.forms?.ru }, kk: { ...prev.forms?.kk } };
      if (value.trim()) forms[lang][key] = value.trim();
      else delete forms[lang][key];
      return { ...prev, forms };
    });

  // Фото и записи сохраняются сразу, чтобы не потерять их при уходе со страницы.
  const persistNow = async (patch: Partial<Entity>) => {
    const next = { ...e, ...patch };
    setE(next);
    if (next.name.ru || next.name.kk) await db().entities.put(next);
  };

  const canSave = e.name.ru.trim() !== "" || e.name.kk.trim() !== "";

  return (
    <section className="max-w-[720px]">
      <Btn tone="quiet" onClick={onDone}>
        {t.care.common.back}
      </Btn>
      <div className="mt-2">
        <Field label={t.care.common.nameRu}>
          {(id) => <TextInput id={id} value={e.name.ru} onChange={(v) => set({ name: { ...e.name, ru: v.target.value } })} />}
        </Field>
        <Field label={t.care.common.nameKk}>
          {(id) => <TextInput id={id} lang="kk" value={e.name.kk} onChange={(v) => set({ name: { ...e.name, kk: v.target.value } })} />}
        </Field>
        {type === "person" && (
          <Field label={t.care.people.relation}>
            {(id) => <TextInput id={id} value={e.relation ?? ""} onChange={(v) => set({ relation: v.target.value })} />}
          </Field>
        )}
        <PhotoPicker entity={e} onChange={(photo) => void persistNow({ photo })} />

        <div className="flex flex-col gap-3 py-3">
          <span className="text-[15px] font-medium">{t.care.common.voice}</span>
          <span className="-mt-2 text-[14px] text-ink-2">{t.care.common.voiceHint}</span>
          <VoiceRecorder
            label={t.care.languages.lang.ru}
            value={e.audio?.ru}
            onChange={(ru) => void persistNow({ audio: { ...e.audio, ru } })}
          />
          <VoiceRecorder
            label={t.care.languages.lang.kk}
            value={e.audio?.kk}
            onChange={(kk) => void persistNow({ audio: { ...e.audio, kk } })}
          />
        </div>

        <Field label={t.care.common.soundMode}>
          {(id) => (
            <Select
              id={id}
              value={e.soundMode ?? ""}
              onChange={(v) => set({ soundMode: (v.target.value || undefined) as SoundMode | undefined })}
            >
              <option value="">{t.care.common.soundModeInherit}</option>
              {SOUND_MODES.map((m) => (
                <option key={m} value={m}>
                  {t.care.languages.modes[m]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Toggle
          checked={!!e.develop}
          onChange={(develop) => set({ develop })}
          label={t.care.common.develop}
          hint={t.care.common.developHint}
        />

        {type === "medicine" && (
          <div className="py-3">
            <span className="text-[15px] font-medium">{t.care.medicine.schedule}</span>
            <div className="mt-2 flex flex-wrap gap-x-6">
              {TIME_BANDS.map((b: TimeBand) => (
                <Toggle
                  key={b}
                  checked={!!e.schedule?.includes(b)}
                  label={t.care.timeBands[b]}
                  onChange={(on) =>
                    set({ schedule: on ? [...(e.schedule ?? []), b] : (e.schedule ?? []).filter((x) => x !== b) })
                  }
                />
              ))}
            </div>
          </div>
        )}

        <details className="border-t border-line py-3">
          <summary className="min-h-11 cursor-pointer py-2 text-[16px] font-medium">{t.care.common.morphology}</summary>
          <p className="mb-2 text-[14px] text-ink-2">{t.care.common.morphologyHint}</p>
          <Field label={t.care.common.genderLabel}>
            {() => (
              <Choice<RuGender>
                name={t.care.common.genderLabel}
                value={e.ruMorph?.gender ?? "m"}
                options={(["m", "f", "n"] as const).map((g) => ({ value: g, label: t.care.common.gender[g] }))}
                onChange={(gender) => set({ ruMorph: { ...e.ruMorph, gender } })}
              />
            )}
          </Field>
          <Toggle
            checked={!!e.ruMorph?.pluralOnly}
            onChange={(pluralOnly) => set({ ruMorph: { gender: e.ruMorph?.gender ?? "m", ...e.ruMorph, pluralOnly } })}
            label={t.care.common.pluralOnly}
          />
          <Toggle
            checked={!!e.ruMorph?.indeclinable}
            onChange={(indeclinable) =>
              set({ ruMorph: { gender: e.ruMorph?.gender ?? "m", ...e.ruMorph, indeclinable } })
            }
            label={t.care.common.indeclinable}
          />
          <div className="grid gap-x-6 sm:grid-cols-2">
            {RU_FORM_KEYS[type].map((k) => (
              <Field key={`ru-${k}`} label={t.care.forms.ru[k as keyof typeof t.care.forms.ru]}>
                {(id) => (
                  <TextInput id={id} value={e.forms?.ru?.[k] ?? ""} onChange={(v) => setForm("ru", k, v.target.value)} />
                )}
              </Field>
            ))}
            {KK_FORM_KEYS.map((k) => (
              <Field key={`kk-${k}`} label={t.care.forms.kk[k as keyof typeof t.care.forms.kk]}>
                {(id) => (
                  <TextInput
                    id={id}
                    lang="kk"
                    value={e.forms?.kk?.[k] ?? ""}
                    onChange={(v) => setForm("kk", k, v.target.value)}
                  />
                )}
              </Field>
            ))}
          </div>
        </details>

        <Toggle checked={!!e.hidden} onChange={(hidden) => set({ hidden })} label={t.care.common.hidden} />
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
        <Btn
          tone="primary"
          disabled={!canSave}
          onClick={async () => {
            await db().entities.put({ ...e, name: { ru: e.name.ru.trim(), kk: e.name.kk.trim() } });
            onDone();
          }}
        >
          {t.care.common.save}
        </Btn>
        <Btn onClick={onDone}>{t.care.common.cancel}</Btn>
        <Btn
          tone="danger"
          className="ml-auto"
          onClick={async () => {
            if (!window.confirm(t.care.common.deleteConfirm)) return;
            await deleteMedia(e.photo);
            await deleteMedia(e.audio?.ru);
            await deleteMedia(e.audio?.kk);
            await db().entities.delete(e.id);
            onDone();
          }}
        >
          {t.care.common.delete}
        </Btn>
      </div>
    </section>
  );
}
