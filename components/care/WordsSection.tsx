"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { FRAMES, TOPICS, frameLabel } from "@/engine/ontology";
import type { Lang, MeaningTarget, SoundMode, WordEntry, WordMeaning } from "@/engine/types";
import { db, newId } from "@/lib/db";
import { deleteMedia, putMedia } from "@/lib/db/media";
import { fmt, t } from "@/lib/i18n";
import { Btn, Choice, Field, Rows, SectionHeader, Select, TextInput, Toggle } from "./ui";
import { featuresFromPcm } from "@/lib/audio/asr";
import { PlayButton, useRecorder, VoiceRecorder } from "./VoiceRecorder";

export const MAX_SAMPLES = 10;

export function targetKey(t: MeaningTarget): string {
  return t.kind === "frame" ? `frame:${t.frame}` : t.kind === "topic" ? `topic:${t.topic}` : `entity:${t.entity}`;
}

export function parseTargetKey(key: string): MeaningTarget | null {
  const [kind, id] = key.split(":", 2) as [string, string | undefined];
  if (!id) return null;
  if (kind === "frame") return { kind: "frame", frame: id };
  if (kind === "topic") return { kind: "topic", topic: id as never };
  if (kind === "entity") return { kind: "entity", entity: id };
  return null;
}

export function WordsSection({ openWordId }: { openWordId?: string | null } = {}) {
  const words = useLiveQuery(() => db().words.orderBy("text").toArray(), []);
  const counts = useLiveQuery(async () => {
    const all = await db().samples.toArray();
    const m: Record<string, number> = {};
    for (const s of all) m[s.wordId] = (m[s.wordId] ?? 0) + 1;
    return m;
  }, []);
  const [editing, setEditing] = useState<WordEntry | null>(null);
  const [opened, setOpened] = useState(false);
  if (!opened && openWordId && words) {
    const w = words.find((x) => x.id === openWordId);
    if (w) {
      setOpened(true);
      setEditing(w);
    }
  }

  if (editing) return <WordEditor key={editing.id} initial={editing} onDone={() => setEditing(null)} />;

  return (
    <section>
      <SectionHeader title={t.care.nav.words} lead={t.care.words.lead} />
      <Rows>
        {words?.length === 0 && <p className="py-4 text-ink-2">{t.care.common.empty}</p>}
        {words?.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setEditing(w)}
            className="flex w-full flex-wrap items-baseline gap-x-4 gap-y-1 py-3 text-left hover:bg-surface-2"
          >
            <span className="text-[20px] font-semibold" lang={w.lang}>
              {w.text}
            </span>
            <span className="text-[15px] text-ink-2">
              {t.care.languages.lang[w.lang]}
              {w.translation ? `, «${w.translation}»` : ""}
            </span>
            <span className="text-[15px] text-ink-2">{fmt(t.care.words.samplesCount, { n: counts?.[w.id] ?? 0 })}</span>
          </button>
        ))}
      </Rows>
      <div className="mt-4">
        <Btn
          tone="primary"
          onClick={() =>
            setEditing({
              id: newId("w"),
              text: "",
              lang: "kk",
              meanings: [],
              oftenRepeats: false,
              develop: true,
              createdAt: Date.now(),
            })
          }
        >
          {t.care.common.add}
        </Btn>
      </div>
    </section>
  );
}

function TargetSelect({ value, onChange, id }: { value: string; onChange: (k: string) => void; id: string }) {
  const entities = useLiveQuery(() => db().entities.toArray(), []);
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <optgroup label={t.care.words.targetFrame}>
        {FRAMES.map((f) => (
          <option key={f.id} value={`frame:${f.id}`}>
            {frameLabel(f.id)}
          </option>
        ))}
      </optgroup>
      <optgroup label={t.care.words.targetTopic}>
        {TOPICS.map((tp) => (
          <option key={tp.id} value={`topic:${tp.id}`}>
            {tp.name.ru}
          </option>
        ))}
      </optgroup>
      <optgroup label={t.care.words.targetEntity}>
        {entities?.map((e) => (
          <option key={e.id} value={`entity:${e.id}`}>
            {e.name.ru || e.name.kk}
          </option>
        ))}
      </optgroup>
    </Select>
  );
}

