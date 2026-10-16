import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, CloudUpload, FileUp, Loader2, Play } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import { requireRole } from "@/lib/route-guards";
import { apiClient } from "@/lib/api";

export const Route = createFileRoute("/procurement/invoices/new")({
  beforeLoad: () => requireRole(["PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"]),
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedPO, setSelectedPO] = useState("");
  const [type, setType] = useState<"PO" | "NON_PO">("PO");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedInvoiceId, setUploadedInvoiceId] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<string | null>(null);
  const [processingLoading, setProcessingLoading] = useState(false);
  const [processResult, setProcessResult] = useState<any | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError("Please select an invoice document (PDF, PNG, JPG) to upload");
      return;
    }

    setLoading(true);
    setError(null);

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || ""
        : "";

    try {
      const res = await apiClient.uploadInvoice(
        selectedFile,
        token,
        type === "PO" ? "PO_BASED" : "NON_PO",
        selectedVendor
      );

      if (res.success && res.data) {
        setUploadedInvoiceId(res.data.id);
        setPipelineStatus(res.data.documentStatus);
        setSubmitted(true);
      } else {
        setError(res.error?.message || "Upload failed. Please verify your credentials and file format.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to connect to backend server");
    } finally {
      setLoading(false);
    }
  };

  const handleRunProcessing = async () => {
    if (!uploadedInvoiceId) return;
    setProcessingLoading(true);
    setError(null);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || ""
        : "";

    try {
      // Step 1: Extract
      const extractRes = await apiClient.extractInvoice(uploadedInvoiceId, token);
      if (!extractRes.success) {
        setError(extractRes.error?.message || "Extraction failed");
        setProcessingLoading(false);
        return;
      }

      // Step 2: Process & verify
      const processRes = await apiClient.processInvoice(uploadedInvoiceId, token);
      if (processRes.success) {
        setPipelineStatus("RISK_EVALUATED");
        setProcessResult(processRes.data);
      } else {
        setError(processRes.error?.message || "Processing failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Processing error");
    } finally {
      setProcessingLoading(false);
    }
  };

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

          <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-xs font-semibold text-destructive">
                {error}
              </div>
            )}

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Vendor ID</span>
              <input
                required
                placeholder="Enter the registered vendor ID"
                value={selectedVendor}
                onChange={(e) => setSelectedVendor(e.target.value)}
                className="rounded-2xl border border-input bg-card px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Purchase Order Number</span>
              <input
                placeholder={type === "NON_PO" ? "Not required for non-PO invoices" : "Enter the PO number"}
                value={selectedPO}
                onChange={(e) => setSelectedPO(e.target.value)}
                disabled={type === "NON_PO"}
                className="rounded-2xl border border-input bg-card px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
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
                {selectedFile ? selectedFile.name : "Drop invoice here or browse"}
              </span>
              <span className="text-xs text-muted-foreground">PDF / JPG / PNG (Max 10MB)</span>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.tiff"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) setError(null);
                }}
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {loading ? "Uploading to Server..." : "Submit Bill"}
            </button>
          </form>
        </Card>

        <div className="flex flex-col gap-5">
          {submitted && uploadedInvoiceId ? (
            <Card className="bg-primary-deep text-primary-foreground">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="size-5" />
                <p className="text-sm font-bold">Bill submitted to server successfully.</p>
              </div>
              <p className="mt-6 text-xs text-white/60">Persistent Invoice ID</p>
              <p className="text-xl font-extrabold tracking-tight break-all font-mono">{uploadedInvoiceId}</p>
              <p className="mt-4 text-xs text-white/60">Pipeline Status</p>
              <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">
                <span className="size-2 rounded-full bg-accent" />
                {pipelineStatus || "SUBMITTED"}
              </p>

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleRunProcessing}
                  disabled={processingLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-bold text-primary-deep transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {processingLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Play className="size-4" />
                  )}
                  {processingLoading ? "Running Extraction & Verification..." : "Run Pipeline Verification"}
                </button>
              </div>

              {processResult && (
                <div className="mt-4 rounded-xl bg-black/20 p-3 text-xs">
                  <p className="font-bold">Risk Assessment:</p>
                  <p>Score: {processResult.risk?.score} ({processResult.risk?.level})</p>
                  <p>Category: {processResult.categorization?.category}</p>
                  <p>Decision: {processResult.risk?.decision}</p>
                </div>
              )}
            </Card>
          ) : null}

          <Card>
            <CardHead title="What happens next" sub="Deterministic backend pipeline" />
            <ol className="flex flex-col gap-3">
              {[
                "Document intake (MongoDB)",
                "Extraction (Deterministic OCR)",
                "Categorization & GL mapping",
                "GST / Vendor / PO checks",
                "Anomaly & Risk assessment",
                "Related invoice analysis",
                "Finance review queue",
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
