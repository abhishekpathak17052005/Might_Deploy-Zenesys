import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, Dot, RiskPill } from "@/components/kit";
import { inr } from "@/lib/mock-data";
import { apiClient, resolveVendorName } from "@/lib/api";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/finance/review")({
  beforeLoad: () => requireRole(["FINANCE_MANAGER", "ORGANIZATION_ADMIN"]),
  head: () => ({
    meta: [
      { title: "Review Queue — InvoiceFlow" },
      {
        name: "description",
        content: "Invoices awaiting a finance decision, ordered by risk score and evidence.",
      },
      { property: "og:title", content: "Review Queue — InvoiceFlow" },
      {
        property: "og:description",
        content: "Every invoice in FINANCE_REVIEW with its risk score and flag reason.",
      },
    ],
  }),
  component: ReviewQueue,
});

function ReviewQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [awaitingProcurement, setAwaitingProcurement] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchReviewQueue = async () => {
    setLoading(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || ""
        : "";
    if (token) {
      try {
        const res = await apiClient.getFinanceReviewQueue(token);
        if (res.success && res.data) {
          const mapped = (res.data.invoices || []).map((inv: any) => ({
            id: inv._id || inv.id,
            invoiceNumber: inv.invoiceNumber || inv._id?.slice(0, 8),
            vendorName: resolveVendorName(inv),
            poNumber: inv.poNumber || "Non-PO",
            category: inv.category || "General",
            categoryIcon: "📄",
            attention: inv.riskLevel ? `${inv.riskLevel} risk level` : "Awaiting Review",
            amount: inv.totalAmount || 0,
            risk: {
              score: inv.riskScore || 0,
              level: (inv.riskLevel as any) || "LOW",
            },
          })).sort((a: any, b: any) => b.risk.score - a.risk.score);

          setQueue(mapped);
          setAwaitingProcurement(res.data.awaitingProcurement || []);
          setIsLive(true);
          setError(null);
        } else {
          setQueue([]);
          setAwaitingProcurement([]);
          setError(res.error?.message || "Failed to load review queue");
        }
      } catch (err) {
        setQueue([]);
        setAwaitingProcurement([]);
        setError(err instanceof Error ? err.message : "Failed to load review queue");
      }
    } else {
      setQueue([]);
      setAwaitingProcurement([]);
      setError("Please sign in to view the finance review queue");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchReviewQueue();
  }, []);

  return (
    <AppShell
      role="Finance"
      title="Review Queue"
      subtitle="GET /api/finance/review"
      actions={
        <button
          onClick={fetchReviewQueue}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh Queue
        </button>
      }
    >
      <Card>
        {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
        <CardHead
          icon={<Inbox className="size-4.5" />}
          title="Awaiting Decision"
          sub={`${queue.length} invoices ${isLive ? "(Live database queue)" : ""}`}
        />
        <div className="flex flex-col gap-3">
          {queue.map((inv) => (
            <Link
              key={inv.id}
              to="/finance/invoices/$id"
              params={{ id: inv.id }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4 transition-colors hover:bg-muted"
            >
              <span className="flex items-center gap-3">
                <Dot level={inv.risk.level} />
                <span>
                  <span className="block text-sm font-bold">{inv.invoiceNumber}</span>
                  <span className="block text-xs text-muted-foreground">
                    {inv.vendorName} · {inv.poNumber} · {inv.categoryIcon} {inv.category}
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{inv.attention}</span>
                <RiskPill level={inv.risk.level} score={inv.risk.score} />
                <span className="text-sm font-extrabold">{inr(inv.amount)}</span>
              </span>
            </Link>
          ))}
          {!loading && queue.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No invoices awaiting review.</p>}
        </div>
      </Card>
      {awaitingProcurement.length > 0 && <Card>
        <CardHead
          icon={<Inbox className="size-4.5" />}
          title="Visible to Finance · Awaiting Procurement"
          sub="Read-only invoices. Procurement must verify and forward them before a finance decision."
        />
        <div className="flex flex-col gap-3">
          {awaitingProcurement.map((inv: any) => (
            <Link
              key={inv._id || inv.id}
              to="/finance/invoices/$id"
              params={{ id: inv._id || inv.id }}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-4 transition-colors hover:bg-muted"
            >
              <span>
                <span className="block text-sm font-bold">{inv.invoiceNumber || (inv._id || inv.id).slice(0, 8)}</span>
                <span className="block text-xs text-muted-foreground">{resolveVendorName(inv)} · {String(inv.status || "SUBMITTED").replaceAll("_", " ")}</span>
              </span>
              <span className="text-sm font-extrabold">{inr(inv.totalAmount || 0)}</span>
            </Link>
          ))}
        </div>
      </Card>}
    </AppShell>
  );
}
