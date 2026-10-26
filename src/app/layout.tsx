import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { loadBase } from "@/lib/repo";
import { getCurrentUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "C&B Performance",
  description: "Monthly employee performance reviews — Consulting & Beyond",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [d, user] = await Promise.all([loadBase(), getCurrentUser()]);
  // Only HR and the MD use the app. Everyone else fills their scores in the Google Sheet.
  const people = d.employees
    .filter((e) => e.active && (e.role === "hr" || e.role === "md"))
    .map((e) => ({ employeeId: e.employeeId, name: e.name, role: e.role, designation: e.designation }));
  const allowed = user.role === "hr" || user.role === "md";
  const access = { hr: user.role === "hr" };

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;600;700;800&display=swap" rel="stylesheet" />
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AppShell
          user={{ employeeId: user.employeeId, name: user.name, role: user.role, designation: user.designation }}
          people={people}
          source={d.source}
          access={access}
        >
          {allowed ? (
            children
          ) : (
            <p className="rounded-xl border border-line bg-card p-6 text-sm text-grey">
              This app is for HR and the Managing Director. Add someone with role <code>hr</code> or <code>md</code> to the Employees tab.
            </p>
          )}
        </AppShell>
      </body>
    </html>
  );
}
