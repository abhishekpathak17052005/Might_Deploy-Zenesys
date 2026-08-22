import type { ReactNode } from "react";
import { ArrowUpRight, Check, Minus } from "lucide-react";
import type { RiskLevel } from "@/lib/mock-data";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card-surface p-4 card-reveal ${className}`}>{children}</section>;
}

export function CardHead({
  icon,
  title,
  sub,
  right,
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="grid size-9 place-items-center rounded-xl bg-muted text-foreground">
            {icon}
          </span>
        ) : null}
        <div>
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
          {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
        </div>
      </div>
      {right ?? (
        <span className="grid size-8 place-items-center rounded-lg border border-border text-muted-foreground">
          <ArrowUpRight className="size-4" />
        </span>
      )}
    </div>
  );
}

export function StatCard({
  icon,
  label,
  value,
  hint,
  delta,
  tone = "plain",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint?: string;
  delta?: string;
  tone?: "plain" | "deep";
}) {
  const deep = tone === "deep";
  return (
    <div
      className={`card-surface p-4 card-reveal card-interactive ${deep ? "bg-primary-deep text-primary-foreground" : ""}`}
    >
      <div className="flex items-start justify-between">
        <span
          className={`grid size-9 place-items-center rounded-xl ${
            deep ? "bg-white/15" : "bg-muted"
          }`}
        >
          {icon}
        </span>
        {delta ? (
          <span
            className={`rounded-full px-2 py-1 text-[11px] font-bold ${
              deep ? "bg-accent text-accent-foreground" : "bg-primary-soft text-primary-deep"
            }`}
          >
            {delta}
          </span>
        ) : null}
      </div>
      <p className={`mt-4 text-xs font-semibold ${deep ? "text-white/70" : "text-muted-foreground"}`}>
        {label}
      </p>
      <div className="mt-1 flex items-end justify-between gap-2">
        <p className="text-3xl font-extrabold tracking-tight">{value}</p>
        {hint ? (
          <p className={`text-[11px] leading-tight ${deep ? "text-white/60" : "text-muted-foreground"}`}>
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function RiskPill({ level, score }: { level: RiskLevel; score?: number }) {
  const map: Record<RiskLevel, string> = {
    HIGH: "bg-destructive/12 text-destructive",
    MEDIUM: "bg-warning/15 text-warning",
    LOW: "bg-primary-soft text-primary-deep",
  };
  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${map[level]}`}>
      {level} RISK{score !== undefined ? ` · ${score}` : ""}
    </span>
  );
}

export function Dot({ level }: { level: RiskLevel }) {
  const map: Record<RiskLevel, string> = {
    HIGH: "bg-destructive",
    MEDIUM: "bg-warning",
    LOW: "bg-caution",
  };
  return <span className={`inline-block size-2.5 rounded-full ${map[level]}`} />;
}

export function StatusChip({ label }: { label: string }) {
  const approved = label === "Approved";
  const rejected = label === "Rejected";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        rejected
          ? "bg-destructive/12 text-destructive"
          : approved
            ? "bg-primary-soft text-primary-deep"
            : "bg-muted text-muted-foreground"
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          rejected ? "bg-destructive" : approved ? "bg-primary" : "bg-muted-foreground"
        }`}
      />
      {label}
    </span>
  );
}

export function CheckRow({ label, value }: { label: string; value: string }) {
  const unavailable = value === "Not Connected";
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`inline-flex items-center gap-1.5 text-sm font-semibold ${
          unavailable ? "text-muted-foreground" : "text-primary-deep"
        }`}
      >
        {unavailable ? <Minus className="size-3.5" /> : <Check className="size-3.5" />}
        {value}
      </span>
    </div>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
