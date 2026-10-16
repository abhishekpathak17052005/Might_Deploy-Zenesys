import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Download, PackageCheck, Route as RouteIcon, Wallet } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import { CategoryCard, InvoiceHeader, InvoiceInformation, Verification } from "@/components/review-sections";
import { STATUS_FLOW, STATUS_LABEL, type Invoice } from "@/lib/mock-data";
import { requireRole } from "@/lib/route-guards";
import { apiClient } from "@/lib/api";
import { toInvoiceView } from "@/lib/invoice-adapter";

export const Route = createFileRoute("/procurement/invoices/$id")({
  beforeLoad: () => requireRole(["PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"]),
  head: () => ({ meta: [{ title: "Review invoice — InvoiceFlow" }] }),
  component: InvoiceStatus,
});

function InvoiceStatus() {
  const { id } = useParams({ from: "/procurement/invoices/$id" });
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [rawInvoice, setRawInvoice] = useState<any>(null);
  const [outstandingAmount, setOutstandingAmount] = useState(0);
  const [outstandingInvoices, setOutstandingInvoices] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentError, setDocumentError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    apiClient.getProcurementReview(id, token).then((result) => {
      if (result.success && result.data) {
        const record = result.data.invoice;
        setRawInvoice(record);
        setInvoice(toInvoiceView(record));
        setOutstandingAmount(Number(result.data.outstandingAmount || 0));
        setOutstandingInvoices(result.data.outstandingInvoices || []);
      } else setError(result.error?.message || "Invoice could not be loaded");
    }).catch((err) => setError(err instanceof Error ? err.message : "Invoice could not be loaded"));
  }, [id]);

  useEffect(() => {
    let objectUrl: string | null = null;
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    fetch(`${import.meta.env["VITE_API_URL"] || "http://localhost:5000/api"}/invoices/${id}/file?stream=true`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(async (response) => {
      if (!response.ok) throw new Error("The uploaded bill could not be loaded");
      objectUrl = URL.createObjectURL(await response.blob());
      setDocumentUrl(objectUrl);
    }).catch((err) => setDocumentError(err instanceof Error ? err.message : "The uploaded bill could not be loaded"));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id]);

  const act = async (action: "verify" | "return") => {
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    const reason = action === "return" ? window.prompt("Reason for returning this invoice to the vendor:")?.trim() : "";
    if (action === "return" && !reason) return;
    setBusy(true);
    const result = action === "verify"
      ? await apiClient.verifyProcurementInvoice(id, token, reviewConfirmed)
      : await apiClient.returnProcurementInvoice(id, token, reason!);
    setBusy(false);
    if (result.success) window.location.assign("/procurement/dashboard");
    else setError(result.error?.message || "Could not update invoice");
  };

  if (!invoice) return <AppShell role="Procurement" title="Review invoice"><Card><p className="text-sm text-muted-foreground">{error || "Loading invoice..."}</p></Card></AppShell>;

  const currentIndex = STATUS_FLOW.indexOf(invoice.status);
  const lineItems = rawInvoice?.lineItems?.length ? rawInvoice.lineItems : rawInvoice?.ocrResult?.lineItems || [];
  const amountValue = rawInvoice?.totalAmount ?? rawInvoice?.ocrResult?.totalAmount;
  const amount = Number(amountValue || 0);
  const needsExplicitReview = Boolean(rawInvoice?.attachmentSha256 || rawInvoice?.attachmentUrl) && (
    rawInvoice?.extractionStatus !== "SUCCEEDED" ||
    rawInvoice?.vendorMatchStatus !== "MATCH" ||
    !["MATCH", "NOT_REQUIRED"].includes(rawInvoice?.poMatchStatus || "")
  );
  return (
    <AppShell role="Procurement" title={`Review ${invoice.invoiceNumber}`} subtitle={`${invoice.vendorName} · ${invoice.poNumber}`} actions={<Link to="/procurement/dashboard" className="rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">Back to dashboard</Link>}>
      <div className="flex flex-col gap-5">
        <InvoiceHeader invoice={{ ...invoice, amount }} />
        <Card>
          <CardHead icon={<PackageCheck className="size-4.5" />} title="Source and verification" sub="Fields are linked to this invoice's uploaded file" />
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <p>File SHA-256: <span className="font-mono text-xs">{rawInvoice?.attachmentSha256 || "Not recorded for this upload"}</span></p>
            <p>OCR: <strong>{rawInvoice?.extractionStatus || "Not recorded"}</strong>{rawInvoice?.extractionError ? ` — ${rawInvoice.extractionError}` : ""}</p>
            <p>Registered vendor: <strong>{rawInvoice?.vendorId?.name || rawInvoice?.vendorName || "Unverified"}</strong></p>
            <p>Vendor name on bill: <strong>{rawInvoice?.ocrResult?.vendorName || "Not extracted"}</strong> · match: <strong>{rawInvoice?.vendorMatchStatus || "UNVERIFIED"}</strong></p>
            <p>Purchase order: <strong>{rawInvoice?.poNumber || "Not present on bill"}</strong> · match: <strong>{rawInvoice?.poMatchStatus || "UNVERIFIED"}</strong></p>
            <p>Risk evaluation: <strong>{rawInvoice?.riskEvaluationStatus || "NOT_EVALUATED"}</strong></p>
          </div>
          {needsExplicitReview && <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm"><input type="checkbox" checked={reviewConfirmed} onChange={(event) => setReviewConfirmed(event.target.checked)} className="mt-1" /><span>I reviewed the uploaded bill and acknowledge the unresolved OCR, vendor, or PO evidence. This exception will be recorded in the audit log.</span></label>}
          {amountValue == null && <p className="mt-3 text-sm font-semibold text-amber-700">No amount was extracted. Use the uploaded bill as evidence and resolve it during procurement review.</p>}
        </Card>
        {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHead icon={<PackageCheck className="size-4.5" />} title="Materials on this bill" sub="Items extracted from the invoice" />
            {lineItems.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2">Material / description</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit price</th><th className="py-2 text-right">Amount</th></tr></thead><tbody>{lineItems.map((item: any, index: number) => <tr key={index} className="border-b border-border"><td className="py-3">{item.description || "Unlabeled item"}</td><td className="py-3 text-right">{item.quantity ?? "—"}</td><td className="py-3 text-right">₹{Number(item.unitPrice || 0).toLocaleString("en-IN")}</td><td className="py-3 text-right font-semibold">₹{Number(item.amount || 0).toLocaleString("en-IN")}</td></tr>)}</tbody></table><div className="flex justify-between pt-4 text-sm font-bold"><span>Invoice total</span><span>₹{amount.toLocaleString("en-IN")}</span></div></div> : <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">The bill has not been itemized yet. Open the uploaded invoice to check the materials and printed total.</div>}
          </Card>
          <Card>
            <CardHead icon={<Wallet className="size-4.5" />} title="Vendor balance awaiting payment" sub="Approved invoices in this organization; payment tracking is not configured" />
            <p className="text-3xl font-extrabold">₹{outstandingAmount.toLocaleString("en-IN")}</p>
            {outstandingInvoices.length > 0 ? <ul className="mt-4 divide-y divide-border">{outstandingInvoices.map((item) => <li key={item._id} className="flex justify-between gap-3 py-2 text-sm"><span>{item.invoiceNumber || `Invoice ${String(item._id).slice(-6)}`}</span><span className="font-semibold">₹{Number(item.totalAmount || 0).toLocaleString("en-IN")}</span></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">No previously approved invoices are recorded for this vendor.</p>}
          </Card>
        </div>
        <Card>
          <CardHead icon={<RouteIcon className="size-4.5" />} title="Status Tracking" sub="Pipeline progress" />
          <div className="flex flex-wrap gap-4">{STATUS_FLOW.map((step, i) => { const label = STATUS_LABEL[step]; const done = i < currentIndex; const active = i === currentIndex; return <div key={step} className="flex min-w-[130px] flex-1 flex-col gap-2"><div className="h-1.5 w-full rounded-full bg-muted"><div className={`h-1.5 rounded-full ${done ? "bg-primary" : active ? "bg-accent" : "bg-transparent"}`} style={{ width: done ? "100%" : active ? "55%" : "0%" }} /></div><span className="text-xs font-semibold">{label}</span></div>; })}</div>
        </Card>
        <div className="grid gap-5 lg:grid-cols-2"><InvoiceInformation invoice={invoice} /><Verification invoice={invoice} /><CategoryCard invoice={invoice} /></div>
        <Card><CardHead icon={<Download className="size-4.5" />} title="Original document" sub="Vendor uploaded bill, shown here for review" />{documentUrl ? <><div className="mt-4 overflow-hidden rounded-xl border border-border bg-muted/30">{String(rawInvoice?.attachmentMimeType || "").startsWith("image/") ? <img src={documentUrl} alt="Vendor invoice" className="mx-auto max-h-[780px] max-w-full object-contain" /> : <iframe src={documentUrl} title="Vendor invoice document" className="h-[720px] w-full" />}</div><a href={documentUrl} download={rawInvoice?.invoiceNumber || "vendor-invoice"} className="mt-3 inline-flex rounded-full border border-input px-4 py-2 text-sm font-semibold">Download invoice file</a></> : <p className="mt-3 text-sm text-muted-foreground">{documentError || "Loading the uploaded bill..."}</p>}</Card>
        {(["SUBMITTED", "REVIEW_REQUIRED", "OCR_COMPLETED", "PROCUREMENT_REVIEW"].includes(String(rawInvoice?.status))) && <div className="flex justify-end gap-3"><button disabled={busy} onClick={() => act("return")} className="rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-bold text-destructive disabled:opacity-50">Return to vendor</button><button disabled={busy || (needsExplicitReview && !reviewConfirmed)} onClick={() => act("verify")} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">{needsExplicitReview ? "Acknowledge & forward to Finance" : "Verify & forward to Finance"}</button></div>}
      </div>
    </AppShell>
  );
}
