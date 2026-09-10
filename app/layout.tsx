import type { Metadata } from "next";
import "./globals.css";
import { getSessionUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "SupportDesk — Support Ticketing Platform",
  description: "Modern enterprise support ticketing platform with SLA tracking and team collaboration",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  return (
    <html lang="en">
      <body className="antialiased font-sans text-slate-900 bg-[#F8FAFC]">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
