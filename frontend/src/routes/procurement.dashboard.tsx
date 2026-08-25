import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  ScanLine,
  Wallet,
  AlertCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, StatCard, StatusChip } from "@/components/kit";
import { invoices, inr, monthlyVolume, STATUS_LABEL } from "@/lib/mock-data";
import { apiClient, type InvoiceDocument } from "@/lib/api";

export const Route = createFileRoute("/procurement/dashboard")({
  head: () => ({
    meta: [
      { title: "Procurement Dashboard — InvoiceFlow" },
      {
        name: "description",
        content: "Track submitted vendor bills, processing status and finance review queue.",
      },
      { property: "og:title", content: "Procurement Dashboard — InvoiceFlow" },
      {
        property: "og:description",
        content: "Bills submitted, processing, finance review and approved counts at a glance.",
      },
    ],
  }),
  component: ProcurementDashboard,
});

function ProcurementDashboard() {
  const [userEmail, setUserEmail] = useState<string>("");
  const [dashboardInvoices, setDashboardInvoices] = useState<InvoiceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    submitted: 0,
    processing: 0,
    reviewed: 0,
    approved: 0,
  });

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem("token");
        const email = localStorage.getItem("userEmail");
        setUserEmail(email || "Officer");

        if (!token) {
          setError("No authentication token");
          return;
        }

        // Fetch invoices from backend
        const result = await apiClient.listInvoices(token);
        if (result.success && result.data) {
          const fetchedInvoices = result.data.documents;
          setDashboardInvoices(fetchedInvoices);

          // Calculate stats
          const submitted = fetchedInvoices.length;
          const processing = fetchedInvoices.filter(
            (inv) => inv.documentStatus === "PROCESSING" || inv.documentStatus === "EXTRACTION_IN_PROGRESS"
          ).length;
          const reviewed = fetchedInvoices.filter(
            (inv) => inv.documentStatus === "VERIFICATION_IN_PROGRESS" || inv.documentStatus === "RISK_ANALYSIS_IN_PROGRESS"
          ).length;
          const approved = fetchedInvoices.filter((inv) => inv.approvalStatus === "APPROVED").length;

          setStats({ submitted, processing, reviewed, approved });
          setError(null);
        } else {
          setError(result.error?.message || "Failed to fetch invoices");
          // Fall back to mock data
          setDashboardInvoices(invoices.slice(0, 10));
        }
      } catch (err) {
        console.error("Failed to load procurement dashboard", err);
        // Fall back to mock data
        setDashboardInvoices(invoices.slice(0, 10));
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const recent = dashboardInvoices.slice(0, 4);
  const max = Math.max(...monthlyVolume.map((m) => m.a));
  const totalValue = recent.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <AppShell
      role="Procurement"
      title={`Welcome Back, ${userEmail.split("@")[0]}`}
      subtitle="Procurement Officer · Vendor bill submissions"
      actions={
        <>
          <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">
            <CalendarDays className="size-4 text-muted-foreground" />
            29 Jun, 2026 – 29 Aug, 2026
          </span>
          <Link
            to="/procurement/invoices/new"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            Upload / Push Bill
          </Link>
        </>
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

      <div className="grid gap-5 xl:grid-cols-[1fr_1.15fr_1fr]">
        <div className="flex flex-col gap-5">
          <Card className="bg-primary-deep text-primary-foreground">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/60">Bills Submitted</p>
                <p className="text-[11px] text-white/50">Total value pushed this cycle</p>
              </div>
              <FileText className="size-5 text-white/70" />
            </div>
            <p className="mt-8 text-5xl font-extrabold tracking-tight">{stats.submitted}</p>
            <div className="mt-6 flex items-center justify-between text-xs text-white/70">
              <span>Total submitted</span>
              <span className="font-bold text-primary-foreground">{inr(totalValue)}</span>
            </div>
          </Card>

          <StatCard
            icon={<Loader2 className="size-4.5" />}
            label="Processing"
            value={stats.processing.toString()}
            hint="Extraction & verification"
            delta={stats.processing > 0 ? "+2.8%" : "0%"}
          />
        </div>

        <Card>
          <CardHead
            icon={<BarChart3 className="size-4.5" />}
            title="Submission Volume"
            sub="Bills pushed per month"
            right={
              <span className="flex items-center gap-1 rounded-full bg-muted p-1 text-[11px] font-semibold">
                <span className="rounded-full px-3 py-1 text-muted-foreground">Monthly</span>
                <span className="rounded-full bg-primary px-3 py-1 text-primary-foreground">
                  Annually
                </span>
              </span>
            }
          />
          <div className="flex h-64 items-end gap-4 border-b border-border pb-2">
            {monthlyVolume.map((m) => {
              const peak = m.a === max;
              return (
                <div key={m.label} className="flex flex-1 flex-col items-center gap-2">
                  {peak ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                      +17.8%
                    </span>
                  ) : null}
                  <div
                    className={`w-full rounded-t-2xl ${peak ? "bg-primary" : "bg-primary-soft"}`}
                    style={{ height: `${(m.a / max) * (peak ? 190 : 200)}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex gap-4">
            {monthlyVolume.map((m) => (
              <span
                key={m.label}
                className="flex-1 text-center text-[11px] font-semibold text-muted-foreground"
              >
                {m.label}
              </span>
            ))}
          </div>
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHead
              icon={<ScanLine className="size-4.5" />}
              title="Finance Review"
              sub="Awaiting decision"
            />
            <p className="text-5xl font-extrabold tracking-tight">{stats.reviewed}</p>
            <div className="mt-4 h-24 w-full overflow-hidden rounded-2xl bg-primary-soft">
              <svg viewBox="0 0 300 100" className="size-full" preserveAspectRatio="none">
                <path
                  d="M0,70 C30,40 50,80 80,55 C110,30 130,70 160,45 C190,20 210,60 240,40 C265,25 285,45 300,35 L300,100 L0,100 Z"
                  fill="var(--color-primary)"
                  opacity="0.18"
                />
                <path
                  d="M0,70 C30,40 50,80 80,55 C110,30 130,70 160,45 C190,20 210,60 240,40 C265,25 285,45 300,35"
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="3"
                />
              </svg>
            </div>
          </Card>

          <StatCard
            icon={<CheckCircle2 className="size-4.5" />}
            label="Approved"
            value={stats.approved.toString()}
            hint="Cleared for payment"
            delta={stats.approved > 0 ? "+12.8%" : "0%"}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead
            icon={<FileText className="size-4.5" />}
            title={loading ? "Loading Recent Bills..." : "Recent Bills"}
            sub="Latest vendor submissions"
          />
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No invoices submitted yet. <Link to="/procurement/invoices/new" className="text-primary">Upload one</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3">Invoice</th>
                    <th className="pb-3">Vendor</th>
                    <th className="pb-3">PO</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="py-3">
                        <Link
                          to="/procurement/invoices/$id"
                          params={{ id: inv.id }}
                          className="text-sm font-bold hover:text-primary"
                        >
                          {inv.invoiceNumber}
                        </Link>
                        <p className="text-[11px] text-muted-foreground">{new Date(inv.invoiceDate).toLocaleDateString()}</p>
                      </td>
                      <td className="py-3 text-sm">{inv.vendorName || inv.vendorId}</td>
                      <td className="py-3 text-sm text-muted-foreground">{inv.poNumber || "N/A"}</td>
                      <td className="py-3">
                        <StatusChip label={STATUS_LABEL[inv.documentStatus] || inv.documentStatus} />
                      </td>
                      <td className="py-3 text-right text-sm font-bold">{inr(inv.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card>
          <CardHead
            icon={<Wallet className="size-4.5" />}
            title="Pipeline"
            sub="Where bills currently sit"
          />
          <div className="flex flex-col gap-3">
            {[
              { label: "Submitted", value: stats.submitted },
              { label: "Processing", value: stats.processing },
              { label: "Reviewed", value: stats.reviewed },
              { label: "Approved", value: stats.approved },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">{row.label}</span>
                  <span className="font-bold">{row.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${stats.submitted > 0 ? (row.value / stats.submitted) * 100 : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
