"use client";

import { useCallback, useEffect, useState } from "react";
import { TOPICS } from "@/engine/ontology";
import type { Settings } from "@/lib/db/types";
import { patientDict } from "@/lib/i18n";
import { Icon } from "../Icon";
import { PinForm } from "../PinForm";
import { CornerHold } from "./CornerHold";
import { Press } from "./Press";
import { Shell } from "./Shell";
import { Tile, TileGrid } from "./Tile";
import { usePatientLayout } from "./useLayout";

export function PatientApp({ settings }: { settings: Settings }) {
  const layout = usePatientLayout();
  const [started, setStarted] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [page, setPage] = useState(0);
  const lang = settings.primaryLang;
  const other = lang === "ru" ? "kk" : "ru";
  const d = patientDict(lang);

  useEffect(() => {
    document.documentElement.dataset.theme = settings.patientTheme;
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [settings.patientTheme]);

  const unlock = useCallback(() => setPinOpen(true), []);

  const topics = settings.topics.map((id) => TOPICS.find((t) => t.id === id)).filter((t) => !!t);
  const perPage = layout.tilesPerPage;
  const paged = topics.length > perPage;
  const pageSize = paged ? perPage - 1 : perPage;
  const pages = Math.max(1, Math.ceil(topics.length / pageSize));
  const visible = topics.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <div className="patient-root bg-bg text-ink">
      <CornerHold onUnlock={unlock} side={settings.hand === "right" ? "left" : "right"} />
      {!started ? (
        <div className="flex h-full items-center justify-center p-6">
          <Press
            label={d.start}
            testId="btn-start"
            onPress={() => setStarted(true)}
            className="flex h-[min(60vh,420px)] w-[min(80vw,520px)] flex-col items-center justify-center gap-4 rounded-[40px] bg-accent text-accent-ink"
          >
            <Icon id="smile" size={140} />
            <span className="text-[34px] font-semibold">{d.start}</span>
            <span className="text-[20px] opacity-90">{patientDict(other).start}</span>
          </Press>
        </div>
      ) : (
        <Shell
          settings={settings}
          layout={layout}
          handlers={{
            onHelp: () => undefined,
            onRestart: () => setPage(0),
            onSay: () => undefined,
            onAnswer: () => undefined,
          }}
        >
          <TileGrid cols={layout.cols} rows={layout.rows}>
            {visible.map((tp) => (
              <Tile
                key={tp.id}
                testId={`topic-${tp.id}`}
                picture={<Icon id={tp.icon} size={layout.mode === "phone" ? 72 : 120} />}
                label={tp.name[lang]}
                sublabel={tp.name[other]}
                onPress={() => undefined}
              />
            ))}
            {paged && (
              <Tile
                testId="btn-more"
                picture={<Icon id="next" size={layout.mode === "phone" ? 64 : 96} />}
                label={d.more}
                sublabel={patientDict(other).more}
                onPress={() => setPage((p) => (p + 1) % pages)}
              />
            )}
          </TileGrid>
        </Shell>
      )}
      {pinOpen && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center bg-bg/95 p-6" style={{ touchAction: "auto" }}>
          <PinForm settings={settings} onOk={() => window.location.assign("/care/")} onCancel={() => setPinOpen(false)} />
        </div>
      )}
    </div>
  );
}
