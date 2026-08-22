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
} from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, StatCard, StatusChip } from "@/components/kit";
import { invoices, inr, monthlyVolume, STATUS_LABEL } from "@/lib/mock-data";

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
  const [procurementData, setProcurementData] = useState<any>(null);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const token = localStorage.getItem("firebaseToken");
        const email = localStorage.getItem("userEmail");
        setUserEmail(email || "Officer");

        if (!token) {
          return;
        }

        // Dynamic import ensures this only runs on the client
        const { apiClient } = await import("@/lib/api");
        const result = await apiClient.getProcurementDashboard(token);
        if (result.success && result.data) {
          setProcurementData(result.data);
        }
      } catch (err) {
        console.error("Failed to load procurement dashboard", err);
        // Fall back to mock data - don't show error
      }
    };

    loadDashboard();
  }, []);

  const recent = invoices.slice(0, 4);
  const max = Math.max(...monthlyVolume.map((m) => m.a));

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
            <p className="mt-8 text-5xl font-extrabold tracking-tight">24</p>
            <div className="mt-6 flex items-center justify-between text-xs text-white/70">
              <span>ABC Technologies · XYZ Systems</span>
              <span className="font-bold text-primary-foreground">{inr(383000)}</span>
            </div>
          </Card>

          <StatCard
            icon={<Loader2 className="size-4.5" />}
            label="Processing"
            value="7"
            hint="Extraction & verification"
            delta="+2.8%"
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
            <p className="text-5xl font-extrabold tracking-tight">5</p>
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
            value="12"
            hint="Cleared for payment"
            delta="+12.8%"
          />
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHead
            icon={<FileText className="size-4.5" />}
            title="Recent Bills"
            sub="Latest vendor submissions"
          />
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
                      <p className="text-[11px] text-muted-foreground">{inv.invoiceDate}</p>
                    </td>
                    <td className="py-3 text-sm">{inv.vendorName}</td>
                    <td className="py-3 text-sm text-muted-foreground">{inv.poNumber}</td>
                    <td className="py-3">
                      <StatusChip label={STATUS_LABEL[inv.status]} />
                    </td>
                    <td className="py-3 text-right text-sm font-bold">{inr(inv.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHead
            icon={<Wallet className="size-4.5" />}
            title="Pipeline"
            sub="Where bills currently sit"
          />
          <div className="flex flex-col gap-3">
            {[
              { label: "Extraction", value: 7, total: 24 },
              { label: "Verification", value: 4, total: 24 },
              { label: "Risk Analysis", value: 3, total: 24 },
              { label: "Finance Review", value: 5, total: 24 },
              { label: "Approved", value: 12, total: 24 },
            ].map((row) => (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-xs">
                  <span className="font-semibold text-muted-foreground">{row.label}</span>
                  <span className="font-bold">{row.value}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(row.value / row.total) * 100}%` }}
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
