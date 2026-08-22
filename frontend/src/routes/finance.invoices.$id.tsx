import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Download, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import {
  CategoryCard,
  Evidence,
  InvoiceHeader,
  InvoiceInformation,
  RelatedTransactions,
  RiskAnalysis,
  Verification,
} from "@/components/review-sections";
import { getInvoice } from "@/lib/mock-data";

export const Route = createFileRoute("/finance/invoices/$id")({
  loader: ({ params }) => {
    const invoice = getInvoice(params.id);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [
          { title: "Review unavailable — InvoiceFlow" },
          { name: "robots", content: "noindex" },
        ],
      };
    }
    const t = `Review ${loaderData.invoice.invoiceNumber} — InvoiceFlow`;
    const d = `Risk ${loaderData.invoice.risk.score}/100 with verification checks, signals and evidence for ${loaderData.invoice.vendorName}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: FinanceReview,
  notFoundComponent: () => (
    <AppShell role="Finance" title="Invoice not found">
      <Card>
        <p className="text-sm text-muted-foreground">No review record for that invoice ID.</p>
      </Card>
    </AppShell>
  ),
});

function FinanceReview() {
  const { invoice } = Route.useLoaderData();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [note, setNote] = useState("");

  return (
    <AppShell
      role="Finance"
      title="Finance Review"
      subtitle={`${invoice.invoiceNumber} · ${invoice.vendorName}`}
      actions={
        <button className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">
          <Download className="size-4 text-muted-foreground" />
          Download Invoice
        </button>
      }
    >
      <div className="flex flex-col gap-5">
        <InvoiceHeader invoice={invoice} />

        <div className="grid gap-5 lg:grid-cols-3">
          <InvoiceInformation invoice={invoice} />
          <Verification invoice={invoice} />
          <CategoryCard invoice={invoice} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
          <RiskAnalysis invoice={invoice} />
          <RelatedTransactions invoice={invoice} />
        </div>

        <Evidence invoice={invoice} />

        <Card>
          <CardHead title="Finance Decision" sub="POST /api/invoices/:documentId/approve · /reject" />
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setDecision("APPROVED")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl px-6 py-4 text-sm font-bold transition-colors ${
                decision === "APPROVED"
                  ? "bg-primary-deep text-primary-foreground"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              <Check className="size-4" />
              Approve Payment
            </button>
            <button
              onClick={() => setDecision("REJECTED")}
              className={`inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border px-6 py-4 text-sm font-bold transition-colors ${
                decision === "REJECTED"
                  ? "border-transparent bg-destructive text-destructive-foreground"
                  : "border-destructive/40 text-destructive hover:bg-destructive/10"
              }`}
            >
              <X className="size-4" />
              Reject
            </button>
          </div>

          <label className="mt-4 flex flex-col gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Decision note</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Record the reasoning behind this decision…"
              className="rounded-2xl border border-input bg-card px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>

          {decision ? (
            <p className="mt-3 rounded-2xl bg-muted px-4 py-3 text-sm font-semibold">
              {invoice.invoiceNumber} marked{" "}
              <span className={decision === "APPROVED" ? "text-primary-deep" : "text-destructive"}>
                {decision}
              </span>
              .
            </p>
          ) : null}
        </Card>
      </div>
    </AppShell>
  );
}
