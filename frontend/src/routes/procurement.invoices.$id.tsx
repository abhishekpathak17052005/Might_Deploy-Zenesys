import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Download, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Card, CardHead } from "@/components/kit";
import {
  CategoryCard,
  InvoiceHeader,
  InvoiceInformation,
  Verification,
} from "@/components/review-sections";
import { getInvoice, STATUS_FLOW, STATUS_LABEL } from "@/lib/mock-data";

export const Route = createFileRoute("/procurement/invoices/$id")({
  loader: ({ params }) => {
    const invoice = getInvoice(params.id);
    if (!invoice) throw notFound();
    return { invoice };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Invoice unavailable — InvoiceFlow" }, { name: "robots", content: "noindex" }] };
    }
    const t = `${loaderData.invoice.invoiceNumber} status — InvoiceFlow`;
    const d = `Track extraction, verification and risk progress for ${loaderData.invoice.invoiceNumber}.`;
    return {
      meta: [
        { title: t },
        { name: "description", content: d },
        { property: "og:title", content: t },
        { property: "og:description", content: d },
      ],
    };
  },
  component: InvoiceStatus,
  notFoundComponent: () => (
    <AppShell role="Procurement" title="Invoice not found">
      <Card>
        <p className="text-sm text-muted-foreground">
          That invoice ID doesn't exist in the system.
        </p>
      </Card>
    </AppShell>
  ),
});

function InvoiceStatus() {
  const { invoice } = Route.useLoaderData();
  const currentIndex = STATUS_FLOW.indexOf(invoice.status);

  return (
    <AppShell
      role="Procurement"
      title={invoice.invoiceNumber}
      subtitle={`${invoice.vendorName} · ${invoice.poNumber}`}
      actions={
        <>
          <button className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs font-semibold shadow-card">
            <Download className="size-4 text-muted-foreground" />
            Download Invoice
          </button>
          <Link
            to="/finance/invoices/$id"
            params={{ id: invoice.id }}
            className="rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
          >
            Open Finance Review
          </Link>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <InvoiceHeader invoice={invoice} />

        <Card>
          <CardHead
            icon={<RouteIcon className="size-4.5" />}
            title="Status Tracking"
            sub="Pipeline progress"
          />
          <div className="flex flex-wrap gap-4">
            {[...STATUS_FLOW, "Payment"].map((step, i) => {
              const label = step === "Payment" ? "Payment" : STATUS_LABEL[step as never];
              const done = i < currentIndex;
              const active = i === currentIndex;
              return (
                <div key={label} className="flex min-w-[130px] flex-1 flex-col gap-2">
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className={`h-1.5 rounded-full ${
                        done ? "bg-primary" : active ? "bg-accent" : "bg-transparent"
                      }`}
                      style={{ width: done ? "100%" : active ? "55%" : "0%" }}
                    />
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      done || active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {done ? "✓ Complete" : active ? "● In progress" : "○ Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <InvoiceInformation invoice={invoice} />
          <Verification invoice={invoice} />
          <CategoryCard invoice={invoice} />
        </div>
      </div>
    </AppShell>
  );
}
