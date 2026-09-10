import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "SupportDesk — Support Ticketing Platform",
  description: "Modern enterprise support ticketing platform with SLA tracking and team collaboration",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans text-slate-900 bg-[#F8FAFC]">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
