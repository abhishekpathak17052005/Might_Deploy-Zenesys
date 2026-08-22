export type InvoiceStatus =
  | "SUBMITTED"
  | "EXTRACTION_PENDING"
  | "EXTRACTION_COMPLETE"
  | "VERIFICATION_PENDING"
  | "RISK_EVALUATED"
  | "FINANCE_REVIEW"
  | "APPROVED"
  | "REJECTED";

export const STATUS_FLOW: InvoiceStatus[] = [
  "SUBMITTED",
  "EXTRACTION_PENDING",
  "EXTRACTION_COMPLETE",
  "VERIFICATION_PENDING",
  "RISK_EVALUATED",
  "FINANCE_REVIEW",
  "APPROVED",
];

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  SUBMITTED: "Submitted",
  EXTRACTION_PENDING: "Extraction Pending",
  EXTRACTION_COMPLETE: "Extraction Complete",
  VERIFICATION_PENDING: "Verification Pending",
  RISK_EVALUATED: "Risk Evaluated",
  FINANCE_REVIEW: "Finance Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type Invoice = {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  gstin: string;
  poNumber: string;
  category: string;
  categoryIcon: string;
  categoryConfidence: number;
  categoryReason: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: number;
  gst: number;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  verification: {
    gstinFormat: string;
    vendorGstinMatch: string;
    officialGstVerification: string;
    vendorStatus: string;
    poStatus: string;
    poVendor: string;
    taxStatus: string;
  };
  risk: {
    score: number;
    level: RiskLevel;
    decision: string;
    signals: { code: string; label: string; severity: RiskLevel; score: number; message: string }[];
  };
  related: { invoiceNumber: string; amount: number; date: string }[];
  poValue: number;
  approvalThreshold: number;
  explanation: string[];
  attention?: string;
};

