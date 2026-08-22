import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CloudUpload, FileUp } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import { purchaseOrders, vendors } from "@/lib/mock-data";

export const Route = createFileRoute("/procurement/invoices/new")({
  head: () => ({
    meta: [
      { title: "Submit Vendor Bill — InvoiceFlow" },
      {
        name: "description",
        content: "Upload a vendor bill with vendor, purchase order and invoice type for intake.",
      },
      { property: "og:title", content: "Submit Vendor Bill — InvoiceFlow" },
      {
        property: "og:description",
        content: "Push a PO-based or non-PO vendor bill into the extraction pipeline.",
      },
    ],
  }),
  component: UploadBill,
});

function UploadBill() {
  const [submitted, setSubmitted] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [type, setType] = useState<"PO" | "NON_PO">("PO");

  return (
    <AppShell
      role="Procurement"
      title="Submit Vendor Bill"
      subtitle="POST /api/invoices/upload · multipart/form-data"
    >
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHead
            icon={<FileUp className="size-4.5" />}
            title="Bill Details"
            sub="Vendor, purchase order and document"
          />

          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              setSubmitted(true);
            }}
          >
            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Vendor</span>
              <select className="rounded-2xl border border-input bg-card px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring">
                {vendors.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Purchase Order</span>
              <select
                disabled={type === "NON_PO"}
                className="rounded-2xl border border-input bg-card px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              >
                {purchaseOrders.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Invoice Type</span>
              <div className="flex gap-3">
                {(
                  [
                    { key: "PO", label: "PO Based" },
                    { key: "NON_PO", label: "Non-PO" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setType(opt.key)}
                    className={`flex flex-1 items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      type === opt.key
                        ? "border-primary bg-primary-soft text-primary-deep"
                        : "border-input text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`size-4 rounded-full border-2 ${
                        type === opt.key ? "border-primary bg-primary" : "border-input"
                      }`}
                    />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-input bg-muted/60 px-6 py-12 text-center transition-colors hover:border-primary">
              <CloudUpload className="size-8 text-primary" />
              <span className="text-sm font-bold">
                {fileName ?? "Drop invoice here"}
              </span>
              <span className="text-xs text-muted-foreground">PDF / JPG / PNG</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
            </label>

            <button
              type="submit"
              className="rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Submit Bill
            </button>
          </form>
        </Card>

        <div className="flex flex-col gap-5">
          {submitted ? (
            <Card className="bg-primary-deep text-primary-foreground">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5" />
                <p className="text-sm font-bold">Bill submitted successfully.</p>
              </div>
              <p className="mt-6 text-xs text-white/60">Invoice ID</p>
              <p className="text-3xl font-extrabold tracking-tight">INV-1024</p>
              <p className="mt-5 text-xs text-white/60">Status</p>
              <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                <span className="size-2 rounded-full bg-accent" />
                Extraction Pending
              </p>
            </Card>
          ) : null}

          <Card>
            <CardHead title="What happens next" sub="Deterministic backend pipeline" />
            <ol className="flex flex-col gap-3">
              {[
                "Document intake",
                "Extraction",
                "Categorization",
                "GST / Vendor / PO checks",
                "Risk engine",
                "Related invoice analysis",
                "Finance review",
              ].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-bold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold">{step}</span>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
