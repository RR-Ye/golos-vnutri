"use client";

import { useId, useState } from "react";
import { BackupFormatError, downloadBlob, exportBackup, importBackup } from "@/lib/backup";
import { useSettings } from "@/lib/db/useSettings";
import { fmt, t } from "@/lib/i18n";
import { Btn, SectionHeader } from "./ui";

const B = t.care.backup;
const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Напоминать, если с последней копии (или с установки) прошло больше недели. */
export function backupOverdue(lastBackupAt: number | null | undefined, createdAt: number): boolean {
  return Date.now() - (lastBackupAt ?? createdAt) > WEEK;
}

export function BackupSection() {
  const [s, save] = useSettings();
  const [msg, setMsg] = useState<string | null>(null);
  const fileId = useId();
  if (!s) return null;
  return (
    <section className="max-w-[720px]">
      <SectionHeader title={t.care.nav.backup} lead={B.lead} />
      <p className="text-[16px]">{s.lastBackupAt ? fmt(B.last, { date: new Date(s.lastBackupAt).toLocaleString("ru-RU") }) : B.never}</p>
      {backupOverdue(s.lastBackupAt, s.createdAt) && <p className="mt-1 text-[15px] text-danger">{B.remind}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Btn
          tone="primary"
          data-testid="backup-export"
          onClick={async () => {
            const blob = await exportBackup();
            const stamp = new Date().toISOString().slice(0, 10);
            downloadBlob(blob, `golos-vnutri-${stamp}.golos`);
            await save({ lastBackupAt: Date.now() });
            setMsg(B.done);
          }}
        >
          {B.export}
        </Btn>
        <label
          htmlFor={fileId}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-line bg-surface px-5 text-[17px] font-medium hover:bg-surface-2"
        >
          {B.import}
        </label>
        <input
          id={fileId}
          data-testid="backup-import"
          type="file"
          accept=".golos,application/zip"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !window.confirm(B.importConfirm)) return;
            try {
              await importBackup(file);
              setMsg(B.restored);
            } catch (err) {
              setMsg(err instanceof BackupFormatError ? B.bad : String(err));
            }
          }}
        />
      </div>
      {msg && (
        <p role="status" className="mt-3 text-[16px]">
          {msg}
        </p>
      )}
    </section>
  );
}
