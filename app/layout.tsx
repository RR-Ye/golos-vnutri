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
  // Масштабирование разрешено (WCAG 1.4.4): близкие могут увеличить свои экраны.
  // Экран бабушки сам гасит щипок через touch-action и gesturestart.
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
