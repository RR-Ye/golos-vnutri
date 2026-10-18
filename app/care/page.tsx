"use client";

import { useEffect, useState } from "react";
import { ButtonsSection } from "@/components/care/ButtonsSection";
import { EntitySection } from "@/components/care/EntitySection";
import { GeneralSection } from "@/components/care/GeneralSection";
import { LanguagesSection } from "@/components/care/LanguagesSection";
import { NotesSection } from "@/components/care/NotesSection";
import { RecognitionSection } from "@/components/care/RecognitionSection";
import { BackupSection, backupOverdue } from "@/components/care/BackupSection";
import { HistorySection } from "@/components/care/HistorySection";
import { PhrasesSection } from "@/components/care/PhrasesSection";
import { ProgressSection } from "@/components/care/ProgressSection";
import { RoutineSection } from "@/components/care/RoutineSection";
import { WordsSection } from "@/components/care/WordsSection";
import { isUnlocked, lock, PinForm } from "@/components/PinForm";
import { useStressLexicon } from "@/lib/audio/useStressLexicon";
import { useSettings } from "@/lib/db/useSettings";
import { t } from "@/lib/i18n";

const N = t.care.nav;

const GROUPS = [
  { title: N.groupLife, items: ["people", "places", "things", "food", "medicine", "events", "routine", "notes"] },
  { title: N.groupSpeech, items: ["words", "recognition", "progress", "phrases", "languages", "buttons"] },
  { title: N.groupTalks, items: ["history"] },
  { title: N.groupApp, items: ["general", "backup"] },
] as const;

type SectionId = (typeof GROUPS)[number]["items"][number];
const ALL: readonly SectionId[] = GROUPS.flatMap((g) => g.items);

function readSection(): SectionId {
  if (typeof window === "undefined") return "people";
  const s = new URLSearchParams(window.location.search).get("s");
  return (ALL as readonly string[]).includes(s ?? "") ? (s as SectionId) : "people";
}

function Section({ id, go, openWord }: { id: SectionId; go: (id: SectionId, word?: string) => void; openWord: string | null }) {
  switch (id) {
    case "people":
      return <EntitySection type="person" title={N.people} lead={t.care.people.lead} />;
    case "places":
      return <EntitySection type="place" title={N.places} lead={t.care.places.lead} />;
    case "things":
      return <EntitySection type="thing" title={N.things} lead={t.care.things.lead} />;
    case "food":
      return <EntitySection type="food" title={N.food} lead={t.care.food.lead} />;
    case "medicine":
      return <EntitySection type="medicine" title={N.medicine} lead={t.care.medicine.lead} />;
    case "events":
      return <EntitySection type="event" title={N.events} lead={t.care.events.lead} />;
    case "routine":
      return <RoutineSection />;
    case "notes":
      return <NotesSection />;
    case "words":
      return <WordsSection openWordId={openWord} />;
    case "progress":
      return <ProgressSection onOpenWord={(w) => go("words", w)} />;
    case "phrases":
      return <PhrasesSection />;
    case "history":
      return <HistorySection />;
    case "backup":
      return <BackupSection />;
    case "recognition":
      return <RecognitionSection />;
    case "languages":
      return <LanguagesSection />;
    case "buttons":
      return <ButtonsSection />;
    case "general":
      return <GeneralSection />;
  }
}

export default function CarePage() {
  const [settings] = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [section, setSection] = useState<SectionId>("people");
  const [openWord, setOpenWord] = useState<string | null>(null);
  useStressLexicon();

  useEffect(() => {
    setUnlocked(isUnlocked());
    setSection(readSection());
  }, []);

  useEffect(() => {
    if (settings === null) window.location.replace("/");
  }, [settings]);

  if (!settings) return null;

  if (!unlocked) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-4">
        <PinForm settings={settings} onOk={() => setUnlocked(true)} onCancel={() => window.location.assign("/")} />
      </main>
    );
  }

  const go = (id: SectionId, word?: string) => {
    setOpenWord(word ?? null);
    setSection(id);
    window.history.replaceState(null, "", `?s=${id}`);
    window.scrollTo(0, 0);
  };

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[260px_1fr]">
      <nav aria-label={t.care.title} className="border-b border-line bg-surface px-4 py-4 md:sticky md:top-0 md:h-dvh md:overflow-y-auto md:border-r md:border-b-0">
        <p className="text-[15px] text-ink-2">{settings.personName || t.appName}</p>
        <p className="mb-3 text-[20px] font-semibold leading-tight">{t.care.title}</p>
        <div className="flex gap-6 overflow-x-auto md:flex-col md:gap-4 md:overflow-visible">
          {GROUPS.map((g) => (
            <div key={g.title} className="shrink-0">
              <p className="mb-1 text-[14px] font-medium text-ink-2">{g.title}</p>
              <ul className="flex gap-1 md:flex-col">
                {g.items.map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      aria-current={section === id ? "page" : undefined}
                      onClick={() => go(id)}
                      className={`min-h-11 w-full whitespace-nowrap rounded-md px-3 text-left text-[16px] ${
                        section === id ? "bg-accent-soft font-semibold" : "hover:bg-surface-2"
                      }`}
                    >
                      {N[id]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <a
          href="/practice/"
          className="mt-4 flex min-h-12 w-full items-center justify-center rounded-lg border border-accent px-4 text-[16px] font-medium text-accent"
        >
          {N.practice}
        </a>
        <button
          type="button"
          onClick={() => {
            lock();
            window.location.assign("/");
          }}
          className="mt-3 min-h-12 w-full rounded-lg bg-accent px-4 text-[16px] font-medium text-accent-ink"
        >
          {t.care.toPatient}
        </button>
      </nav>
      <main className="px-4 py-6 md:px-10">
        {backupOverdue(settings.lastBackupAt, settings.createdAt) && section !== "backup" && (
          <button
            type="button"
            onClick={() => go("backup")}
            className="mb-6 w-full rounded-lg border border-danger/50 bg-surface px-4 py-3 text-left text-[16px] text-danger"
          >
            {t.care.backup.remind}
          </button>
        )}
        <Section id={section} go={go} openWord={openWord} />
      </main>
    </div>
  );
}
