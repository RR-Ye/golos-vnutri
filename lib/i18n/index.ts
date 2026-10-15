import type { Lang } from "@/engine/types";
import { kk } from "./kk";
import { ru, type Dict } from "./ru";

export { ru, kk };
export type { Dict };

export type PatientDict = Dict["patient"];

export function patientDict(lang: Lang): PatientDict {
  return lang === "kk" ? kk.patient : ru.patient;
}

/** Подстановка {name} в строку. */
export function fmt(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Словарь интерфейса для близких — всегда русский. */
export const t = ru;
