import type { Invoice, InvoiceStatus, RiskLevel } from "./mock-data";

export function toInvoiceView(input: any): Invoice {
  const source = input?.invoice || input?.data?.invoice || input?.data || input || {};
  const risk = source.riskResult || source.risk || {};
  const riskLevel = (risk.riskLevel || risk.level || "LOW") as RiskLevel;
  const findings = risk.findings || risk.signals || [];
  const status = String(source.documentStatus || source.status || "SUBMITTED") as InvoiceStatus;
  const amount = Number(source.totalAmount ?? source.amount ?? 0);
  const verification = source.verificationResult?.checks || source.verification || {};
  const category = source.category?.category || source.category || "Uncategorized";
  return {
    id: String(source._id || source.id || ""),
    invoiceNumber: source.invoiceNumber || "Pending extraction",
    vendorName: source.vendorName || source.vendorId?.name || "Unknown vendor",
    gstin: source.gstin || "Not provided",
    poNumber: source.poNumber || "Non-PO",
    category,
    categoryIcon: "📄",
    categoryConfidence: Number(source.category?.confidence || 0),
    categoryReason: source.category?.reason || "Category from invoice processing",
    invoiceDate: source.invoiceDate ? new Date(source.invoiceDate).toLocaleDateString() : "Pending extraction",
    dueDate: source.dueDate ? new Date(source.dueDate).toLocaleDateString() : "Not provided",
    subtotal: Number(source.subtotal || amount),
    gst: Number(source.gstAmount || source.taxAmount || 0),
    amount,
    currency: "INR",
    status,
    verification: {
      gstinFormat: String(verification.gstinFormat?.message || verification.gstinFormat || "Not available"),
      vendorGstinMatch: String(verification.vendorGstinMatch?.message || verification.vendorGstinMatch || "Not available"),
      officialGstVerification: String(verification.officialGstVerification?.message || verification.officialGstVerification || "Not configured"),
      vendorStatus: String(verification.vendorStatus?.message || verification.vendorStatus || "Not available"),
      poStatus: String(verification.poStatus?.message || verification.poStatus || "Not available"),
      poVendor: String(verification.poVendor?.message || verification.poVendor || "Not available"),
      taxStatus: String(verification.taxStatus?.message || verification.taxStatus || "Not available"),
    },
    risk: {
      score: Number(risk.riskScore ?? risk.score ?? 0),
      level: riskLevel,
      decision: risk.decision || "PENDING_REVIEW",
      signals: findings.map((finding: any, index: number) => ({
        code: finding.code || finding.type || `SIGNAL_${index + 1}`,
        label: finding.label || finding.type || "Risk signal",
        severity: (finding.severity || riskLevel) as RiskLevel,
        score: Number(finding.score || 0),
        message: finding.message || String(finding),
      })),
    },
    related: [],
    poValue: Number(source.poValue || amount),
    approvalThreshold: Number(source.approvalThreshold || 0),
    explanation: (source.explanation || []).map((item: any) => String(item)),
  };
}
