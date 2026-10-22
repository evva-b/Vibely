import type { Metadata } from "next";
import type { ReactNode } from "react";
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
    <html lang="ru">
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
