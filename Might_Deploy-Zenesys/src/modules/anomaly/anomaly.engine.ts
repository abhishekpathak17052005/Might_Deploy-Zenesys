import { mergeAnomalyConfig } from "./anomaly.config";
import { parseDate, sameVendor } from "./anomaly.helpers";
import type {
  AnomalyContext,
  AnomalyResult,
  AnomalyRule,
  AnomalySignal,
  DecisionStatus,
  RiskLevel,
  RuleConfig
} from "./anomaly.types";
import { AmountMismatchRule } from "./rules/amountMismatch.rule";
import { DateAnomalyRule } from "./rules/dateAnomaly.rule";
import { DuplicateInvoiceRule } from "./rules/duplicateInvoice.rule";
import { GstinRule } from "./rules/gstin.rule";
import { PoNotFoundRule } from "./rules/poNotFound.rule";
import { QuantityMismatchRule } from "./rules/quantityMismatch.rule";
import { RoundAmountRule } from "./rules/roundAmount.rule";
import { SplitInvoiceRule } from "./rules/splitInvoice.rule";
import { UnusualAmountRule } from "./rules/unusualAmount.rule";
import { VendorVerificationRule } from "./rules/vendorVerification.rule";

export class AnomalyEngine {
  private readonly rules: AnomalyRule[];
  private readonly config: RuleConfig;

  constructor(config?: Partial<RuleConfig>, rules?: AnomalyRule[]) {
    this.config = mergeAnomalyConfig(config);
    this.rules =
      rules ?? [
        new DuplicateInvoiceRule(),
        new PoNotFoundRule(),
        new AmountMismatchRule(),
        new QuantityMismatchRule(),
        new VendorVerificationRule(),
        new UnusualAmountRule(),
        new DateAnomalyRule(),
        new GstinRule(),
        new RoundAmountRule(),
        new SplitInvoiceRule()
      ];
  }

