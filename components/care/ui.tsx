"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

type Tone = "primary" | "secondary" | "danger" | "quiet";

const tones: Record<Tone, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-110",
  secondary: "bg-surface text-ink border border-line hover:bg-surface-2",
  danger: "bg-surface text-danger border border-danger/60 hover:bg-danger/5",
  quiet: "text-accent underline underline-offset-4 decoration-1 hover:decoration-2 px-1",
};

export function Btn({
  tone = "secondary",
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  const pad = tone === "quiet" ? "min-h-11" : "min-h-12 px-5 rounded-lg";
  return (
    <button
      type="button"
      className={`${pad} inline-flex items-center justify-center gap-2 text-[17px] font-medium disabled:opacity-50 ${tones[tone]} ${className}`}
      {...rest}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  inline = false,
}: {
  label: string;
  hint?: string;
  children: (id: string) => ReactNode;
  inline?: boolean;
}) {
  const id = useId();
  return (
    <div className={inline ? "flex flex-wrap items-center justify-between gap-3 py-3" : "flex flex-col gap-1.5 py-3"}>
      <label htmlFor={id} className="text-[15px] font-medium text-ink">
        {label}
        {hint && <span className="mt-0.5 block text-[14px] font-normal leading-snug text-ink-2">{hint}</span>}
      </label>
      {children(id)}
    </div>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-[17px] text-ink placeholder:text-ink-2/70 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`min-h-12 w-full rounded-lg border border-line bg-surface px-3 text-[17px] text-ink ${props.className ?? ""}`}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 py-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--accent)]"
      />
      <label htmlFor={id} className="text-[16px] leading-snug">
        {label}
        {hint && <span className="mt-0.5 block text-[14px] text-ink-2">{hint}</span>}
      </label>
    </div>
  );
}

export function Choice<T extends string>({
  value,
  options,
  onChange,
  name,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  name: string;
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-h-11 rounded-lg border px-4 text-[16px] ${
            value === o.value ? "border-accent bg-accent-soft font-medium text-ink" : "border-line bg-surface text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <header className="mb-4 max-w-[68ch]">
      <h1 className="text-[28px] font-semibold leading-tight tracking-[-0.01em]">{title}</h1>
      {lead && <p className="mt-2 text-[16px] leading-relaxed text-ink-2">{lead}</p>}
    </header>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line border-y border-line">{children}</div>;
}
