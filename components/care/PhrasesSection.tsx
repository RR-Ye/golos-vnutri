"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useMemo, useState } from "react";
import { framePhrase } from "@/engine";
import { BUILTIN_ENTITIES, FRAMES, TEMPLATES, TOPICS, frameLabel } from "@/engine/ontology";
import type { Entity, Lang } from "@/engine/types";
import { db } from "@/lib/db";
import type { TemplateOverride } from "@/lib/db/types";
import { nlgOptions } from "@/lib/engine/useEngine";
import { useSettings } from "@/lib/db/useSettings";
import { t } from "@/lib/i18n";
import { Btn, SectionHeader, TextInput, Toggle } from "./ui";
import { VoiceRecorder } from "./VoiceRecorder";

const PH = t.care.phrases;
type Kind = "say" | "ask";

function sampleSlots(frameId: string, entities: Entity[]): Record<string, Entity> {
  const f = FRAMES.find((x) => x.id === frameId);
  const out: Record<string, Entity> = {};
  for (const s of f?.slots ?? []) {
    if (s.optional) continue;
    const e = entities.find((x) => s.types.includes(x.type));
    if (e) out[s.name] = e;
  }
  return out;
}

function Line({
  frameId,
  kind,
  lang,
  ov,
  example,
}: {
  frameId: string;
  kind: Kind;
  lang: Lang;
  ov: TemplateOverride | undefined;
  example: string;
}) {
  const key = `${frameId}:${kind}:${lang}`;
  const base = TEMPLATES[lang].frames[frameId]?.[kind] ?? "";
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(ov?.text ?? base);
  const save = (patch: Partial<TemplateOverride>) => db().overrides.put({ key, updatedAt: Date.now(), ...ov, ...patch });
  return (
    <div className="flex flex-col py-0.5">
      <div className="flex flex-wrap items-center gap-x-3">
        <span className="w-24 shrink-0 text-[14px] text-ink-2">
          {kind === "say" ? PH.say : PH.ask}, {lang === "ru" ? "рус" : "қаз"}
        </span>
        <span className="text-[17px]" lang={lang}>
          {example}
        </span>
        {ov?.verified && <span className="rounded bg-accent-soft px-1.5 text-[13px]">{PH.verifiedMark}</span>}
        <span className="ml-auto flex gap-1">
        {lang === "kk" && !ov?.verified && (
          <Btn tone="quiet" onClick={() => void save({ verified: true })}>
            {PH.verified}
          </Btn>
        )}
        <Btn tone="quiet" onClick={() => setEditing((e) => !e)}>
          {PH.fix}
        </Btn>
        {ov?.text && (
          <Btn tone="quiet" onClick={() => void db().overrides.put({ ...ov, text: undefined, updatedAt: Date.now() })}>
            {PH.reset}
          </Btn>
        )}
        </span>
      </div>
      {editing && (
        <div className="flex flex-wrap gap-2 sm:pl-[108px]">
          <TextInput lang={lang} value={text} onChange={(e) => setText(e.target.value)} className="max-w-[520px]" aria-label={`${PH.fix}: ${frameLabel(frameId)}`} />
          <Btn
            tone="primary"
            onClick={async () => {
              await save({ text: text.trim() || undefined, verified: lang === "kk" ? true : ov?.verified });
              setEditing(false);
            }}
          >
            {t.care.common.save}
          </Btn>
        </div>
      )}
    </div>
  );
}

export function PhrasesSection() {
  const [settings] = useSettings();
  const overrides = useLiveQuery(() => db().overrides.toArray(), []);
  const entities = useLiveQuery(() => db().entities.toArray(), []);
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const ovMap = useMemo(() => new Map((overrides ?? []).map((o) => [o.key, o])), [overrides]);
  if (!settings || !entities) return null;
  const opts = nlgOptions(settings, overrides ?? []);
  const all = [...BUILTIN_ENTITIES, ...entities];

  return (
    <section className="max-w-[860px]">
      <SectionHeader title={t.care.nav.phrases} lead={PH.lead} />
      <Toggle checked={onlyUnverified} onChange={setOnlyUnverified} label={PH.onlyUnverified} />
      {TOPICS.map((topic) => {
        const frames = FRAMES.filter((f) => f.topic === topic.id).filter(
          (f) => !onlyUnverified || !ovMap.get(`${f.id}:say:kk`)?.verified || !ovMap.get(`${f.id}:ask:kk`)?.verified,
        );
        if (!frames.length) return null;
        return (
          <div key={topic.id} className="mt-6">
            <h2 className="text-[20px] font-semibold">{topic.name.ru}</h2>
            {frames.map((f) => {
              const slots = sampleSlots(f.id, all);
              const slotless = f.slots.every((s) => s.optional);
              return (
                <div key={f.id} className="border-t border-line py-3" data-testid={`phrase-${f.id}`}>
                  <p className="text-[16px] font-semibold">{frameLabel(f.id)}</p>
                  {(["say", "ask"] as const).flatMap((kind) =>
                    (["ru", "kk"] as const).map((lang) => (
                      <Line
                        key={`${kind}-${lang}`}
                        frameId={f.id}
                        kind={kind}
                        lang={lang}
                        ov={ovMap.get(`${f.id}:${kind}:${lang}`)}
                        example={framePhrase(f.id, slots, kind, lang, opts).text}
                      />
                    )),
                  )}
                  {slotless && (
                    <div className="mt-2 flex flex-col gap-2">
                      <span className="text-[14px] text-ink-2">
                        {PH.voice}. {PH.voiceHint}
                      </span>
                      {(["ru", "kk"] as const).map((lang) => {
                        const key = `${f.id}:say:${lang}`;
                        const ov = ovMap.get(key);
                        return (
                          <VoiceRecorder
                            key={lang}
                            label={t.care.languages.lang[lang]}
                            value={ov?.audio}
                            onChange={(audio) => void db().overrides.put({ key, updatedAt: Date.now(), ...ov, audio })}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
