import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, Dot, RiskPill } from "@/components/kit";
import { invoices, inr } from "@/lib/mock-data";

export const Route = createFileRoute("/finance/review")({
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
  const queue = [...invoices]
    .filter((i) => i.status === "FINANCE_REVIEW" || i.status === "RISK_EVALUATED")
    .sort((a, b) => b.risk.score - a.risk.score);

  return (
    <AppShell
      role="Finance"
      title="Review Queue"
      subtitle="GET /api/finance/review"
    >
      <Card>
        <CardHead
          icon={<Inbox className="size-4.5" />}
          title="Awaiting Decision"
          sub={`${queue.length} invoices`}
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
        </div>
      </Card>
    </AppShell>
  );
}
