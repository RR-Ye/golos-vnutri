"use client";

import { useEffect, useState } from "react";

export type LayoutMode = "landscape" | "portrait" | "phone";

export interface PatientLayout {
  mode: LayoutMode;
  /** Сколько плиток помещается в рабочей области без прокрутки. */
  tilesPerPage: number;
  cols: number;
  rows: number;
}

function compute(w: number, h: number): PatientLayout {
  if (Math.min(w, h) < 600) return { mode: "phone", tilesPerPage: 4, cols: 2, rows: 2 };
  if (w >= h) return { mode: "landscape", tilesPerPage: 6, cols: 3, rows: 2 };
  return { mode: "portrait", tilesPerPage: 6, cols: 2, rows: 3 };
}

export function usePatientLayout(): PatientLayout {
  const [layout, setLayout] = useState<PatientLayout>(() =>
    typeof window === "undefined" ? compute(1180, 820) : compute(window.innerWidth, window.innerHeight),
  );
  useEffect(() => {
    const on = () => setLayout(compute(window.innerWidth, window.innerHeight));
    on();
    window.addEventListener("resize", on);
    window.addEventListener("orientationchange", on);
    return () => {
      window.removeEventListener("resize", on);
      window.removeEventListener("orientationchange", on);
    };
  }, []);
  return layout;
}
