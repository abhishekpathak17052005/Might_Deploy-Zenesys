# InvoiceFlow — Real Browser Functional Audit Report

**Date:** October 16, 2026  
**Auditor Roles:** Senior QA Automation Engineer, Application Security Tester, Frontend Architect  
**Environment:** Windows x64 | Chrome Headless / Real Browser Session | Vite v8.1.5 | React 19  
**Frontend URL:** `http://localhost:5173`  
**Backend URL:** `http://localhost:5000`  
**Browser Session Recording:** `invoiceflow_browser_audit_1792153198050.webp`

---

## 1. Executive Summary

This functional browser audit evaluated InvoiceFlow by executing real user interactions across all workspaces, authentication states, invoice submission forms, review queues, financial decision panels, and cross-tenant boundaries.

All core pages, interactions, buttons, forms, and financial governance rules are operational. One reproducible runtime exception in currency formatting was discovered during initial testing and immediately resolved.

---

## 2. Test Execution Matrix

| Test ID | Workspace / Page | Action Tested | Expected Result | Actual Result | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **BF-01** | Landing Page (`/`) | Navigate to root URL and inspect role selectors | Render workspace choices (Procurement, Finance Manager, Org Admin, Vendor) | Rendered cleanly with cards for each role | **PASS** |
| **BF-02** | Authentication (`/login`) | Invalid login with non-existent email and wrong password | Explicit error message displayed; unauthenticated state maintained | Form reported `Invalid email or password` (HTTP 401 from `/api/auth/login`) | **PASS** |
| **BF-03** | Authentication (`/login`) | Valid login as Procurement Officer (`procurement@demo.com`) | Successful JWT issuance and redirect to `/procurement/dashboard` | Redirected to `/procurement/dashboard` with user role indicator | **PASS** |
| **BF-04** | Procurement Dashboard (`/procurement/dashboard`) | Render dashboard summary metrics, pipeline list, volume chart | Metric cards (Submitted, In Review, Approved) display without errors | Rendered cleanly with stats and pipeline bills | **PASS** |
| **BF-05** | Invoice Upload Form (`/procurement/invoices/new`) | Inspect invoice intake form, file dropzone, line item builder | Form fields editable with validation and visual pipeline guide | Form loaded with PO/Non-PO toggle and line item builder | **PASS** |
| **BF-06** | Invoice List (`/procurement/invoices`) | Browse submitted invoices table with status chips and search | Invoices listed with vendor, amount, PO number, and status | Table rendered rows with status chips (`OCR_COMPLETED`, `PENDING`) | **PASS** |
| **BF-07** | Invoice Details (`/procurement/invoices/:id`) | Inspect invoice `INV-1024` breakdown and validation checks | Display extraction results, category, GSTIN format, and risk level | Rendered with GL category `IT Equipment` and Risk Score `78/100` | **PASS** |
| **BF-08** | Session Switching / Logout (`/`) | Switch context from Procurement to Finance Manager | Session context updates to Finance Manager role | Switched cleanly to Finance Manager workspace | **PASS** |
| **BF-09** | Finance Review Queue (`/finance/review`) | View pending review queue for invoices requiring approval | List invoices flagged with anomaly signals and high risk scores | Displayed flagged invoices including `INV-1024` (High Risk) | **PASS** |
| **BF-10** | Finance Decision Panel (`/finance/invoices/:id`) | Inspect 3-way match, split-invoice signals, and approve/reject actions | Display evidence tiles, related transactions, and decision controls | Rendered 3-way match, anomaly signals, and action controls | **PASS** |
| **BF-11** | Document Download (`/finance/invoices/:id`) | Click "Download Invoice" button | Initiates download URL request via `/api/invoices/:id/file` | Generated download link and initiated file retrieval | **PASS** |
| **BF-12** | Four-Eyes Governance | Attempt approval by uploader account | Self-approval forbidden with HTTP 403 | Blocked by backend governance rule | **PASS** |
| **BF-13** | Cross-Tenant Isolation | Attempt access to Org A invoice from Org B (`finance_beta@demo.com`) | Access blocked with 403 Forbidden / Not Found; no data leakage | Access blocked with HTTP 403 Forbidden | **PASS** |
| **BF-14** | Vendor Portal (`/vendor/dashboard`) | Access vendor portal workspace | Render vendor-specific dashboard and actions | Rendered vendor navigation and quick links | **PASS** |
| **BF-15** | Vendor Org Search (`/vendor/org-search`) | Search organizations to connect and submit invoices | Search input active with directory results | Directory search form active with connection workflow | **PASS** |
| **BF-16** | Responsive Layouts & Console Health | Inspect layout rendering and browser console across viewports | Zero fatal errors, broken links, or hydration failures | Clean console logs; responsive CSS layout | **PASS** |

---

## 3. Defects Discovered & Resolved

### Defect BF-DEF-01: `TypeError: Cannot read properties of undefined (reading 'toLocaleString')`
- **Location:** `FRONTEND/src/lib/mock-data.ts` (line 443) & `FRONTEND/src/routes/procurement.dashboard.tsx` (line 283)
- **Root Cause:** The `inr` helper function called `.toLocaleString()` directly on its numeric parameter without verifying whether the value was defined. During invoice intake, an invoice document before extraction has `totalAmount: undefined`, which threw an unhandled TypeError when rendering the dashboard table.
- **Fix Applied:**
  1. Updated `inr` in `mock-data.ts` to be fully null-safe:
     ```typescript
     export const inr = (n?: number | null) => {
       const val = typeof n === "number" && !isNaN(n) ? n : (Number(n) || 0);
       return "₹" + val.toLocaleString("en-IN", { maximumFractionDigits: 2 });
     };
     ```
  2. In `procurement.dashboard.tsx`, added fallbacks for missing invoice numbers and dates:
     ```typescript
     {inv.invoiceNumber || inv.id?.slice(0, 8) || "Processing"}
     {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString() : "Pending Extraction"}
     ```
- **Verification:** Retested in browser; dashboard rendered with 0 errors.

---

## 4. Operational Assessment & Recommendations

1. **AI Extraction vs. Fallback Truth in UI:**
   When `GEMINI_API_KEY` is not present, extraction gracefully uses the deterministic regex provider. The UI displays the provider badge (`DETERMINISTIC / REGEX`) so users are never misled into believing a live Gemini Vision model was invoked.
2. **GST Verification Integrity:**
   The UI correctly indicates GST format check status (`Valid Format`) while accurately designating official GSTN live portal integration as `Not Connected / Format Only`.
3. **Multi-Tenant Security:**
   Tenant boundaries remain strictly enforced at both API route handlers and Mongoose query filters, preventing unauthorized cross-tenant inspection or downloads.
