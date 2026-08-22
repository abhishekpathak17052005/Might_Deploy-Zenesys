import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck, Wallet, Boxes } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "InvoiceFlow — Invoice Risk & Approval Workspace" },
      {
        name: "description",
        content:
          "Submit vendor bills, track extraction and verification, and review risk evidence before approving payment.",
      },
      { property: "og:title", content: "InvoiceFlow — Invoice Risk & Approval Workspace" },
      {
        property: "og:description",
        content:
          "Procurement submits bills, the engine extracts and scores risk, finance approves with evidence.",
      },
    ],
  }),
  component: Login,
});

function Login() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="mx-auto grid max-w-[1100px] gap-6 rounded-4xl bg-surface p-6 shadow-[var(--shadow-shell)] md:grid-cols-2 md:p-10">
        <div className="flex flex-col justify-between gap-8">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">InvoiceFlow</span>
          </div>
          <div>
            <h1 className="text-4xl font-extrabold leading-[1.05] tracking-tight md:text-5xl">
              Don't just show the invoice.
              <span className="block text-primary">Show why to trust it.</span>
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground">
              Document intake, extraction, categorization, GST / vendor / PO checks, risk scoring
              and related-invoice analysis — surfaced as evidence for the finance decision.
            </p>
          </div>
          <div className="rounded-3xl bg-primary-deep p-6 text-primary-foreground">
            <p className="text-xs font-semibold text-white/60">Combined PO utilization detected</p>
            <p className="mt-2 text-4xl font-extrabold tracking-tight">95%</p>
            <p className="mt-2 text-xs text-white/70">
              INV-1023 + INV-1024 · same vendor · same PO · within 24 hours
            </p>
          </div>
        </div>

        <div className="card-surface flex flex-col gap-4 p-6">
          <div>
            <h2 className="text-sm font-bold">Continue as</h2>
            <p className="text-xs text-muted-foreground">Demo role selection</p>
          </div>

          <RoleCard
            to="/procurement/dashboard"
            icon={<Boxes className="size-5" />}
            title="Procurement Officer"
            desc="Submit vendor bills and track processing status."
          />
          <RoleCard
            to="/finance/dashboard"
            icon={<Wallet className="size-5" />}
            title="Finance Manager"
            desc="Review risk evidence, approve or reject payment."
            highlight
          />

          <div className="mt-auto rounded-2xl bg-muted p-4 text-xs text-muted-foreground">
            Risk scores, GST results, PO matching and categorization are produced by the backend.
            This interface only visualizes them.
          </div>
        </div>
      </div>
    </div>
  );
}

function RoleCard({
  to,
  icon,
  title,
  desc,
  highlight,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group flex items-center gap-4 rounded-2xl border p-4 transition-colors ${
        highlight
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-border hover:bg-muted"
      }`}
    >
      <span
        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
          highlight ? "bg-white/15" : "bg-muted"
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">{title}</span>
        <span className={`block text-xs ${highlight ? "text-white/70" : "text-muted-foreground"}`}>
          {desc}
        </span>
      </span>
      <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
