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

  const act = async (action: "verify" | "return") => {
    const token = localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || "";
    const reason = action === "return" ? window.prompt("Reason for returning this invoice to the vendor:")?.trim() : "";
    if (action === "return" && !reason) return;
    setBusy(true);
    const result = action === "verify"
      ? await apiClient.verifyProcurementInvoice(id, token)
      : await apiClient.returnProcurementInvoice(id, token, reason!);
    setBusy(false);
    if (result.success) window.location.assign("/procurement/dashboard");
    else setError(result.error?.message || "Could not update invoice");
  };

  if (!invoice) return <AppShell role="Procurement" title="Review invoice"><Card><p className="text-sm text-muted-foreground">{error || "Loading invoice..."}</p></Card></AppShell>;

  const currentIndex = STATUS_FLOW.indexOf(invoice.status);
  const lineItems = rawInvoice?.lineItems?.length ? rawInvoice.lineItems : rawInvoice?.ocrResult?.lineItems || [];
  const amount = Number(rawInvoice?.totalAmount ?? rawInvoice?.ocrResult?.totalAmount ?? invoice.amount ?? 0);
  return (
    <AppShell role="Procurement" title={`Review ${invoice.invoiceNumber}`} subtitle={`${invoice.vendorName} · ${invoice.poNumber}`} actions={<Link to="/procurement/dashboard" className="rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">Back to dashboard</Link>}>
      <div className="flex flex-col gap-5">
        <InvoiceHeader invoice={{ ...invoice, amount }} />
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
        <Card><CardHead icon={<Download className="size-4.5" />} title="Original document" sub="Review the vendor’s uploaded bill" /><button onClick={async () => { const token = localStorage.getItem("token") || ""; const result = await apiClient.getDownloadUrl(id, token); if (result.success && result.data?.downloadUrl) window.open(result.data.downloadUrl, "_blank", "noopener,noreferrer"); else setError(result.error?.message || "Could not download invoice"); }} className="rounded-full border border-input px-4 py-2 text-sm font-semibold">Open invoice file</button></Card>
        {(["SUBMITTED", "OCR_COMPLETED", "PROCUREMENT_REVIEW"].includes(String(rawInvoice?.status))) && <div className="flex justify-end gap-3"><button disabled={busy} onClick={() => act("return")} className="rounded-full border border-destructive/40 px-5 py-2.5 text-sm font-bold text-destructive disabled:opacity-50">Return to vendor</button><button disabled={busy} onClick={() => act("verify")} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Verify & forward to Finance</button></div>}
      </div>
    </AppShell>
  );
}
