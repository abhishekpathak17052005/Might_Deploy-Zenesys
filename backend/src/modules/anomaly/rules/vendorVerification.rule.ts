import { ANOMALY_RULE_IDS } from "../anomaly.constants";
import { daysBetween, makeSignal, normalizeGstin, normalizeText, parseDate } from "../anomaly.helpers";
import type { AnomalyContext, AnomalyRule, AnomalySignal } from "../anomaly.types";

export class VendorVerificationRule implements AnomalyRule {
  id = ANOMALY_RULE_IDS.vendorVerification;
  name = "Vendor verification";
  enabled = true;

  async evaluate(context: AnomalyContext): Promise<AnomalySignal | null> {
    const { invoice, vendor, ruleConfig } = context;
    if (!vendor) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_NOT_IN_MASTER",
          severity: "HIGH",
          title: "Vendor not found in master data",
          message: "The invoice vendor was not provided in vendor master context.",
          evidence: [
            { field: "vendorId", actual: invoice.vendorId ?? null, expected: "Vendor master record" },
            { field: "vendorName", actual: invoice.vendorName ?? null, expected: "Vendor master record" }
          ]
        },
        ruleConfig.severityScores
      );
    }

    const invoiceGstin = normalizeGstin(invoice.gstin);
    const vendorGstin = normalizeGstin(vendor.gstin);
    if (invoiceGstin && vendorGstin && invoiceGstin !== vendorGstin) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_GSTIN_MISMATCH",
          severity: "HIGH",
          title: "Vendor GSTIN mismatch",
          message: "Invoice GSTIN differs from the GSTIN in vendor master data.",
          evidence: [{ field: "gstin", actual: invoiceGstin, expected: vendorGstin }]
        },
        ruleConfig.severityScores
      );
    }

    if (vendor.isActive === false) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_INACTIVE",
          severity: "HIGH",
          title: "Vendor is inactive",
          message: "The matched vendor master record is inactive.",
          evidence: [{ field: "isActive", actual: false, expected: true }]
        },
        ruleConfig.severityScores
      );
    }

    if (vendor.isApproved === false) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_NOT_APPROVED",
          severity: "HIGH",
          title: "Vendor is not approved",
          message: "The matched vendor master record is not approved for processing.",
          evidence: [{ field: "isApproved", actual: false, expected: true }]
        },
        ruleConfig.severityScores
      );
    }

    if (vendor.bankDetailsVerified === false) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_BANK_DETAILS_UNVERIFIED",
          severity: "MEDIUM",
          title: "Vendor bank details are not verified",
          message: "Vendor master data indicates bank details have not been verified.",
          evidence: [{ field: "bankDetailsVerified", actual: false, expected: true }]
        },
        ruleConfig.severityScores
      );
    }

    const bankUpdatedAt = parseDate(vendor.bankDetailsUpdatedAt);
    if (bankUpdatedAt && daysBetween(bankUpdatedAt, context.currentDate) <= ruleConfig.vendorBankChangeReviewDays) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_BANK_DETAILS_RECENTLY_CHANGED",
          severity: "MEDIUM",
          title: "Vendor bank details recently changed",
          message: "Vendor bank details changed within the configured review window.",
          evidence: [
            {
              field: "bankDetailsUpdatedAt",
              actual: vendor.bankDetailsUpdatedAt,
              expected: `Older than ${ruleConfig.vendorBankChangeReviewDays} days`
            }
          ],
          metadata: { reviewRequired: true }
        },
        ruleConfig.severityScores
      );
    }

    const invoiceLegalName = normalizeText(invoice.vendorName);
    const vendorLegalName = normalizeText(vendor.legalName);
    if (invoiceLegalName && vendorLegalName && invoiceLegalName !== vendorLegalName) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_LEGAL_NAME_MISMATCH",
          severity: "LOW",
          title: "Vendor legal name mismatch",
          message: "Invoice vendor name differs from the legal name in vendor master data.",
          evidence: [{ field: "vendorName", actual: invoice.vendorName, expected: vendor.legalName }]
        },
        ruleConfig.severityScores
      );
    }

    const idsMatch = invoice.vendorId && vendor.id && invoice.vendorId === vendor.id;
    const gstinsMatch = invoiceGstin && vendorGstin && invoiceGstin === vendorGstin;
    const namesMatch = normalizeText(invoice.vendorName) && normalizeText(invoice.vendorName) === normalizeText(vendor.name);
    if (!idsMatch && !gstinsMatch && !namesMatch) {
      return makeSignal(
        {
          ruleId: this.id,
          type: "VENDOR_MATCH_UNCERTAIN",
          severity: "LOW",
          title: "Vendor match is uncertain",
          message: "Vendor context exists, but GSTIN, vendor ID, and normalized name do not clearly match the invoice.",
          evidence: [
            { field: "vendorId", actual: invoice.vendorId ?? null, expected: vendor.id ?? null },
            { field: "vendorName", actual: invoice.vendorName ?? null, expected: vendor.name ?? null }
          ]
        },
        ruleConfig.severityScores
      );
    }

    return null;
  }
}
