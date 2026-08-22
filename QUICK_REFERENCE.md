# Quick Reference - Enterprise Invoice Verification System

## 📁 File Locations

### New Backend Services
```
backend/src/modules/

categorization/
  ├── categorization.service.ts (keyword-based, 9 categories)
  ├── categorization.keywords.ts (keyword mappings + GL codes)
  └── categorization.types.ts (updated with GL account field)

verification/
  ├── gst.service.ts (format + vendor master)
  ├── vendor.service.ts (exists, active, approved)
  ├── po.service.ts (amount/quantity checks)
  ├── erp.provider.ts (ERPProvider interface + MockNetSuite)
  └── index.ts

processing/
  └── invoice-orchestrator.service.ts (central workflow)

notifications/
  ├── email.provider.ts (MockEmail + SMTPEmail)
  ├── notification.service.ts (service methods)
  └── index.ts

invoices/
  └── processing.contract.ts (Zod schemas)
```

### New Frontend
```
frontend/src/
  └── lib/
      └── api.client.ts (centralized HTTP requests)
```

### Documentation
```
project_root/
  ├── IMPLEMENTATION_STATUS.md
  ├── IMPLEMENTATION_GUIDE.md
  ├── PHASE_2_COMPLETION_REPORT.md
  └── QUICK_REFERENCE.md (this file)
```

---

## 🚀 Quick Setup

### Backend
```bash
cd backend
npm install
npm run build
npm run typecheck
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Environment (.env)
```env
GEMINI_API_KEY=AIzaSy_YOUR_KEY
GEMINI_EXTRACTION_MODEL=gemini-1.5-flash
CORS_ORIGIN=http://localhost:5173
```

---

## 🔄 Main Workflow

```
Invoice Upload
    ↓
Extraction (Gemini OCR)
    ↓
Categorization (Keyword → 9 categories → GL code)
    ↓
Vendor Verification (exists? active? approved?)
    ↓
GST Verification (format + vendor master)
    ↓
PO Verification (amount/qty within limits?)
    ↓
ERP Context (Load vendor, PO, GL from mock)
    ↓
Anomaly Engine (existing rules)
    ↓
Risk Aggregation (score + level + decision)
    ↓
Finance Manager Review & Approval
```

---

## 📊 Services Summary

| Service | File | Purpose |
|---------|------|---------|
| **Categorization** | `categorization.service.ts` | Keyword-based (9 categories) |
| **GST Verification** | `gst.service.ts` | Format + Vendor master |
| **Vendor Verification** | `vendor.service.ts` | Exists/Active/Approved |
| **PO Verification** | `po.service.ts` | Amount/Qty within limits |
| **ERP Provider** | `erp.provider.ts` | Mock NetSuite + interface |
| **Orchestrator** | `invoice-orchestrator.service.ts` | Workflow coordinator |
| **Email** | `email.provider.ts` | Mock + SMTP providers |
| **API Client** | `api.client.ts` | Centralized HTTP |

---

## 🎯 Categories (with GL Codes)

```
IT Equipment                     → 6050
Software / SaaS                  → 6060
Office Supplies                  → 6010
Travel                           → 6020
Professional Services            → 6070
Utilities                        → 6030
Maintenance                      → 6040
Marketing                        → 6080
Other                           → 6090
```

---

## ✅ Verification Statuses

### GST
- VALID_FORMAT
- INVALID_FORMAT
- VENDOR_MATCH
- VENDOR_MISMATCH
- NEW_VENDOR
- VERIFICATION_UNAVAILABLE

### Vendor
- Exists: true/false
- Active: true/false
- Approved: true/false

### PO
- Found: true/false
- Vendor Match: true/false
- Amount Within Balance: true/false
- Quantity Within Order: true/false

---

## 📡 API Endpoints

### Processing
```
POST /api/invoices/:documentId/process
→ ProcessingResult (complete workflow output)
```

### Finance
```
GET /api/finance/review (pending invoices)
GET /api/finance/invoices/:documentId (detail)
POST /api/invoices/:documentId/approve
POST /api/invoices/:documentId/reject
```

### Procurement
```
GET /api/procurement/dashboard
GET /api/procurement/invoices
```

---

## 🧪 Frontend API Client Usage

```typescript
import { apiClient } from "@/lib/api.client";

// Process invoice
const result = await apiClient.processInvoice(documentId, token);

// Get review queue
const queue = await apiClient.getFinanceReviewQueue(token);

// Get invoice detail
const detail = await apiClient.getInvoiceDetail(documentId, token);

