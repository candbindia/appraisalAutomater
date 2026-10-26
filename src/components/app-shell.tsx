"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { BarChart3, Database, FileText, History, LayoutDashboard, ListChecks, Settings2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "@/lib/types";

interface Person {
  employeeId: string;
  name: string;
  role: Role;
  designation: string;
}

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, ready: true, hrOnly: false },
  { href: "/tracker", label: "Tracker", icon: ListChecks, ready: true, hrOnly: false },
  { href: "/employees", label: "Employees", icon: Users, ready: true, hrOnly: false },
  { href: "/admin/cycles", label: "Cycles & Parameters", icon: Settings2, ready: true, hrOnly: true },
  { href: "/changelog", label: "Change Log", icon: History, ready: true, hrOnly: false },
  { href: "#", label: "Reports", icon: BarChart3, ready: false, hrOnly: false },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-8 w-[3px] rounded bg-amber" />
      <span className="font-display text-2xl font-extrabold tracking-tight text-[#9a9c9c]">C&amp;B</span>
      <span className="h-8 w-[3px] rounded bg-amber" />
      <span className="text-[13px] leading-tight text-[#b9bbbb]">
        Consulting
        <br />& Beyond
      </span>
    </div>
  );
}

export function AppShell({
  user,
  people,
  source,
  access,
  children,
}: {
  user: Person;
  people: Person[];
  source: "sheets" | "memory";
  access: { hr: boolean };
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();

  function switchUser(employeeId: string) {
    start(async () => {
      await fetch("/api/demo-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });
      router.push("/");
      router.refresh();
    });
  }

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : href === "/employees" ? pathname.startsWith("/employees") || pathname.startsWith("/appraisals") : pathname.startsWith(href);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_1fr]">
      <aside className="bg-ink text-paper md:sticky md:top-0 md:h-dvh md:flex md:flex-col">
        <div className="flex items-center justify-between px-5 py-4 md:py-6">
          <Brand />
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:pb-0">
          {NAV.filter((n) => !n.hrOnly || access.hr).map(({ href, label, icon: Icon, ready }) =>
            ready ? (
              <Link
                key={label}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive(href) ? "bg-amber text-ink font-medium" : "text-[#d6d6d2] hover:bg-white/5"
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ) : (
              <span
                key={label}
                className="flex shrink-0 cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#6f7272]"
                title="Coming in a later build step"
              >
                <Icon className="size-4" />
                {label}
                <span className="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">Soon</span>
              </span>
            )
          )}
        </nav>
        <div className="mt-auto hidden px-5 pb-6 text-[10px] uppercase tracking-[0.14em] text-[#6f7272] md:block">
          People · Processes · Progress
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:px-8">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
              source === "sheets" ? "border-[#c2e1cd] bg-ok-soft text-ok" : "border-[#f3d6a3] bg-amber-soft text-[#8a5a12]"
            )}
            title={source === "sheets" ? "Reading and writing your Google Sheet" : "Google Sheets not configured — using fictional sample data in memory"}
          >
            {source === "sheets" ? <Database className="size-3.5" /> : <FileText className="size-3.5" />}
            {source === "sheets" ? "Google Sheets" : "Sample data"}
          </span>

          <label className="flex items-center gap-2 text-xs text-grey">
            <span className="hidden sm:inline">Viewing as (demo)</span>
            <select
              value={user.employeeId}
              onChange={(e) => switchUser(e.target.value)}
              disabled={pending}
              className="h-9 max-w-[240px] rounded-lg border border-line bg-card px-2 text-sm text-ink"
            >
              {people.map((p) => (
                <option key={p.employeeId} value={p.employeeId}>
                  {p.name} — {ROLE_LABEL[p.role]}
                </option>
              ))}
            </select>
          </label>
        </header>
        <main className={cn("mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8", pending && "opacity-60")}>{children}</main>
      </div>
    </div>
  );
}
