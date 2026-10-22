import type { ReactNode } from "react";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <main className="min-h-screen p-6 md:p-10">{children}</main>;
}
