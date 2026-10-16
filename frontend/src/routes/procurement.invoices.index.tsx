import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, StatusChip } from "@/components/kit";
import { inr, STATUS_LABEL } from "@/lib/mock-data";
import { apiClient, resolveVendorName } from "@/lib/api";
import { requireRole } from "@/lib/route-guards";

export const Route = createFileRoute("/procurement/invoices/")({
  beforeLoad: () => requireRole(["PROCUREMENT_OFFICER", "ORGANIZATION_ADMIN"]),
  head: () => ({
    meta: [
      { title: "Submitted Invoices — InvoiceFlow" },
      {
        name: "description",
        content: "All vendor bills pushed to the invoice system with live processing status.",
      },
      { property: "og:title", content: "Submitted Invoices — InvoiceFlow" },
      {
        property: "og:description",
        content: "Every submitted bill with vendor, PO, category and current pipeline stage.",
      },
    ],
  }),
  component: InvoiceList,
});

function InvoiceList() {
  const [items, setItems] = useState<any[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchInvoices = async () => {
    setLoading(true);
    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("token") || localStorage.getItem("invoiceflow_token") || ""
        : "";
    if (token) {
      try {
        const res = await apiClient.listInvoices(token);
        if (res.success && res.data) {
          const mapped = (res.data.documents || res.data.invoices || []).map((doc: any) => ({
            id: doc.id,
            invoiceNumber: doc.invoiceNumber || doc.id.slice(0, 8),
            invoiceDate: doc.invoiceDate ? new Date(doc.invoiceDate).toLocaleDateString() : new Date(doc.submittedAt).toLocaleDateString(),
            vendorName: resolveVendorName(doc),
            poNumber: doc.poNumber || "Non-PO",
            category: doc.category?.category || "General",
            categoryIcon: "📄",
            status: doc.documentStatus === "SUBMITTED" ? "INTAKE" : doc.documentStatus,
            amount: doc.totalAmount || 0,
          }));
          setItems(mapped);
          setIsLive(true);
        }
      } catch {
        setItems([]);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  return (
    <AppShell
      role="Procurement"
      title="Invoices"
      subtitle="Every bill pushed into the invoice system"
      actions={
        <div className="flex items-center gap-2">
          <button
            onClick={fetchInvoices}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link
            to="/procurement/invoices/new"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
          >
            <Plus className="size-4" />
            Upload / Push Bill
          </Link>
        </div>
      }
    >
      <Card>
        <CardHead
          icon={<FileText className="size-4.5" />}
          title="All Bills"
          sub={`${items.length} records ${isLive ? "(Live MongoDB data)" : ""}`}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="pb-3">Invoice</th>
                <th className="pb-3">Vendor</th>
                <th className="pb-3">PO</th>
                <th className="pb-3">Category</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="py-3.5">
                    <Link
                      to={"/procurement/invoices/$id" as any}
                      params={{ id: inv.id } as any}
                      className="text-sm font-bold hover:text-primary"
                    >
                      {inv.invoiceNumber}
                    </Link>
                    <p className="text-[11px] text-muted-foreground">{inv.invoiceDate}</p>
                  </td>
                  <td className="py-3.5 text-sm">{inv.vendorName}</td>
                  <td className="py-3.5 text-sm text-muted-foreground">{inv.poNumber}</td>
                  <td className="py-3.5 text-sm">
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                      {inv.categoryIcon} {inv.category}
                    </span>
                  </td>
                  <td className="py-3.5">
                    <StatusChip label={STATUS_LABEL[inv.status as keyof typeof STATUS_LABEL] || inv.status} />
                  </td>
                  <td className="py-3.5 text-right text-sm font-bold">{inr(inv.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </AppShell>
  );
}
