import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import { CategoryCard, Evidence, InvoiceHeader, InvoiceInformation, RelatedTransactions, RiskAnalysis, Verification } from "@/components/review-sections";
import type { Invoice } from "@/lib/mock-data";
import { requireRole } from "@/lib/route-guards";
import { apiClient } from "@/lib/api";
import { toInvoiceView } from "@/lib/invoice-adapter";

export const Route = createFileRoute("/finance/invoices/$id")({
  beforeLoad: () => requireRole(["FINANCE_MANAGER", "ORGANIZATION_ADMIN"]),
  head: () => ({ meta: [{ title: "Finance invoice review — InvoiceFlow" }] }),
  component: FinanceReview,
});

function FinanceReview() {
  const { id } = useParams({ from: "/finance/invoices/$id" });
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    apiClient.getInvoiceReviewPacket(id, token).then((result) => {
      if (result.success && result.data) setInvoice(toInvoiceView(result.data.invoice));
      else setLoadError(result.error?.message || "Invoice review could not be loaded");
    }).catch((err) => setLoadError(err instanceof Error ? err.message : "Invoice review could not be loaded"));
  }, [id]);

  const decide = async (next: "APPROVED" | "REJECTED") => {
    setSubmitting(true); setMessage(null);
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    const result = next === "APPROVED"
      ? await apiClient.approveInvoice(id, token, note || "Approved by finance")
      : await apiClient.rejectInvoice(id, token, note || "Rejected by finance");
    if (result.success) { setDecision(next); setMessage(`Invoice ${next.toLowerCase()} and recorded.`); }
    else setMessage(result.error?.message || "Could not record decision");
    setSubmitting(false);
  };

  if (!invoice) return <AppShell role="Finance" title="Invoice review"><Card><p className="text-sm text-muted-foreground">{loadError || "Loading invoice..."}</p></Card></AppShell>;
  const canDecide = invoice.status === "FINANCE_REVIEW";
  const awaitingProcurement = ["SUBMITTED", "REVIEW_REQUIRED", "OCR_PROCESSING", "OCR_COMPLETED", "PROCUREMENT_REVIEW", "RETURNED_TO_VENDOR", "ON_HOLD"].includes(invoice.status);
  return <AppShell role="Finance" title={`Review ${invoice.invoiceNumber}`} subtitle={`${invoice.vendorName} · ${invoice.poNumber}`} actions={<Link to="/finance/review" className="rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">Back to queue</Link>}>
    <div className="flex flex-col gap-5">
      <InvoiceHeader invoice={invoice} />
      <div className="grid gap-5 lg:grid-cols-2"><InvoiceInformation invoice={invoice} /><Verification invoice={invoice} /><CategoryCard invoice={invoice} /><RiskAnalysis invoice={invoice} /><Evidence invoice={invoice} /><RelatedTransactions invoice={invoice} /></div>
      {canDecide ? <Card><CardHead title="Finance decision" sub="Record the approval decision and audit event" />
        <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Optional review note" className="mb-4 w-full rounded-xl border border-input bg-background p-3 text-sm" rows={3} />
        {message && <p className="mb-3 text-sm">{message}</p>}
        <div className="flex gap-3"><button onClick={() => void decide("APPROVED")} disabled={submitting || !!decision} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{submitting ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}Approve</button><button onClick={() => void decide("REJECTED")} disabled={submitting || !!decision} className="inline-flex items-center gap-2 rounded-full border border-destructive/30 px-5 py-2.5 text-sm font-bold text-destructive disabled:opacity-50"><X className="size-4" />Reject</button></div>
      </Card> : <Card><CardHead title={awaitingProcurement ? "Read-only · Awaiting Procurement" : "Finance decision unavailable"} sub="This invoice is visible for finance awareness but is not ready for a finance decision." />
        <p className="text-sm text-muted-foreground">Current status: {invoice.status.replaceAll("_", " ")}. {awaitingProcurement ? "The Procurement Officer must review the bill and forward it to Finance before approval or rejection is available." : "Approval and rejection are only available while an invoice is in Finance Review."}</p>
      </Card>}
    </div>
  </AppShell>;
}
