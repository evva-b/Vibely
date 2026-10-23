import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import ThemeProvider from "@/components/theme/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Vibely",
    template: "%s | Vibely",
  },
  description: "Планирование и создание контента для социальных сетей",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        <Script id="vibely-theme-init" strategy="beforeInteractive">
          {`try {
  document.documentElement.dataset.theme =
    localStorage.getItem("vibely-theme") === "dark" ? "dark" : "light";
} catch (error) {
  console.error("Не удалось восстановить тему приложения.", error);
}`}
        </Script>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
