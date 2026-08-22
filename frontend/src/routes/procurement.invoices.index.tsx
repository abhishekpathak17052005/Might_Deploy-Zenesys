import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead, StatusChip } from "@/components/kit";
import { invoices, inr, STATUS_LABEL } from "@/lib/mock-data";

export const Route = createFileRoute("/procurement/invoices/")({
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
  return (
    <AppShell
      role="Procurement"
      title="Invoices"
      subtitle="Every bill pushed into the invoice system"
      actions={
        <Link
          to="/procurement/invoices/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
        >
          <Plus className="size-4" />
          Upload / Push Bill
        </Link>
      }
    >
      <Card>
        <CardHead icon={<FileText className="size-4.5" />} title="All Bills" sub="24 submitted" />
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
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-t border-border">
                  <td className="py-3.5">
                    <Link
                      to="/procurement/invoices/$id"
                      params={{ id: inv.id }}
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
                    <StatusChip label={STATUS_LABEL[inv.status]} />
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
