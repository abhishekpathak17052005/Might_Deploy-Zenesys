import { AlertTriangle, GitBranch, Layers, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardHead, CheckRow, Dot, Field, RiskPill } from "@/components/kit";
import { inr, type Invoice } from "@/lib/mock-data";

export function InvoiceHeader({ invoice }: { invoice: Invoice }) {
  return (
    <Card className="bg-primary-deep text-primary-foreground">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-white/60">{invoice.poNumber}</p>
          <h2 className="mt-1 text-3xl font-extrabold tracking-tight">{invoice.invoiceNumber}</h2>
          <p className="mt-1 text-sm text-white/70">{invoice.vendorName}</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-white/60">Invoice Total</p>
          <p className="text-4xl font-extrabold tracking-tight">{inr(invoice.amount)}</p>
          <div className="mt-2 flex justify-end">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-extrabold">
              {invoice.risk.level} RISK · {invoice.risk.score} / 100
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

export function InvoiceInformation({ invoice }: { invoice: Invoice }) {
  return (
    <Card>
      <CardHead
        icon={<Layers className="size-4.5" />}
        title="Invoice Information"
        sub="Extracted fields"
      />
      <Field label="Invoice Number" value={invoice.invoiceNumber} />
      <Field label="Invoice Date" value={invoice.invoiceDate} />
      <Field label="Due Date" value={invoice.dueDate} />
      <Field label="Vendor" value={invoice.vendorName} />
      <Field label="GSTIN" value={invoice.gstin} />
      <Field label="PO Number" value={invoice.poNumber} />
      <Field label="Category" value={invoice.category} />
      <Field label="Subtotal" value={inr(invoice.subtotal)} />
      <Field label="GST" value={inr(invoice.gst)} />
      <Field label="Total" value={inr(invoice.amount)} />
    </Card>
  );
}

export function Verification({ invoice }: { invoice: Invoice }) {
  const v = invoice.verification;
  return (
    <Card>
      <CardHead
        icon={<ShieldCheck className="size-4.5" />}
        title="Verification"
        sub="Deterministic checks"
      />
      <CheckRow label="GSTIN Format" value={v.gstinFormat} />
      <CheckRow label="Vendor GSTIN Match" value={v.vendorGstinMatch} />
      <CheckRow label="Official GST Verification" value={v.officialGstVerification} />
      <CheckRow label="Vendor" value={v.vendorStatus} />
      <CheckRow label="PO" value={v.poStatus} />
      <CheckRow label="PO Vendor" value={v.poVendor} />
      <CheckRow label="Tax Calculation" value={v.taxStatus} />
    </Card>
  );
}

export function CategoryCard({ invoice }: { invoice: Invoice }) {
  return (
    <Card>
      <CardHead icon={<Sparkles className="size-4.5" />} title="Category" sub="From extraction" />
      <div className="rounded-3xl bg-primary-soft px-5 py-8 text-center">
        <p className="text-4xl">{invoice.categoryIcon}</p>
        <p className="mt-3 text-sm font-extrabold uppercase tracking-wide text-primary-deep">
          {invoice.category}
        </p>
        <p className="mt-2 text-xs font-semibold text-primary-deep/70">
          Confidence: {invoice.categoryConfidence}%
        </p>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Reason</p>
      <p className="text-sm font-semibold">{invoice.categoryReason}</p>
    </Card>
  );
}

export function RiskAnalysis({ invoice }: { invoice: Invoice }) {
  const total = invoice.risk.signals.reduce((s, x) => s + x.score, 0);
  return (
    <Card>
      <CardHead
        icon={<AlertTriangle className="size-4.5" />}
        title="Risk Analysis"
        sub="Backend risk engine output"
        right={<RiskPill level={invoice.risk.level} />}
      />
      <div className="flex items-center gap-5 rounded-3xl bg-muted p-5">
        <div className="relative grid size-24 shrink-0 place-items-center">
          <svg viewBox="0 0 100 100" className="absolute size-24 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-border)" strokeWidth="10" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={
                invoice.risk.level === "HIGH"
                  ? "var(--color-destructive)"
                  : invoice.risk.level === "MEDIUM"
                    ? "var(--color-warning)"
                    : "var(--color-primary)"
              }
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(invoice.risk.score / 100) * 264} 264`}
            />
          </svg>
          <span className="text-2xl font-extrabold">{invoice.risk.score}</span>
        </div>
        <div>
          <p className="text-sm font-extrabold">{invoice.risk.level} RISK</p>
          <p className="text-xs text-muted-foreground">Decision: {invoice.risk.decision}</p>
        </div>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Signals
      </p>
      <div className="flex flex-col">
        {invoice.risk.signals.map((s) => (
          <details key={s.code} className="border-b border-border py-3 last:border-0">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="flex items-center gap-2.5">
                <Dot level={s.severity} />
                <span className="text-sm font-semibold">{s.label}</span>
              </span>
              <span className="text-sm font-bold">+{s.score}</span>
            </summary>
            <p className="mt-2 pl-6 text-xs text-muted-foreground">{s.message}</p>
          </details>
        ))}
        <div className="flex items-center justify-between pt-3">
          <span className="text-sm font-semibold text-muted-foreground">Total</span>
          <span className="text-sm font-extrabold">{total}</span>
        </div>
      </div>
    </Card>
  );
}

export function Evidence({ invoice }: { invoice: Invoice }) {
  const related = invoice.related[0];
  const combined = invoice.amount + (related?.amount ?? 0);
  const coverage = Math.round((combined / invoice.poValue) * 100);

  return (
    <Card>
      <CardHead
        icon={<AlertTriangle className="size-4.5" />}
        title="Why was this flagged?"
        sub="Evidence behind the score"
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <EvidenceTile label="Current invoice" value={inr(invoice.amount)} />
        <EvidenceTile
          label="Related invoice"
          value={related ? `${related.invoiceNumber} → ${inr(related.amount)}` : "None found"}
        />
        <EvidenceTile label="Same vendor" value={related ? "Yes" : "—"} />
        <EvidenceTile label="Same PO" value={related ? "Yes" : "—"} />
        <EvidenceTile label="Submitted within" value={related ? "24 hours" : "—"} />
        <EvidenceTile label="Combined value" value={inr(combined)} />
        <EvidenceTile label="PO value" value={inr(invoice.poValue)} />
        <EvidenceTile label="PO utilization" value={`${coverage}%`} highlight />
        <EvidenceTile label="Approval threshold" value={inr(invoice.approvalThreshold)} />
      </div>

      <div className="mt-4 rounded-2xl bg-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Explanation
        </p>
        {invoice.explanation.map((line) => (
          <p key={line} className="mt-2 text-sm leading-relaxed">
            {line}
          </p>
        ))}
      </div>
    </Card>
  );
}

function EvidenceTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-border p-3 ${highlight ? "bg-primary-soft" : ""}`}
    >
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

export function RelatedTransactions({ invoice }: { invoice: Invoice }) {
  const rows = [
    ...invoice.related.map((r) => ({ ...r, current: false })),
    {
      invoiceNumber: invoice.invoiceNumber,
      amount: invoice.amount,
      date: invoice.invoiceDate,
      current: true,
    },
  ];
  const combined = rows.reduce((s, r) => s + r.amount, 0);
  const coverage = Math.round((combined / invoice.poValue) * 100);

  return (
    <Card>
      <CardHead
        icon={<GitBranch className="size-4.5" />}
        title="Related Transactions"
        sub={`${invoice.poNumber} · ${inr(invoice.poValue)}`}
      />
      <div className="flex flex-col">
        {rows.map((r) => (
          <div
            key={r.invoiceNumber}
            className={`flex items-center justify-between rounded-2xl px-3 py-3 ${
              r.current ? "bg-primary-soft" : ""
            }`}
          >
            <div>
              <p className="text-sm font-bold">{r.invoiceNumber}</p>
              <p className="text-[11px] text-muted-foreground">{r.date}</p>
            </div>
            <p className="text-sm font-bold">{inr(r.amount)}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <Field label="Combined" value={inr(combined)} />
        <Field label="PO" value={inr(invoice.poValue)} />
        <div className="pt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-muted-foreground">Coverage</span>
            <span className="font-extrabold">{coverage}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-muted">
            <div
              className="h-2.5 rounded-full bg-primary"
              style={{ width: `${Math.min(coverage, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
