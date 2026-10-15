"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { FRAMES, frameLabel } from "@/engine/ontology";
import { TIME_BANDS, type RoutineItem, type TimeBand } from "@/engine/types";
import { db, newId } from "@/lib/db";
import { t } from "@/lib/i18n";
import { Btn, SectionHeader, Select } from "./ui";

export function RoutineSection() {
  const items = useLiveQuery(() => db().routine.toArray(), []);
  return (
    <section className="max-w-[760px]">
      <SectionHeader title={t.care.nav.routine} lead={t.care.routine.lead} />
      {TIME_BANDS.map((band) => (
        <BandBlock key={band} band={band} items={(items ?? []).filter((i) => i.band === band)} />
      ))}
    </section>
  );
}

function BandBlock({ band, items }: { band: TimeBand; items: RoutineItem[] }) {
  const [pick, setPick] = useState("");
  return (
    <div className="border-t border-line py-4">
      <h2 className="text-[20px] font-semibold">{t.care.timeBands[band]}</h2>
      <ul className="mt-2 flex flex-col gap-2">
        {items.map((it) => (
          <li key={it.id} className="flex flex-wrap items-center gap-3">
            <span className="min-w-48 text-[17px]">{frameLabel(it.frame)}</span>
            <Select
              aria-label={frameLabel(it.frame)}
              className="max-w-[200px]"
              value={it.strength}
              onChange={(e) => void db().routine.put({ ...it, strength: Number(e.target.value) as 1 | 2 | 3 })}
            >
              {([1, 2, 3] as const).map((n) => (
                <option key={n} value={n}>
                  {t.care.routine.strength[n]}
                </option>
              ))}
            </Select>
            <Btn tone="quiet" onClick={() => void db().routine.delete(it.id)}>
              {t.care.common.delete}
            </Btn>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select aria-label={t.care.routine.pickFrame} className="max-w-[320px]" value={pick} onChange={(e) => setPick(e.target.value)}>
          <option value="">{t.care.routine.pickFrame}</option>
          {FRAMES.filter((f) => !items.some((i) => i.frame === f.id)).map((f) => (
            <option key={f.id} value={f.id}>
              {frameLabel(f.id)}
            </option>
          ))}
        </Select>
        <Btn
          disabled={!pick}
          onClick={async () => {
            await db().routine.put({ id: newId("r"), band, frame: pick, strength: 2 });
            setPick("");
          }}
        >
          {t.care.routine.addFor}
        </Btn>
      </div>
    </div>
  );
}
