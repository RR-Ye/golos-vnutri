"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db, newId } from "@/lib/db";
import { fmt, t } from "@/lib/i18n";
import { Btn, Field, Rows, SectionHeader, Select, TextInput } from "./ui";

const DAY = 24 * 60 * 60 * 1000;

export function NotesSection() {
  const notes = useLiveQuery(() => db().notes.orderBy("until").reverse().toArray(), []);
  const entities = useLiveQuery(() => db().entities.toArray(), []);
  const [text, setText] = useState("");
  const [days, setDays] = useState(1);
  const [linked, setLinked] = useState("");
  const now = Date.now();
  const nameOf = (id: string) => entities?.find((e) => e.id === id)?.name.ru ?? "";

  return (
    <section className="max-w-[720px]">
      <SectionHeader title={t.care.nav.notes} lead={t.care.notes.lead} />
      <div className="grid gap-x-4 sm:grid-cols-[1fr_120px]">
        <Field label={t.care.notes.text}>
          {(id) => <TextInput id={id} value={text} onChange={(e) => setText(e.target.value)} placeholder="Звонила Алия" />}
        </Field>
        <Field label={t.care.notes.days}>
          {(id) => (
            <TextInput id={id} type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))} />
          )}
        </Field>
      </div>
      <Field label={t.care.notes.linked}>
        {(id) => (
          <Select id={id} value={linked} onChange={(e) => setLinked(e.target.value)}>
            <option value="">—</option>
            {entities
              ?.filter((e) => ["person", "place", "thing", "event", "medicine", "food"].includes(e.type))
              .map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name.ru}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Btn
        tone="primary"
        disabled={!text.trim()}
        onClick={async () => {
          await db().notes.put({
            id: newId("n"),
            text: text.trim(),
            entityIds: linked ? [linked] : [],
            topics: [],
            createdAt: Date.now(),
            until: Date.now() + days * DAY,
          });
          setText("");
          setLinked("");
        }}
      >
        {t.care.common.add}
      </Btn>
      <div className="mt-6">
        <Rows>
          {notes?.map((n) => (
            <div key={n.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={`text-[17px] ${n.until < now ? "text-ink-2 line-through" : ""}`}>{n.text}</span>
              {n.entityIds.map((id) => (
                <span key={id} className="rounded-md bg-accent-soft px-2 py-0.5 text-[14px]">
                  {nameOf(id)}
                </span>
              ))}
              <span className="text-[14px] text-ink-2">
                {n.until < now ? t.care.notes.expired : fmt(t.care.notes.until, { date: new Date(n.until).toLocaleDateString("ru-RU") })}
              </span>
              <Btn tone="quiet" className="ml-auto" onClick={() => void db().notes.delete(n.id)}>
                {t.care.common.delete}
              </Btn>
            </div>
          ))}
        </Rows>
      </div>
    </section>
  );
}
