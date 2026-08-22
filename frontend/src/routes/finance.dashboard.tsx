import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  BadgeCheck,
  ChartPie,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, Dot, StatCard } from "@/components/kit";
import { categoryMix, invoices, inr, monthlyVolume } from "@/lib/mock-data";

export const Route = createFileRoute("/finance/dashboard")({
  head: () => ({
    meta: [
      { title: "Finance Dashboard — InvoiceFlow" },
      {
        name: "description",
        content:
          "See which invoices need attention and why: risk signals, PO anomalies and vendor history.",
      },
      { property: "og:title", content: "Finance Dashboard — InvoiceFlow" },
      {
        property: "og:description",
        content: "Pending review, high-risk and approved invoice counts with attention reasons.",
      },
    ],
  }),
  component: FinanceDashboard,
});

function FinanceDashboard() {
  const attention = invoices.filter((i) => i.attention);
  const max = Math.max(...monthlyVolume.map((m) => m.a));

  return (
    <AppShell
      role="Finance"
      title="Finance Dashboard"
      subtitle="Friday, August 21st 2026"
      actions={
        <Link
          to="/finance/review"
          className="rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
        >
          Open Review Queue
        </Link>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="grid gap-5 sm:grid-cols-2">
          <StatCard
            icon={<ClipboardList className="size-4.5" />}
            label="Pending Review"
            value="12"
            hint="Invoices vs last month"
            delta="+20.9%"
            tone="deep"
          />
          <StatCard
            icon={<AlertTriangle className="size-4.5" />}
            label="High Risk"
            value="4"
            hint="Signals vs last month"
            delta="+10.9%"
          />
          <StatCard
            icon={<BadgeCheck className="size-4.5" />}
            label="Approved"
            value="38"
            hint="Payments cleared"
            delta="-10.5%"
          />
          <StatCard
            icon={<TrendingUp className="size-4.5" />}
            label="Value in Review"
            value={inr(383000)}
            hint="Across 12 invoices"
            delta="+20.9%"
          />
        </div>

        <Card>
          <CardHead
            icon={<ChartPie className="size-4.5" />}
            title="Category Statistic"
            sub="Track your spend categories"
            right={
              <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold">
                Today
              </span>
            }
          />
          <div className="flex items-center justify-center py-2">
            <svg viewBox="0 0 42 42" className="size-44 -rotate-90">
              <circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--color-primary-deep)" strokeWidth="12" />
              <circle
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke="var(--color-primary)"
                strokeWidth="12"
                strokeDasharray="22 78"
              />
              <circle
                cx="21"
                cy="21"
                r="15.9"
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="12"
                strokeDasharray="12 88"
                strokeDashoffset="-22"
              />
            </svg>
          </div>
          <div className="mt-2 flex flex-col">
            {categoryMix.map((c) => (
              <div
                key={c.label}
                className="flex items-center justify-between border-b border-border py-2.5 last:border-0"
              >
                <span className="text-sm text-muted-foreground">{c.label}</span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-bold">{c.value.toLocaleString("en-IN")}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      c.up ? "bg-primary-soft text-primary-deep" : "bg-destructive/12 text-destructive"
                    }`}
                  >
                    {c.delta}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <Card>
          <CardHead
            icon={<AlertTriangle className="size-4.5" />}
            title="Attention Required"
            sub="Which invoices need my attention and why"
          />
          <div className="flex flex-col gap-3">
            {attention.map((inv) => (
              <Link
                key={inv.id}
                to="/finance/invoices/$id"
                params={{ id: inv.id }}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-muted"
              >
                <span className="flex items-center gap-3">
                  <Dot level={inv.risk.level} />
                  <span>
                    <span className="block text-sm font-bold">
                      {inv.invoiceNumber} · {inv.vendorName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{inv.attention}</span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold">
                    Risk {inv.risk.score}
                  </span>
                  <span className="text-sm font-extrabold">{inr(inv.amount)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<TrendingUp className="size-4.5" />}
            title="Review Throughput"
            sub="Decisions per month"
            right={
              <span className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-semibold">
                This year
              </span>
            }
          />
          <div className="flex h-52 items-end gap-3">
            {monthlyVolume.map((m) => (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-44 w-full items-end justify-center gap-1">
                  <div
                    className="w-1/2 rounded-t-xl bg-accent"
                    style={{ height: `${(m.a / max) * 100}%` }}
                  />
                  <div
                    className="w-1/2 rounded-t-xl bg-primary-deep"
                    style={{ height: `${(m.b / max) * 100}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-muted-foreground">{m.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
