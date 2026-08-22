import assert from "node:assert/strict";
import { AnomalyEngine } from "../anomaly.engine";
import { AmountMismatchRule } from "../rules/amountMismatch.rule";
import { DateAnomalyRule } from "../rules/dateAnomaly.rule";
import { DuplicateInvoiceRule } from "../rules/duplicateInvoice.rule";
import { GstinRule } from "../rules/gstin.rule";
import { PoNotFoundRule } from "../rules/poNotFound.rule";
import { QuantityMismatchRule } from "../rules/quantityMismatch.rule";
import { RoundAmountRule } from "../rules/roundAmount.rule";
import { SplitInvoiceRule } from "../rules/splitInvoice.rule";
import { UnusualAmountRule } from "../rules/unusualAmount.rule";
import { VendorVerificationRule } from "../rules/vendorVerification.rule";
import { mergeAnomalyConfig } from "../anomaly.config";
import type { AnomalyContext, AnomalyRule, AnomalySignal, Severity } from "../anomaly.types";

type TestCase = { name: string; run: () => Promise<void> | void };

const baseContext = (overrides: Partial<AnomalyContext> = {}): AnomalyContext => ({
  invoice: {
    id: "INV-1",
    invoiceNumber: "INV-001",
    invoiceType: "PO_BASED",
    vendorId: "V1",
    vendorName: "ABC Technologies",
    poId: "PO1",
    totalAmount: 100,
    invoiceDate: "2026-08-20",
    gstin: "27ABCDE1234F1Z5",
    lineItems: []
  },
  vendor: { id: "V1", name: "ABC Technologies", gstin: "27ABCDE1234F1Z5", isActive: true },
  purchaseOrder: {
    id: "PO1",
    poNumber: "PO-1",
    vendorId: "V1",
    totalAmount: 100,
    poDate: "2026-08-01",
    lineItems: []
  },
  historicalInvoices: [],
  recentInvoices: [],
  ruleConfig: mergeAnomalyConfig(),
  currentDate: new Date("2026-08-20T00:00:00.000Z"),
  ...overrides
});

async function evalRule(rule: AnomalyRule, context: AnomalyContext): Promise<AnomalySignal | null> {
  return rule.evaluate(context);
}

class StaticRule implements AnomalyRule {
  id: string;
  name: string;
  enabled = true;
  private signal: AnomalySignal;

  constructor(id: string, severity: Severity) {
    this.id = id;
    this.name = id;
    this.signal = {
      ruleId: id,
      type: "ROUND_AMOUNT",
      severity,
      score: mergeAnomalyConfig().severityScores[severity],
      title: id,
      message: id,
      evidence: [{ field: id }]
    };
  }

  async evaluate(): Promise<AnomalySignal | null> {
    return this.signal;
  }
}

