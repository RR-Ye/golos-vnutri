"use client";

import { PatientApp } from "@/components/patient/PatientApp";
import { SetupScreen } from "@/components/SetupScreen";
import { useSettings } from "@/lib/db/useSettings";

export default function Home() {
  const [settings] = useSettings();
  if (settings === undefined) return null;
  if (settings === null) return <SetupScreen />;
  return <PatientApp settings={settings} />;
}
