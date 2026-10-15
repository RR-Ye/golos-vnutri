import type { Metadata, Viewport } from "next";
import { ru } from "@/lib/i18n";
import { SwRegister } from "@/components/SwRegister";
import "./globals.css";

export const metadata: Metadata = {
  title: ru.appName,
  description: "Инструмент общения для человека с афазией. Работает без интернета, данные хранятся только на устройстве.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/app-icon.svg", apple: "/app-icon-192.png" },
  appleWebApp: { capable: true, title: ru.appName, statusBarStyle: "default" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#e7edf0",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
