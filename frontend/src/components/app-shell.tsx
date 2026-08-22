import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Bell,
  ChevronDown,
  FileText,
  Grid2x2,
  Inbox,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Upload,
  Wallet,
} from "lucide-react";

const railItems = [
  { to: "/procurement/dashboard", icon: Grid2x2, label: "Procurement" },
  { to: "/procurement/invoices", icon: FileText, label: "Invoices" },
  { to: "/procurement/invoices/new", icon: Upload, label: "Upload Bill" },
  { to: "/finance/dashboard", icon: Wallet, label: "Finance" },
  { to: "/finance/review", icon: Inbox, label: "Review Queue" },
];

export function AppShell({
  role,
  title,
  subtitle,
  actions,
  children,
}: {
  role: "Procurement" | "Finance";
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const nav =
    role === "Procurement"
      ? [
          { to: "/procurement/dashboard", label: "Dashboard" },
          { to: "/procurement/invoices", label: "Invoices" },
          { to: "/procurement/invoices/new", label: "Upload Bill" },
          { to: "/finance/dashboard", label: "Finance" },
        ]
      : [
          { to: "/finance/dashboard", label: "Dashboard" },
          { to: "/finance/review", label: "Review" },
          { to: "/procurement/invoices", label: "Invoices" },
          { to: "/procurement/dashboard", label: "Procurement" },
        ];

  return (
    <div className="min-h-screen bg-background p-3 md:p-4">
      <div className="mx-auto max-w-[1500px] rounded-4xl bg-surface p-2 shadow-[var(--shadow-shell)] md:p-3">
        <header className="mb-4 flex items-center justify-between gap-3 rounded-3xl bg-card px-3 py-2.5 shadow-card md:px-4">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">InvoiceFlow</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full bg-muted p-1 lg:flex">
            {nav.map((item) => {
              const active = pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    "rounded-full px-4 py-2 text-sm font-semibold transition-[color,background-color,box-shadow,transform] duration-200 hover:-translate-y-px " +
                    (active
                      ? "bg-card text-foreground shadow-card"
                      : "text-muted-foreground hover:text-foreground")
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground">
              <Search className="size-4" />
            </button>
            <button className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground">
              <Bell className="size-4" />
            </button>
            <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5">
              <span className="grid size-7 place-items-center rounded-full bg-primary-deep text-[11px] font-bold text-primary-foreground">
                {role === "Finance" ? "FM" : "PO"}
              </span>
              <span className="hidden text-xs font-semibold sm:block">
                {role === "Finance" ? "Finance Manager" : "Procurement Officer"}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </div>
          </div>
        </header>

        <div className="flex gap-4 page-enter">
          <aside className="hidden w-14 shrink-0 flex-col items-center justify-between rounded-3xl bg-card py-4 shadow-card md:flex">
            <div className="flex flex-col items-center gap-2">
              {railItems.map((item) => {
                const active = pathname.startsWith(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    title={item.label}
                    className={
                      "grid size-10 place-items-center rounded-xl transition-colors " +
                      (active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted")
                    }
                  >
                    <Icon className="size-4.5" />
                  </Link>
                );
              })}
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted">
                <Settings className="size-4.5" />
              </button>
              <Link
                to="/"
                className="grid size-10 place-items-center rounded-xl text-muted-foreground hover:bg-muted"
              >
                <LogOut className="size-4.5" />
              </Link>
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
                {subtitle ? (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">{actions}</div>
            </div>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