const tests: TestCase[] = [
  {
    name: "duplicate: exact duplicate",
    run: async () => {
      const signal = await evalRule(new DuplicateInvoiceRule(), baseContext({ historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-001", totalAmount: 50 }] }));
      assert.equal(signal?.type, "DUPLICATE_INVOICE");
    }
  },
  {
    name: "duplicate: same vendor amount date",
    run: async () => {
      const signal = await evalRule(new DuplicateInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, invoiceNumber: "NEW", totalAmount: 200 }, recentInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "OLD", totalAmount: 200, invoiceDate: "2026-08-19" }] }));
      assert.equal(signal?.type, "POTENTIAL_DUPLICATE_INVOICE");
    }
  },
  {
    name: "duplicate: different vendor",
    run: async () => {
      const signal = await evalRule(new DuplicateInvoiceRule(), baseContext({ historicalInvoices: [{ id: "OLD", vendorId: "V2", invoiceNumber: "INV-001", totalAmount: 100 }] }));
      assert.equal(signal, null);
    }
  },
  {
    name: "duplicate: different invoice number",
    run: async () => {
      const signal = await evalRule(new DuplicateInvoiceRule(), baseContext({ historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-002", totalAmount: 50, invoiceDate: "2026-08-20" }] }));
      assert.equal(signal, null);
    }
  },
  {
    name: "duplicate: outside duplicate window",
    run: async () => {
      const signal = await evalRule(new DuplicateInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, invoiceNumber: "NEW" }, historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "OLD", totalAmount: 100, invoiceDate: "2026-07-01" }] }));
      assert.equal(signal, null);
    }
  },
  {
    name: "po: PO exists",
    run: async () => assert.equal(await evalRule(new PoNotFoundRule(), baseContext()), null)
  },
  {
    name: "po: PO missing",
    run: async () => {
      const signal = await evalRule(new PoNotFoundRule(), baseContext({ purchaseOrder: undefined }));
      assert.equal(signal?.type, "PO_NOT_FOUND");
    }
  },
  {
    name: "po: NON_PO invoice",
    run: async () => {
      const signal = await evalRule(new PoNotFoundRule(), baseContext({ invoice: { ...baseContext().invoice, invoiceType: "NON_PO" }, purchaseOrder: undefined }));
      assert.equal(signal, null);
    }
  },
  {
    name: "po: missing PO reference",
    run: async () => {
      const signal = await evalRule(new PoNotFoundRule(), baseContext({ invoice: { ...baseContext().invoice, poId: null, poNumber: null } }));
      assert.equal(signal?.type, "MISSING_PO_REFERENCE");
    }
  },
  {
    name: "amount: exact match",
    run: async () => assert.equal(await evalRule(new AmountMismatchRule(), baseContext()), null)
  },
  {
    name: "amount: within 5%",
    run: async () => assert.equal(await evalRule(new AmountMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 105 } })), null)
  },
  {
    name: "amount: above 5%",
    run: async () => assert.equal((await evalRule(new AmountMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 106 } })))?.severity, "MEDIUM")
  },
  {
    name: "amount: 15% mismatch",
    run: async () => assert.equal((await evalRule(new AmountMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 115 } })))?.severity, "HIGH")
  },
  {
    name: "amount: 30% mismatch",
    run: async () => assert.equal((await evalRule(new AmountMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 130 } })))?.severity, "CRITICAL")
  },
  {
    name: "quantity: exact quantity",
    run: async () => assert.equal(await evalRule(new QuantityMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, lineItems: [{ sku: "A", quantity: 10 }] }, purchaseOrder: { ...baseContext().purchaseOrder!, lineItems: [{ sku: "A", quantity: 10 }] } })), null)
  },
  {
    name: "quantity: lower quantity",
    run: async () => assert.equal(await evalRule(new QuantityMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, lineItems: [{ sku: "A", quantity: 8 }] }, purchaseOrder: { ...baseContext().purchaseOrder!, lineItems: [{ sku: "A", quantity: 10 }] } })), null)
  },
  {
    name: "quantity: higher quantity",
    run: async () => assert.equal((await evalRule(new QuantityMismatchRule(), baseContext({ invoice: { ...baseContext().invoice, lineItems: [{ sku: "A", quantity: 12 }] }, purchaseOrder: { ...baseContext().purchaseOrder!, lineItems: [{ sku: "A", quantity: 10 }] } })))?.type, "QUANTITY_MISMATCH")
  },
  {
    name: "quantity: missing line items",
    run: async () => assert.equal(await evalRule(new QuantityMismatchRule(), baseContext()), null)
  },
  {
    name: "vendor: valid vendor",
    run: async () => assert.equal(await evalRule(new VendorVerificationRule(), baseContext()), null)
  },
  {
    name: "vendor: unknown vendor",
    run: async () => assert.equal((await evalRule(new VendorVerificationRule(), baseContext({ vendor: undefined })))?.type, "VENDOR_NOT_IN_MASTER")
  },
  {
    name: "vendor: inactive vendor",
    run: async () => assert.equal((await evalRule(new VendorVerificationRule(), baseContext({ vendor: { ...baseContext().vendor!, isActive: false } })))?.type, "VENDOR_INACTIVE")
  },
  {
    name: "vendor: GSTIN mismatch",
    run: async () => assert.equal((await evalRule(new VendorVerificationRule(), baseContext({ vendor: { ...baseContext().vendor!, gstin: "27ABCDE1234F1Z6" } })))?.type, "VENDOR_GSTIN_MISMATCH")
  },
  {
    name: "historical: fewer than 3 invoices",
    run: async () => assert.equal(await evalRule(new UnusualAmountRule(), baseContext({ historicalInvoices: [{ totalAmount: 50 }, { totalAmount: 60 }] })), null)
  },
  {
    name: "historical: exactly 3 invoices normal amount",
    run: async () => assert.equal(await evalRule(new UnusualAmountRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 100 }, historicalInvoices: [{ totalAmount: 80 }, { totalAmount: 100 }, { totalAmount: 120 }] })), null)
  },
  {
    name: "historical: over 2x average",
    run: async () => assert.equal((await evalRule(new UnusualAmountRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 300 }, historicalInvoices: [{ totalAmount: 80 }, { totalAmount: 100 }, { totalAmount: 120 }] })))?.type, "UNUSUAL_AMOUNT")
  },
  {
    name: "date: valid date",
    run: async () => assert.equal(await evalRule(new DateAnomalyRule(), baseContext()), null)
  },
  {
    name: "date: future date",
    run: async () => assert.equal((await evalRule(new DateAnomalyRule(), baseContext({ invoice: { ...baseContext().invoice, invoiceDate: "2026-08-21" } })))?.type, "FUTURE_INVOICE_DATE")
  },
  {
    name: "date: stale invoice",
    run: async () => assert.equal((await evalRule(new DateAnomalyRule(), baseContext({ invoice: { ...baseContext().invoice, invoiceDate: "2026-08-20" }, purchaseOrder: { ...baseContext().purchaseOrder!, poDate: "2026-01-01" } })))?.type, "STALE_INVOICE")
  },
  {
    name: "gstin: valid format",
    run: async () => assert.equal(await evalRule(new GstinRule(), baseContext()), null)
  },
  {
    name: "gstin: invalid format",
    run: async () => assert.equal((await evalRule(new GstinRule(), baseContext({ invoice: { ...baseContext().invoice, gstin: "27XXXXXXXXXX" } })))?.type, "INVALID_GSTIN_FORMAT")
  },
  {
    name: "gstin: mismatch",
    run: async () => assert.equal((await evalRule(new GstinRule(), baseContext({ invoice: { ...baseContext().invoice, gstin: "27ABCDE1234F1Z6" } })))?.type, "GSTIN_MISMATCH")
  },
  {
    name: "round amount: normal amount",
    run: async () => assert.equal(await evalRule(new RoundAmountRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 51234 } })), null)
  },
  {
    name: "round amount: round amount",
    run: async () => assert.equal((await evalRule(new RoundAmountRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 100000 } })))?.type, "ROUND_AMOUNT")
  },
  {
    name: "round amount: below minimum",
    run: async () => assert.equal(await evalRule(new RoundAmountRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 40000 } })), null)
  },
  {
    name: "split: no split",
    run: async () => assert.equal(await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 48000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 } })), null)
  },
  {
    name: "split: combined above PO coverage",
    run: async () => assert.equal((await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 48000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 }, historicalInvoices: [{ id: "INV-2", vendorId: "V1", poId: "PO1", totalAmount: 47000, invoiceDate: "2026-08-20" }] })))?.type, "POTENTIAL_SPLIT_INVOICING")
  },
  {
    name: "split: combined below PO coverage",
    run: async () => assert.equal(await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 30000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 }, historicalInvoices: [{ id: "INV-2", vendorId: "V1", poId: "PO1", totalAmount: 30000, invoiceDate: "2026-08-20" }] })), null)
  },
  {
    name: "split: different vendors",
    run: async () => assert.equal(await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 48000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 }, historicalInvoices: [{ id: "INV-2", vendorId: "V2", poId: "PO1", totalAmount: 47000, invoiceDate: "2026-08-20" }] })), null)
  },
  {
    name: "split: different POs",
    run: async () => assert.equal(await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 48000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 }, historicalInvoices: [{ id: "INV-2", vendorId: "V1", poId: "PO2", totalAmount: 47000, invoiceDate: "2026-08-20" }] })), null)
  },
  {
    name: "split: outside time window",
    run: async () => assert.equal(await evalRule(new SplitInvoiceRule(), baseContext({ invoice: { ...baseContext().invoice, totalAmount: 48000 }, purchaseOrder: { ...baseContext().purchaseOrder!, totalAmount: 100000 }, historicalInvoices: [{ id: "INV-2", vendorId: "V1", poId: "PO1", totalAmount: 47000, invoiceDate: "2026-08-18" }] })), null)
  },
  {
    name: "scoring: LOW",
    run: async () => assert.equal((await new AnomalyEngine(undefined, [new StaticRule("LOW_RULE", "LOW")]).evaluate(baseContext())).risk.level, "LOW")
  },
  {
    name: "scoring: MEDIUM",
    run: async () => assert.equal((await new AnomalyEngine(undefined, [new StaticRule("MEDIUM_RULE", "MEDIUM"), new StaticRule("LOW_RULE", "LOW")]).evaluate(baseContext())).risk.level, "MEDIUM")
  },
  {
    name: "scoring: HIGH",
    run: async () => assert.equal((await new AnomalyEngine(undefined, [new StaticRule("HIGH1", "HIGH"), new StaticRule("HIGH2", "HIGH")]).evaluate(baseContext())).risk.level, "HIGH")
  },
  {
    name: "scoring: CRITICAL",
    run: async () => assert.equal((await new AnomalyEngine(undefined, [new StaticRule("C1", "CRITICAL"), new StaticRule("C2", "CRITICAL")]).evaluate(baseContext())).risk.level, "CRITICAL")
  },
  {
    name: "scoring: hard-block override",
    run: async () => assert.equal((await new AnomalyEngine().evaluate(baseContext({ historicalInvoices: [{ id: "OLD", vendorId: "V1", invoiceNumber: "INV-001" }] }))).decision.status, "BLOCKED")
  },
  {
    name: "scoring: multiple signals",
    run: async () => {
      const result = await new AnomalyEngine(undefined, [new StaticRule("A", "LOW"), new StaticRule("B", "MEDIUM"), new StaticRule("C", "HIGH")]).evaluate(baseContext());
      assert.equal(result.risk.score, 60);
      assert.equal(result.decision.status, "REVIEW_REQUIRED");
    }
  },
  {
    name: "correlation: weak correlation - insufficient signals",
    run: async () => {
      const result = await new AnomalyEngine(undefined, [new StaticRule("RULE1", "LOW")]).evaluate(baseContext());
      const hasCorrelation = result.signals.some((s) => s.type === "CORRELATED_HIGH_REVIEW_PRIORITY");
      assert.equal(hasCorrelation, false, "Should not create correlation signal with fewer than 3 matching signals");
    }
  },
  {
    name: "correlation: medium correlation - vendor + amount",
    run: async () => {
      class FlexibleRule implements AnomalyRule {
        id: string;
        name: string;
        enabled = true;
        signal: AnomalySignal;
        constructor(id: string, sig: AnomalySignal) {
          this.id = id;
          this.name = id;
          this.signal = sig;
        }
        async evaluate(): Promise<AnomalySignal | null> {
          return this.signal;
        }
      }
      const rule1 = new FlexibleRule("R1", {
        ruleId: "R1",
        type: "VENDOR_NOT_IN_MASTER",
        severity: "LOW",
        score: 10,
        title: "",
        message: "",
        evidence: []
      });
      const rule2 = new FlexibleRule("R2", {
        ruleId: "R2",
        type: "UNUSUAL_AMOUNT",
        severity: "LOW",
        score: 10,
        title: "",
        message: "",
        evidence: []
      });
      const rule3 = new FlexibleRule("R3", {
        ruleId: "R3",
        type: "PO_NOT_FOUND",
        severity: "LOW",
        score: 10,
        title: "",
        message: "",
        evidence: []
      });
      const result = await new AnomalyEngine(undefined, [rule1, rule2, rule3]).evaluate(baseContext());
      const correlationSignal = result.signals.find((s) => s.type === "CORRELATED_HIGH_REVIEW_PRIORITY");
      assert.ok(correlationSignal, "Should create correlation signal with 3+ signals");
      const patterns = correlationSignal?.evidence.find((e) => e.field === "correlationPatterns");
      assert.ok(patterns?.actual instanceof Array && patterns.actual.includes("vendor_and_amount_risk"), "Should detect vendor+amount correlation pattern");
      const bonusScore = correlationSignal?.evidence.find((e) => e.field === "correlationBonusScore");
      assert.ok(bonusScore && typeof bonusScore.actual === "number" && (bonusScore.actual as number) >= 10, "Should apply at least 10 point bonus for vendor+amount");
    }
  },
  {
    name: "correlation: strong correlation - duplicate patterns",
    run: async () => {
      class FlexibleRule implements AnomalyRule {
        id: string;
        name: string;
        enabled = true;
        signal: AnomalySignal;
        constructor(id: string, sig: AnomalySignal) {
          this.id = id;
          this.name = id;
          this.signal = sig;
        }
        async evaluate(): Promise<AnomalySignal | null> {
          return this.signal;
        }
      }
      const rules = [
        new FlexibleRule("R1", {
          ruleId: "R1",
          type: "POTENTIAL_DUPLICATE_INVOICE",
          severity: "MEDIUM",
          score: 20,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R2", {
          ruleId: "R2",
          type: "SIMILAR_INVOICE",
          severity: "MEDIUM",
          score: 20,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R3", {
          ruleId: "R3",
          type: "POTENTIAL_SPLIT_INVOICING",
          severity: "MEDIUM",
          score: 20,
          title: "",
          message: "",
          evidence: []
        })
      ];
      const result = await new AnomalyEngine(undefined, rules).evaluate(baseContext());
      const correlationSignal = result.signals.find((s) => s.type === "CORRELATED_HIGH_REVIEW_PRIORITY");
      assert.ok(correlationSignal, "Should create correlation signal");
      const bonusScore = correlationSignal?.evidence.find((e) => e.field === "correlationBonusScore");
      const bonus = bonusScore?.actual as number;
      assert.ok(bonus >= 15, `Should apply 15+ point bonus for duplicate patterns, got ${bonus}`);
    }
  },
  {
    name: "correlation: multiple patterns - cumulative bonus",
    run: async () => {
      class FlexibleRule implements AnomalyRule {
        id: string;
        name: string;
        enabled = true;
        signal: AnomalySignal;
        constructor(id: string, sig: AnomalySignal) {
          this.id = id;
          this.name = id;
          this.signal = sig;
        }
        async evaluate(): Promise<AnomalySignal | null> {
          return this.signal;
        }
      }
      const rules = [
        new FlexibleRule("R1", {
          ruleId: "R1",
          type: "VENDOR_NOT_IN_MASTER",
          severity: "LOW",
          score: 10,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R2", {
          ruleId: "R2",
          type: "UNUSUAL_AMOUNT",
          severity: "LOW",
          score: 10,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R3", {
          ruleId: "R3",
          type: "POTENTIAL_DUPLICATE_INVOICE",
          severity: "MEDIUM",
          score: 20,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R4", {
          ruleId: "R4",
          type: "SIMILAR_INVOICE",
          severity: "MEDIUM",
          score: 20,
          title: "",
          message: "",
          evidence: []
        })
      ];
      const result = await new AnomalyEngine(undefined, rules).evaluate(baseContext());
      const correlationSignal = result.signals.find((s) => s.type === "CORRELATED_HIGH_REVIEW_PRIORITY");
      assert.ok(correlationSignal, "Should create correlation signal");
      const bonusScore = correlationSignal?.evidence.find((e) => e.field === "correlationBonusScore");
      const bonus = bonusScore?.actual as number;
      assert.ok(bonus >= 25, `Should apply cumulative bonus (vendor+amount=10 + duplicate=15), got ${bonus}`);
    }
  },
  {
    name: "correlation: score cap at 100",
    run: async () => {
      class FlexibleRule implements AnomalyRule {
        id: string;
        name: string;
        enabled = true;
        signal: AnomalySignal;
        constructor(id: string, sig: AnomalySignal) {
          this.id = id;
          this.name = id;
          this.signal = sig;
        }
        async evaluate(): Promise<AnomalySignal | null> {
          return this.signal;
        }
      }
      const rules = [
        new FlexibleRule("R1", {
          ruleId: "R1",
          type: "VENDOR_NOT_IN_MASTER",
          severity: "CRITICAL",
          score: 50,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R2", {
          ruleId: "R2",
          type: "UNUSUAL_AMOUNT",
          severity: "CRITICAL",
          score: 50,
          title: "",
          message: "",
          evidence: []
        }),
        new FlexibleRule("R3", {
          ruleId: "R3",
          type: "POTENTIAL_DUPLICATE_INVOICE",
          severity: "CRITICAL",
          score: 50,
          title: "",
          message: "",
          evidence: []
        })
      ];
      const result = await new AnomalyEngine(undefined, rules).evaluate(baseContext());
      assert.equal(result.risk.score <= 100, true, "Final risk score should never exceed 100");
    }
  },
  {
    name: "quantity: single invoice within PO",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 80 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        }
      }));
      assert.equal(signal, null, "Should not flag when quantity is within PO");
    }
  },
  {
    name: "quantity: single invoice exceeds PO",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 120 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        }
      }));
      assert.equal(signal?.type, "QUANTITY_MISMATCH");
      assert.equal(signal?.severity, "MEDIUM", "Single invoice mismatch should be MEDIUM severity");
      assert.equal(signal?.metadata?.aggregated, false, "Should mark as not aggregated");
    }
  },
  {
    name: "quantity: multiple invoices within combined PO",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          id: "INV-A",
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 35 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        },
        historicalInvoices: [
          { id: "INV-B", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L2", sku: "SKU-1", quantity: 35 }], invoiceDate: "2026-08-19" },
          { id: "INV-C", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L3", sku: "SKU-1", quantity: 20 }], invoiceDate: "2026-08-18" }
        ]
      }));
      assert.equal(signal, null, "Should not flag when combined quantity is within PO");
    }
  },
  {
    name: "quantity: multiple invoices exceed combined PO",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          id: "INV-A",
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 35 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        },
        historicalInvoices: [
          { id: "INV-B", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L2", sku: "SKU-1", quantity: 35 }], invoiceDate: "2026-08-19" },
          { id: "INV-C", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L3", sku: "SKU-1", quantity: 35 }], invoiceDate: "2026-08-18" }
        ]
      }));
      assert.equal(signal?.type, "QUANTITY_MISMATCH");
      assert.equal(signal?.severity, "HIGH", "Aggregated quantity mismatch should be HIGH severity");
      assert.equal(signal?.metadata?.aggregated, true, "Should mark as aggregated");
      const evidence = signal?.evidence[0];
      assert.ok(evidence && evidence.actual === 105, `Aggregated quantity should be 105, got ${evidence?.actual}`);
    }
  },
  {
    name: "quantity: different vendors - no aggregation",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          id: "INV-A",
          vendorId: "V1",
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 60 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        },
        historicalInvoices: [
          { id: "INV-B", vendorId: "V2", poId: "PO1", lineItems: [{ id: "L2", sku: "SKU-1", quantity: 50 }], invoiceDate: "2026-08-19" }
        ]
      }));
      assert.equal(signal, null, "Should not aggregate quantities from different vendors");
    }
  },
  {
    name: "quantity: different POs - no aggregation",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          id: "INV-A",
          poId: "PO1",
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 60 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          id: "PO1",
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        },
        historicalInvoices: [
          { id: "INV-B", vendorId: "V1", poId: "PO2", lineItems: [{ id: "L2", sku: "SKU-1", quantity: 50 }], invoiceDate: "2026-08-19" }
        ]
      }));
      assert.equal(signal, null, "Should not aggregate quantities from different POs");
    }
  },
  {
    name: "quantity: avoid double-counting current invoice",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          id: "INV-A",
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 35 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        },
        historicalInvoices: [
          { id: "INV-A", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L2", sku: "SKU-1", quantity: 35 }], invoiceDate: "2026-08-20" },
          { id: "INV-B", vendorId: "V1", poId: "PO1", lineItems: [{ id: "L3", sku: "SKU-1", quantity: 35 }], invoiceDate: "2026-08-19" }
        ]
      }));
      assert.equal(signal, null, "Should not double-count current invoice in aggregation");
    }
  },
  {
    name: "quantity: missing line item identifiers - safe fallback",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          lineItems: [{ quantity: 120 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ quantity: 100 }]
        }
      }));
      assert.equal(signal, null, "Should safely skip matching when identifiers are missing");
    }
  },
  {
    name: "quantity: exact quantity match",
    run: async () => {
      const signal = await evalRule(new QuantityMismatchRule(), baseContext({
        invoice: {
          ...baseContext().invoice,
          lineItems: [{ id: "L1", sku: "SKU-1", quantity: 100 }]
        },
        purchaseOrder: {
          ...baseContext().purchaseOrder!,
          lineItems: [{ id: "PL1", sku: "SKU-1", quantity: 100 }]
        }
      }));
      assert.equal(signal, null, "Should not flag exact quantity matches");
    }
  }
];

async function run() {
  for (const test of tests) {
    await test.run();
    console.log(`ok - ${test.name}`);
  }
  console.log(`${tests.length} anomaly tests passed`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