  async evaluate(input: Omit<AnomalyContext, "ruleConfig" | "currentDate"> & Partial<Pick<AnomalyContext, "ruleConfig" | "currentDate">>): Promise<AnomalyResult> {
    const startedAt = Date.now();
    const ruleConfig = mergeAnomalyConfig(input.ruleConfig);
    const context: AnomalyContext = {
      ...input,
      historicalInvoices: input.historicalInvoices ?? [],
      recentInvoices: input.recentInvoices ?? [],
      ruleConfig,
      currentDate: input.currentDate ?? new Date()
    };

    const signals: AnomalySignal[] = [];
    const ruleFailures: string[] = [];
    let evaluatedRuleCount = 0;

    console.info("anomaly.engine.started", {
      invoiceId: context.invoice.id,
      ruleCount: this.rules.length
    });

    for (const rule of this.rules) {
      const enabled = rule.enabled && ruleConfig.enabledRules[rule.id] !== false;
      if (!enabled) continue;
      evaluatedRuleCount += 1;

      try {
        console.info("anomaly.rule.executing", { ruleId: rule.id, invoiceId: context.invoice.id });
        const signal = await rule.evaluate(context);
        if (signal) {
          signals.push(signal);
          console.info("anomaly.rule.signal", {
            ruleId: rule.id,
            type: signal.type,
            severity: signal.severity,
            invoiceId: context.invoice.id
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown rule failure";
        ruleFailures.push(`${rule.id}: ${message}`);
        console.error("anomaly.rule.failed", { ruleId: rule.id, invoiceId: context.invoice.id, error: message });
      }
    }

    const uniqueSignals = this.dedupeSignals(signals);
    const correlatedSignal = this.evaluateCorrelations(uniqueSignals, context);
    const finalSignals = correlatedSignal ? this.dedupeSignals([...uniqueSignals, correlatedSignal]) : uniqueSignals;
    const score = Math.min(
      100,
      Math.max(
        0,
        finalSignals.reduce((sum, signal) => sum + signal.score, 0)
      )
    );
    const level = this.getRiskLevel(score, ruleConfig);
    const decision = this.getDecision(finalSignals, level);
    const executionDurationMs = Date.now() - startedAt;

    console.info("anomaly.engine.completed", {
      invoiceId: context.invoice.id,
      signalCount: finalSignals.length,
      riskScore: score,
      riskLevel: level,
      executionDurationMs,
      ruleFailures
    });

    return {
      invoiceId: context.invoice.id,
      risk: { score, level },
      signals: finalSignals,
      decision,
      metadata: {
        evaluatedRuleCount,
        signalCount: finalSignals.length,
        executionDurationMs,
        ruleFailures
      }
    };
  }

  private dedupeSignals(signals: AnomalySignal[]): AnomalySignal[] {
    const hasVendorGstinMismatch = signals.some((signal) => signal.type === "VENDOR_GSTIN_MISMATCH");
    const seen = new Set<string>();
    const result: AnomalySignal[] = [];

    for (const signal of signals) {
      if (hasVendorGstinMismatch && signal.type === "GSTIN_MISMATCH") continue;
      const key = `${signal.ruleId}:${signal.type}:${JSON.stringify(signal.evidence)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(signal);
    }

    return result;
  }

  private evaluateCorrelations(signals: AnomalySignal[], context: AnomalyContext): AnomalySignal | null {
    const types = new Set(signals.map((signal) => signal.type));
    
    // Calculate correlation bonuses based on signal combinations
    let correlationBonusScore = 0;
    const matchedPatterns: string[] = [];
    
    // Pattern 1: Unknown vendor + unusual amount
    if (types.has("VENDOR_NOT_IN_MASTER") && types.has("UNUSUAL_AMOUNT")) {
      correlationBonusScore += 10;
      matchedPatterns.push("vendor_and_amount_risk");
    }
    
    // Pattern 2: Unapproved vendor + amount mismatch
    if (types.has("VENDOR_NOT_APPROVED") && types.has("AMOUNT_MISMATCH")) {
      correlationBonusScore += 12;
      matchedPatterns.push("vendor_and_approval_risk");
    }
    
    // Pattern 3: Missing PO + unusual amount
    if (types.has("PO_NOT_FOUND") && types.has("UNUSUAL_AMOUNT")) {
      correlationBonusScore += 10;
      matchedPatterns.push("po_and_amount_risk");
    }
    
    // Pattern 4: Multiple duplicate patterns
    if (types.has("POTENTIAL_DUPLICATE_INVOICE") && types.has("SIMILAR_INVOICE")) {
      correlationBonusScore += 15;
      matchedPatterns.push("duplicate_patterns");
    }
    
    // Pattern 5: Split invoicing + stale invoice
    if (types.has("POTENTIAL_SPLIT_INVOICING") && types.has("STALE_INVOICE")) {
      correlationBonusScore += 8;
      matchedPatterns.push("split_and_temporal");
    }

    const correlationTypes = [
      "VENDOR_NOT_IN_MASTER",
      "VENDOR_NOT_APPROVED",
      "VENDOR_BANK_DETAILS_RECENTLY_CHANGED",
      "PO_NOT_FOUND",
      "MISSING_PO_REFERENCE",
      "NEAR_APPROVAL_THRESHOLD",
      "ROUND_AMOUNT",
      "POTENTIAL_DUPLICATE_INVOICE",
      "SIMILAR_INVOICE",
      "POTENTIAL_SPLIT_INVOICING",
      "AMOUNT_EXCEEDS_HISTORICAL_MAXIMUM",
      "UNUSUAL_AMOUNT"
    ];
    const matchedTypes = correlationTypes.filter((type) => types.has(type as AnomalySignal["type"]));

    const sameDayVendorInvoices = context.historicalInvoices.filter((invoice) => {
      const candidateDate = parseDate(invoice.invoiceDate);
      const currentDate = parseDate(context.invoice.invoiceDate);
      if (!candidateDate || !currentDate) return false;
      return sameVendor(context.invoice, invoice) && candidateDate.toDateString() === currentDate.toDateString();
    });

    const hasSameDayFrequency = sameDayVendorInvoices.length >= 1;
    if (hasSameDayFrequency) matchedTypes.push("SAME_DAY_VENDOR_INVOICE");

    if (matchedTypes.length < context.ruleConfig.correlationMinimumSignalCount) return null;

    const baseScore = context.ruleConfig.severityScores.HIGH;
    const finalCorrelationScore = Math.min(100, baseScore + correlationBonusScore);

    return {
      ruleId: "CORRELATION",
      type: "CORRELATED_HIGH_REVIEW_PRIORITY",
      severity: "HIGH",
      score: finalCorrelationScore,
      title: "Correlated high review priority",
      message: `Multiple deterministic conditions occurred together (${matchedTypes.join(", ")}) and increase review priority.`,
      evidence: [
        { field: "correlatedSignals", actual: matchedTypes },
        { field: "correlationPatterns", actual: matchedPatterns },
        { field: "correlationBonusScore", actual: correlationBonusScore },
        { field: "sameDayVendorInvoices", actual: sameDayVendorInvoices.map((invoice) => ({ id: invoice.id, amount: invoice.totalAmount })) }
      ],
      metadata: { layer: "CORRELATION", deterministic: true, bonusApplied: correlationBonusScore > 0 }
    };
  }

  private getRiskLevel(score: number, config: RuleConfig): RiskLevel {
    if (score <= config.riskThresholds.low) return "LOW";
    if (score <= config.riskThresholds.medium) return "MEDIUM";
    if (score <= config.riskThresholds.high) return "HIGH";
    return "CRITICAL";
  }

  private getDecision(signals: AnomalySignal[], level: RiskLevel): { status: DecisionStatus; reason: string } {
    if (signals.some((signal) => signal.type === "DUPLICATE_INVOICE" || signal.metadata?.hardBlock === true)) {
      return { status: "BLOCKED", reason: "Exact duplicate invoice detected" };
    }

    if (level === "CRITICAL") {
      return { status: "BLOCKED", reason: "Critical deterministic exception detected" };
    }

    if (level === "HIGH") {
      return { status: "REVIEW_REQUIRED", reason: "High-severity financial exception detected" };
    }

    if (level === "MEDIUM") {
      return { status: "REVIEW_REQUIRED", reason: "Medium-risk exception detected" };
    }

    return { status: "ELIGIBLE_FOR_AUTO_PROCESSING", reason: "No review-level deterministic exception detected" };
  }
}