function WordEditor({ initial, onDone }: { initial: WordEntry; onDone: () => void }) {
  const [w, setW] = useState<WordEntry>(initial);
  const set = (patch: Partial<WordEntry>) => setW((p) => ({ ...p, ...patch }));
  const samples = useLiveQuery(() => db().samples.where("wordId").equals(w.id).sortBy("createdAt"), [w.id]);
  const rec = useRecorder();

  const setMeaning = (i: number, m: WordMeaning) => set({ meanings: w.meanings.map((x, j) => (j === i ? m : x)) });
  const saveWord = async (next = w) => {
    if (next.text.trim()) await db().words.put({ ...next, text: next.text.trim() });
  };

  return (
    <section className="max-w-[720px]">
      <Btn tone="quiet" onClick={onDone}>
        {t.care.common.back}
      </Btn>
      <Field label={t.care.words.text}>
        {(id) => <TextInput id={id} lang={w.lang} value={w.text} onChange={(e) => set({ text: e.target.value })} />}
      </Field>
      <Field label={t.care.words.lang}>
        {() => (
          <Choice<Lang>
            name={t.care.words.lang}
            value={w.lang}
            options={[
              { value: "kk", label: t.care.languages.lang.kk },
              { value: "ru", label: t.care.languages.lang.ru },
            ]}
            onChange={(lang) => set({ lang })}
          />
        )}
      </Field>
      <Field label={t.care.words.translation}>
        {(id) => <TextInput id={id} value={w.translation ?? ""} onChange={(e) => set({ translation: e.target.value })} />}
      </Field>

      <div className="py-3">
        <h2 className="text-[18px] font-semibold">{t.care.words.meanings}</h2>
        <p className="text-[14px] text-ink-2">{t.care.words.meaningsHint}</p>
        <div className="mt-2 flex flex-col gap-2">
          {w.meanings.map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_96px_auto] items-end gap-2">
              <Field label={t.care.words.targetFrame}>
                {(id) => (
                  <TargetSelect
                    id={id}
                    value={targetKey(m.target)}
                    onChange={(k) => {
                      const target = parseTargetKey(k);
                      if (target) setMeaning(i, { ...m, target });
                    }}
                  />
                )}
              </Field>
              <Field label={t.care.words.weight}>
                {(id) => (
                  <TextInput
                    id={id}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={1}
                    step={0.05}
                    value={m.weight}
                    onChange={(e) => setMeaning(i, { ...m, weight: Math.max(0, Math.min(1, Number(e.target.value) || 0)) })}
                  />
                )}
              </Field>
              <Btn tone="quiet" className="mb-3" onClick={() => set({ meanings: w.meanings.filter((_, j) => j !== i) })}>
                {t.care.common.delete}
              </Btn>
            </div>
          ))}
        </div>
        <Btn
          className="mt-2"
          onClick={() => set({ meanings: [...w.meanings, { target: { kind: "frame", frame: "need.drink" }, weight: 0.5 }] })}
        >
          {t.care.words.addMeaning}
        </Btn>
      </div>

      <Toggle
        checked={w.oftenRepeats}
        onChange={(oftenRepeats) => set({ oftenRepeats })}
        label={t.care.words.oftenRepeats}
        hint={t.care.words.oftenRepeatsHint}
      />
      <Toggle checked={w.develop} onChange={(develop) => set({ develop })} label={t.care.common.develop} hint={t.care.common.developHint} />
      <Field label={t.care.common.soundMode}>
        {(id) => (
          <Select id={id} value={w.soundMode ?? ""} onChange={(e) => set({ soundMode: (e.target.value || undefined) as SoundMode | undefined })}>
            <option value="">{t.care.common.soundModeInherit}</option>
            {(["ru", "ru-kk", "kk-ru", "kk"] as const).map((m) => (
              <option key={m} value={m}>
                {t.care.languages.modes[m]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <div className="border-t border-line py-3">
        <h2 className="text-[18px] font-semibold">{t.care.words.clearVoice}</h2>
        <p className="mb-2 text-[14px] text-ink-2">{t.care.words.clearVoiceHint}</p>
        <VoiceRecorder
          label={t.care.languages.lang[w.lang]}
          value={w.audio}
          onChange={async (audio) => {
            const next = { ...w, audio };
            setW(next);
            await saveWord(next);
          }}
        />
      </div>

      <div className="border-t border-line py-3">
        <h2 className="text-[18px] font-semibold">{t.care.words.samples}</h2>
        <p className="text-[14px] text-ink-2">{t.care.words.samplesHint}</p>
        <p className="mt-1 text-[15px]">{fmt(t.care.words.samplesCount, { n: samples?.length ?? 0 })}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {samples?.map((s, i) => (
            <div key={s.id} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1">
              <span className="w-6 text-center text-[15px] text-ink-2">{i + 1}</span>
              <PlayButton mediaId={s.mediaId} />
              <Btn
                tone="quiet"
                onClick={async () => {
                  await deleteMedia(s.mediaId);
                  await db().samples.delete(s.id);
                }}
              >
                {t.care.common.delete}
              </Btn>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3">
          {rec.state === "recording" ? (
            <Btn
              tone="primary"
              onClick={async () => {
                const r = await rec.stop();
                if (!r || r.durationMs < 150) return;
                await saveWord();
                const mediaId = await putMedia(r.wav, "audio");
                await db().samples.put({
                  id: newId("smp"),
                  wordId: w.id,
                  mediaId,
                  ...featuresFromPcm(r.pcm),
                  durationMs: r.durationMs,
                  createdAt: Date.now(),
                });
              }}
            >
              {t.care.words.stop}
            </Btn>
          ) : (
            <Btn
              tone="primary"
              disabled={(samples?.length ?? 0) >= MAX_SAMPLES || !w.text.trim()}
              onClick={() => void rec.start()}
            >
              {t.care.words.record}
            </Btn>
          )}
          {rec.state === "recording" && <span className="text-danger">{t.care.recorder.recording}</span>}
          {rec.error && <span className="text-danger">{rec.error}</span>}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
        <Btn
          tone="primary"
          disabled={!w.text.trim()}
          onClick={async () => {
            await saveWord();
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
            for (const s of samples ?? []) await deleteMedia(s.mediaId);
            await db().samples.where("wordId").equals(w.id).delete();
            await deleteMedia(w.audio);
            await db().words.delete(w.id);
            onDone();
          }}
        >
          {t.care.common.delete}
        </Btn>
      </div>
    </section>
  );
}