export const invoices: Invoice[] = [
  {
    id: "INV-1024",
    invoiceNumber: "INV-1024",
    vendorName: "ABC Technologies",
    gstin: "27XXXXXXXXXXXXZ",
    poNumber: "PO-1001",
    category: "IT Equipment",
    categoryIcon: "💻",
    categoryConfidence: 94,
    categoryReason: "Laptop computers and related hardware",
    invoiceDate: "21 Aug 2026",
    dueDate: "20 Sep 2026",
    subtotal: 40677,
    gst: 7323,
    amount: 48000,
    currency: "INR",
    status: "FINANCE_REVIEW",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 78,
      level: "HIGH",
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "POTENTIAL_SPLIT_INVOICE",
          label: "Potential Split Invoice",
          severity: "HIGH",
          score: 25,
          message: "Two invoices from the same vendor and PO submitted within 24 hours.",
        },
        {
          code: "APPROVAL_THRESHOLD_PATTERN",
          label: "Approval Threshold Pattern",
          severity: "MEDIUM",
          score: 20,
          message: "Each invoice remains just below the ₹50,000 approval threshold.",
        },
        {
          code: "PO_COVERAGE_ANOMALY",
          label: "PO Coverage Anomaly",
          severity: "MEDIUM",
          score: 15,
          message: "Combined value consumes 95% of the purchase order.",
        },
        {
          code: "HISTORICAL_PATTERN",
          label: "Historical Pattern",
          severity: "LOW",
          score: 10,
          message: "Vendor has previously submitted paired invoices.",
        },
        {
          code: "AMOUNT_PATTERN",
          label: "Amount Pattern",
          severity: "LOW",
          score: 8,
          message: "Amounts cluster narrowly beneath the threshold.",
        },
      ],
    },
    related: [{ invoiceNumber: "INV-1023", amount: 47000, date: "20 Aug 2026" }],
    poValue: 100000,
    approvalThreshold: 50000,
    explanation: [
      "Two invoices from the same vendor and PO were submitted within the configured time window.",
      "Each invoice remains below the approval threshold, while their combined value represents 95% of the PO.",
    ],
    attention: "Potential split-invoice pattern",
  },
  {
    id: "INV-1023",
    invoiceNumber: "INV-1023",
    vendorName: "XYZ Systems",
    gstin: "29XXXXXXXXXXXXQ",
    poNumber: "PO-1002",
    category: "Professional Services",
    categoryIcon: "🧾",
    categoryConfidence: 89,
    categoryReason: "Consulting engagement and advisory hours",
    invoiceDate: "20 Aug 2026",
    dueDate: "19 Sep 2026",
    subtotal: 72034,
    gst: 12966,
    amount: 85000,
    currency: "INR",
    status: "FINANCE_REVIEW",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 42,
      level: "MEDIUM",
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "PO_AMOUNT_MISMATCH",
          label: "PO Amount Mismatch",
          severity: "MEDIUM",
          score: 22,
          message: "Invoice total exceeds remaining PO balance by ₹5,000.",
        },
        {
          code: "HISTORICAL_PATTERN",
          label: "Historical Pattern",
          severity: "LOW",
          score: 12,
          message: "Vendor billing cadence changed this quarter.",
        },
        {
          code: "AMOUNT_PATTERN",
          label: "Amount Pattern",
          severity: "LOW",
          score: 8,
          message: "Round-figure totals across recent submissions.",
        },
      ],
    },
    related: [{ invoiceNumber: "INV-1019", amount: 120000, date: "12 Aug 2026" }],
    poValue: 90000,
    approvalThreshold: 50000,
    explanation: [
      "The invoice total exceeds the remaining balance available on PO-1002.",
      "Vendor submitted a materially larger invoice on the same PO earlier this month.",
    ],
    attention: "PO amount mismatch",
  },
  {
    id: "INV-1019",
    invoiceNumber: "INV-1019",
    vendorName: "XYZ Systems",
    gstin: "29XXXXXXXXXXXXQ",
    poNumber: "PO-1002",
    category: "Software / SaaS",
    categoryIcon: "🧩",
    categoryConfidence: 91,
    categoryReason: "Annual platform subscription renewal",
    invoiceDate: "12 Aug 2026",
    dueDate: "11 Sep 2026",
    subtotal: 101695,
    gst: 18305,
    amount: 120000,
    currency: "INR",
    status: "RISK_EVALUATED",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 61,
      level: "MEDIUM",
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "PO_AMOUNT_MISMATCH",
          label: "PO Amount Mismatch",
          severity: "MEDIUM",
          score: 30,
          message: "Invoice value is 133% of the linked purchase order.",
        },
        {
          code: "PO_COVERAGE_ANOMALY",
          label: "PO Coverage Anomaly",
          severity: "MEDIUM",
          score: 19,
          message: "PO fully consumed by a single submission.",
        },
        {
          code: "AMOUNT_PATTERN",
          label: "Amount Pattern",
          severity: "LOW",
          score: 12,
          message: "Amount deviates from vendor's 6-month average.",
        },
      ],
    },
    related: [{ invoiceNumber: "INV-1023", amount: 85000, date: "20 Aug 2026" }],
    poValue: 90000,
    approvalThreshold: 50000,
    explanation: [
      "Invoice value exceeds the approved purchase order amount.",
      "No amendment record exists against PO-1002 for the additional value.",
    ],
    attention: "PO amount mismatch",
  },
  {
    id: "INV-1015",
    invoiceNumber: "INV-1015",
    vendorName: "Tech Corp",
    gstin: "24XXXXXXXXXXXXH",
    poNumber: "PO-1004",
    category: "Office Supplies",
    categoryIcon: "📦",
    categoryConfidence: 86,
    categoryReason: "Stationery, printer consumables and pantry stock",
    invoiceDate: "08 Aug 2026",
    dueDate: "07 Sep 2026",
    subtotal: 63559,
    gst: 11441,
    amount: 75000,
    currency: "INR",
    status: "FINANCE_REVIEW",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 34,
      level: "LOW",
      decision: "REVIEW_REQUIRED",
      signals: [
        {
          code: "NEW_VENDOR",
          label: "New Vendor",
          severity: "LOW",
          score: 20,
          message: "Vendor onboarded 21 days ago with limited billing history.",
        },
        {
          code: "HISTORICAL_PATTERN",
          label: "Historical Pattern",
          severity: "LOW",
          score: 14,
          message: "Insufficient history to establish a baseline.",
        },
      ],
    },
    related: [],
    poValue: 80000,
    approvalThreshold: 50000,
    explanation: [
      "Vendor has limited transaction history in the vendor master.",
      "No anomalies detected in extraction, GST format or PO matching.",
    ],
    attention: "New vendor — limited history",
  },
  {
    id: "INV-1012",
    invoiceNumber: "INV-1012",
    vendorName: "Nova Logistics",
    gstin: "07XXXXXXXXXXXXK",
    poNumber: "PO-1006",
    category: "Travel",
    categoryIcon: "✈️",
    categoryConfidence: 92,
    categoryReason: "Freight movement and courier charges",
    invoiceDate: "02 Aug 2026",
    dueDate: "01 Sep 2026",
    subtotal: 27966,
    gst: 5034,
    amount: 33000,
    currency: "INR",
    status: "APPROVED",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 12,
      level: "LOW",
      decision: "AUTO_CLEARED",
      signals: [
        {
          code: "AMOUNT_PATTERN",
          label: "Amount Pattern",
          severity: "LOW",
          score: 12,
          message: "Within vendor's historical range.",
        },
      ],
    },
    related: [],
    poValue: 40000,
    approvalThreshold: 50000,
    explanation: ["All deterministic checks passed with no material deviation."],
  },
  {
    id: "INV-1009",
    invoiceNumber: "INV-1009",
    vendorName: "Bright Utilities",
    gstin: "36XXXXXXXXXXXXB",
    poNumber: "PO-1007",
    category: "Utilities",
    categoryIcon: "⚡",
    categoryConfidence: 97,
    categoryReason: "Monthly electricity and water consumption",
    invoiceDate: "28 Jul 2026",
    dueDate: "27 Aug 2026",
    subtotal: 18644,
    gst: 3356,
    amount: 22000,
    currency: "INR",
    status: "EXTRACTION_PENDING",
    verification: {
      gstinFormat: "Valid",
      vendorGstinMatch: "Matched",
      officialGstVerification: "Not Connected",
      vendorStatus: "Exists in vendor master",
      poStatus: "PO Found",
      poVendor: "Matches",
      taxStatus: "Consistent",
    },
    risk: {
      score: 8,
      level: "LOW",
      decision: "AUTO_CLEARED",
      signals: [],
    },
    related: [],
    poValue: 30000,
    approvalThreshold: 50000,
    explanation: ["Document intake complete. Extraction in progress."],
  },
];

export const getInvoice = (id: string) =>
  invoices.find((i) => i.id.toLowerCase() === id.toLowerCase());

export const vendors = [
  "ABC Technologies",
  "XYZ Systems",
  "Tech Corp",
  "Nova Logistics",
  "Bright Utilities",
];

export const purchaseOrders = ["PO-1001", "PO-1002", "PO-1004", "PO-1006", "PO-1007"];

export const categories = [
  "IT Equipment",
  "Software / SaaS",
  "Office Supplies",
  "Travel",
  "Professional Services",
  "Utilities",
  "Raw Materials",
  "Maintenance",
  "Marketing",
  "Other",
];

export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const monthlyVolume = [
  { label: "JAN", a: 32, b: 18 },
  { label: "FEB", a: 26, b: 22 },
  { label: "MAR", a: 38, b: 15 },
  { label: "APR", a: 47, b: 28 },
  { label: "MAY", a: 34, b: 20 },
  { label: "JUN", a: 41, b: 25 },
];

export const categoryMix = [
  { label: "IT Equipment", value: 2487, delta: "+1.8%", up: true },
  { label: "Professional Services", value: 1828, delta: "+2.8%", up: true },
  { label: "Office Supplies", value: 1463, delta: "-1.2%", up: false },
];
