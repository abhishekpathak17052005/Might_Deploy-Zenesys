import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  AlertCircle,
  BadgeCheck,
  ChartPie,
  ClipboardList,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, Dot, StatCard } from "@/components/kit";
import { categoryMix, invoices, inr, monthlyVolume } from "@/lib/mock-data";
import { apiClient, type InvoiceDocument } from "@/lib/api";

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
  const [financeQueue, setFinanceQueue] = useState<InvoiceDocument[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
    totalValue: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        if (!token) {
          setError("No authentication token");
          return;
        }

        // Fetch finance review queue
        const queueResult = await apiClient.getFinanceReviewQueue(token);
        if (queueResult.success && queueResult.data) {
          const queue = queueResult.data.invoices;
          setFinanceQueue(queue);

          // Calculate stats
          const approved = queue.filter((inv) => inv.approvalStatus === "APPROVED").length;
          const rejected = queue.filter((inv) => inv.approvalStatus === "REJECTED").length;
          const pending = queue.filter((inv) => inv.approvalStatus === "PENDING").length;
          const totalValue = queue.reduce((sum, inv) => sum + inv.totalAmount, 0);

          setStats({ pending, approved, rejected, totalValue });
          setError(null);
        } else {
          setError(result.error?.message || "Failed to fetch review queue");
        }
      } catch (err) {
        console.error("Failed to load dashboard", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  // Filter invoices with risk signals for "Attention Required" section
  const attention = financeQueue
    .filter((inv) => inv.riskResult && inv.riskResult.riskLevel !== "LOW")
    .slice(0, 4);

  const max = Math.max(...monthlyVolume.map((m) => m.a));

  const getRiskColor = (level?: string) => {
    switch (level) {
      case "CRITICAL":
        return "destructive";
      case "HIGH":
        return "destructive";
      case "MEDIUM":
        return "warning";
      default:
        return "muted";
    }
  };

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
      {error && (
        <div className="mb-4 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4" />
            <span>{error} (using mock data)</span>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="grid gap-5 sm:grid-cols-2">
          <StatCard
            icon={<ClipboardList className="size-4.5" />}
            label="Pending Review"
            value={String(stats.pending)}
            hint="Invoices vs last month"
            delta={stats.pending > 3 ? "+20.9%" : "-5%"}
            tone="deep"
          />
          <StatCard
            icon={<AlertTriangle className="size-4.5" />}
            label="High Risk"
            value={String(attention.length)}
            hint="Signals vs last month"
            delta={attention.length > 0 ? "+10.9%" : "0%"}
          />
          <StatCard
            icon={<BadgeCheck className="size-4.5" />}
            label="Approved"
            value={String(stats.approved)}
            hint="Payments cleared"
            delta={stats.approved > 0 ? "+15%" : "0%"}
          />
          <StatCard
            icon={<TrendingUp className="size-4.5" />}
            label="Value in Review"
            value={inr(stats.totalValue)}
            hint={`Across ${stats.pending} invoices`}
            delta={stats.pending > 0 ? "+20.9%" : "0%"}
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
            title={loading ? "Loading Attention Required..." : "Attention Required"}
            sub="Which invoices need my attention and why"
          />
          <div className="flex flex-col gap-3">
            {loading ? (
              <p className="text-sm text-muted-foreground py-4">Loading...</p>
            ) : attention.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No high-risk invoices</p>
            ) : (
              attention.map((inv) => (
                <Link
                  key={inv.id}
                  to="/finance/invoices/$id"
                  params={{ id: inv.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4 transition-colors hover:bg-muted"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`size-3 rounded-full ${
                        inv.riskResult?.riskLevel === "CRITICAL"
                          ? "bg-destructive"
                          : inv.riskResult?.riskLevel === "HIGH"
                            ? "bg-orange-500"
                            : "bg-yellow-500"
                      }`}
                    />
                    <span>
                      <span className="block text-sm font-bold">
                        {inv.invoiceNumber} · {inv.vendorName || inv.vendorId}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {inv.riskResult?.findings?.[0]?.message || "Risk detected"}
                      </span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        inv.riskResult?.riskLevel === "CRITICAL"
                          ? "bg-destructive/12 text-destructive"
                          : inv.riskResult?.riskLevel === "HIGH"
                            ? "bg-orange-500/12 text-orange-700"
                            : "bg-yellow-500/12 text-yellow-700"
                      }`}
                    >
                      Risk {Math.round(inv.riskResult?.riskScore || 0)}
                    </span>
                    <span className="text-sm font-extrabold">{inr(inv.totalAmount)}</span>
                  </span>
                </Link>
              ))
            )}
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