// Approve/Reject
await apiClient.approveInvoice(documentId, token);
await apiClient.rejectInvoice(documentId, "reason", token);
```

---

## 🔐 Roles & Permissions

| Role | Can Upload | Can Approve | Full Access |
|------|-----------|------------|------------|
| Procurement Officer | ✅ | ❌ | ❌ |
| Finance Manager | ❌ | ✅ | ❌ |
| Admin | ✅ | ✅ | ✅ |

---

## 🎨 Frontend Pages to Build

### Finance Manager Dashboard
- KPI Cards (Total, Pending, High Risk, Approved, Rejected)
- Review Queue Table
- Risk Filters

### Finance Invoice Detail
1. Summary (top card)
2. Extraction (fields)
3. Categorization (+ GL)
4. GST Verification (format, vendor match)
5. ERP Context (vendor, PO, GL)
6. Risk Summary (score, level)
7. Risk Evidence (rules triggered)
8. Decision Buttons (Approve/Reject)

### Procurement Dashboard
- Upload Invoice
- KPIs (Submitted, Processing, Finance Review, Approved, Rejected)
- Recent Invoices Table
- Status Tracking

---

## 🧠 Key Concepts

### Deterministic
- Same input → Same output (always)
- Rule-based, not ML
- Auditable & explainable

### Mock
- Not real NetSuite/GST API
- Clearly labeled
- Easy to swap for real provider

### Evidence
- Every verification produces structured evidence
- Finance Manager can see WHY decision was made
- Not just scores, but explanations

### Roles
- Procurement submits
- Finance reviews & decides
- Admin manages everything

---

## 🚨 Important Notes

1. **GST Verification**
   - Only format + vendor master
   - NO government API connection
   - Message: "Official verification unavailable"

2. **ERP Provider**
   - Currently MockNetSuiteProvider
   - Labeled "NETSUITE_MOCK" in responses
   - Can swap with real provider later

3. **Email Notifications**
   - MockEmailProvider (records outbox)
   - SMTP not yet implemented
   - Good for development/testing

4. **New Vendors**
   - Not treated as errors
   - Status: NEW_VENDOR
   - Flagged as warning, not block

---

## 🔍 Demo Data

### Vendors
- ABC Technologies ✓ Active ✓ Approved
- Tech Solutions ✓ Active ✓ Approved
- Office Pro ✓ Active ✓ Approved
- Travel Express ✓ Active ✓ Approved
- Professional Services Inc ✓ Active ✓ Approved

### POs
- PO-1001: ABC Tech, ₹100K (₹48K invoiced)
- PO-1002: Office Pro, ₹50K (₹0 invoiced)
- PO-1003: Tech Solutions, ₹75K (₹72K invoiced - almost full)

---

## 📋 Test Scenarios

### Clean Invoice (LOW RISK)
```
Input: ABC Tech, ₹45K, IT Equipment
✓ Vendor verified
✓ GST valid
✓ PO found & within balance
✓ No anomalies
Result: ELIGIBLE_FOR_AUTO_PROCESSING
```

### High Risk Invoice (REQUIRES REVIEW)
```
Input: ABC Tech, ₹95K (PO limit ₹100K)
✓ Vendor verified
✓ GST valid
⚠ PO balance nearly exceeded
⚠ Split invoice pattern detected
Result: REVIEW_REQUIRED
```

### Blocked Invoice
```
Input: Unknown Vendor, Invalid GSTIN
✗ Vendor not found
✗ GSTIN format invalid
✗ Cannot proceed
Result: BLOCKED
```

---

## 🚀 Deployment

### Build
```bash
# Backend
npm run typecheck  # No errors?
npm run build      # Compiles?
npm run test       # Tests pass?

# Frontend
npm run build      # Build output?
```

### Environment
```
Backend:  GEMINI_API_KEY, CORS_ORIGIN, NODE_ENV
Frontend: VITE_API_URL (pointing to backend)
```

### Render
- Backend: `npm install && npm run build && npm start`
- Frontend: `npm run build` (or Vercel)

---

## 📞 Integration Checklist

- [ ] Categorization service used in orchestrator
- [ ] GST/Vendor/PO verification integrated
- [ ] ERP provider configured
- [ ] Processing orchestrator called from routes
- [ ] Email notifications sent on status change
- [ ] Frontend pages built (3 pages)
- [ ] API client used (no direct fetch)
- [ ] Tests written & passing
- [ ] Build verification complete
- [ ] Deployed to Render

---

## 📖 Documentation

- **IMPLEMENTATION_STATUS.md** - What's done/remaining
- **IMPLEMENTATION_GUIDE.md** - Detailed integration guide
- **PHASE_2_COMPLETION_REPORT.md** - Full completion report
- **QUICK_REFERENCE.md** - This file

---

**Last Updated:** August 22, 2026  
**Status:** Ready for Frontend Integration & Testing

