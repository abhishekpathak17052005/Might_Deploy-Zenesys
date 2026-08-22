# STEP 2: Workflow Mapping - Existing Modules to Business Process

## Business Workflow (Target)

```
VENDOR → Bill
  ↓
PROCUREMENT OFFICER → Upload
  ↓
DOCUMENT INTAKE (invoices module)
  ↓
EXTRACTION (Phase 3 - placeholder)
  ↓
VERIFICATION + CONTEXT (new module)
  ↓
ANOMALY ENGINE (preserve entirely)
  ↓
EXPLANATIONS (new module)
  ↓
FINANCE MANAGER REVIEW (new endpoints)
  ↓
APPROVE / REJECT
  ↓
PAYMENT
```

---

## Module Mapping

### 1. PROCUREMENT OFFICER SUBMISSION
**Module**: `invoices/` (Phase 2 - Preserve)
**Current**: ✅ Document upload working (99 tests passing)
**Add**: Submission status tracking, role enforcement
**Endpoints**:
- POST /api/invoices/upload (add PROCUREMENT role)
- GET /api/invoices (add PROCUREMENT role)
- GET /api/invoices/:id/status (new)

---

### 2. EXTRACTION (Phase 3 - Placeholder Only)
**Module**: `extraction/` (create empty module as hookpoint)
**Do Not Implement**: OCR, AI, Gemini
**Just Create**: Interface definition for future

---

### 3. VERIFICATION & CONTEXT
**Module**: `context/` (new)
**Purpose**: Gather financial context before anomaly evaluation
**Functions**:
- verifyGST() — format check + vendor GSTIN match
- verifyVendor() — vendor exists, active
- verifyPO() — PO exists, belongs to vendor
- buildRiskContext() — compile all context
**Inputs**: structuredInvoiceData, vendorId, poId
**Outputs**: RiskContext object

---

### 4. ANOMALY ENGINE
**Module**: `anomaly/` (Preserve Entirely - DO NOT MODIFY)
**Current**: ✅ 60 tests passing, 10 rules working
**Keep As-Is**: All logic, tests, configuration
**Integration**: Receives RiskContext from verification layer
**Output**: AnomalyResult { risk, signals, decision }

---

### 5. EXPLANATION GENERATION
**Module**: `explanation/` (new)
**Purpose**: Convert anomaly signals to human text (no LLM)
**Functions**:
- explainSignal(signal) → { type, explanation, severity }
- buildExplanation(anomalyResult) → { signals[], summary, recommendation }
**Example**: 
```
Signal: AMOUNT_MISMATCH
Explanation: "Invoice ₹6,20,000 is 24% higher than PO ₹5,00,000"
```

---

### 6. FINANCE MANAGER REVIEW & APPROVAL
**Module**: `approval/` (extend schema-only)
**Purpose**: Finance Manager workflow endpoints
**Endpoints**:
- GET /api/finance/review (list awaiting review)
- GET /api/finance/invoices/:id (full review packet)
- POST /api/invoices/:id/approve (approve payment)
- POST /api/invoices/:id/reject (reject payment)
**Role Enforcement**: FINANCE_MANAGER only

---

### 7. AUDIT LOGGING
**Module**: `audit/` (activate existing service)
**Current**: ✅ Service exists, only test endpoint
**Activate**: Log all financial actions
**Events**: upload, verify, evaluate_risk, approve, reject

---

## Module Creation/Modification Plan

| Module | Status | Action |
|--------|--------|--------|
| **invoices** | ✅ Working | Extend with submission tracking + role enforcement |
| **anomaly** | ✅ Working | Preserve entirely (NO CHANGES) |
| **context** | ❌ New | Create verification + context builder |
| **explanation** | ❌ New | Create signal explanation generator |
| **approval** | Schema only | Extend with approval workflow |
| **audit** | ✅ Service | Activate for logging |
| **extraction** | ❌ New | Create placeholder for Phase 3 |

---

## Data Flow

```
1. PROCUREMENT uploads document
   invoices.upload() → invoiceDocument { SUBMITTED }

2. EXTRACTION phase (Phase 3)
   [placeholder] → structuredInvoiceData

3. VERIFICATION & CONTEXT
   context.buildRiskContext(structuredInvoiceData)
   → RiskContext { invoice, vendor, po, history, verification_results }

4. ANOMALY EVALUATION
   anomaly.evaluate(riskContext)
   → AnomalyResult { risk_score, signals[], decision }

5. EXPLANATION GENERATION
   explanation.generate(anomalyResult)
   → Explanation { signals_with_text, summary, recommendation }

6. FINANCE REVIEW
   invoiceDocument.status = READY_FOR_REVIEW
   Finance Manager views: invoice + verification + risk + explanations

7. APPROVAL DECISION
   approval.approve() or approval.reject()
   → create approval record + audit log

8. AUDIT
   audit.log({ action, userId, invoiceId, timestamp })
```

---

## Role Enforcement Changes

| Endpoint | Current | New | Role |
|----------|---------|-----|------|
| POST /api/invoices/upload | No enforcement | ✅ Add | PROCUREMENT |
| GET /api/invoices | No enforcement | ✅ Add | PROCUREMENT |
| GET /api/finance/review | N/A | ✅ New | FINANCE_MANAGER |
| POST /api/invoices/:id/approve | N/A | ✅ New | FINANCE_MANAGER |
| POST /api/invoices/:id/reject | N/A | ✅ New | FINANCE_MANAGER |

---

## Invoice Lifecycle (Unified)

Current state: Two separate schemas (invoices + invoiceDocuments)

**Proposed Unified Lifecycle**:

```
UPLOADED
  ↓
EXTRACTION_PENDING → EXTRACTION_COMPLETE (Phase 3)
  ↓
VERIFICATION_PENDING → VERIFICATION_COMPLETE
  ↓
RISK_EVALUATED
  ↓
FINANCE_REVIEW_PENDING
  ↓
APPROVED / REJECTED
  ↓
PAID / ARCHIVED
```

**Storage**: invoiceDocument collection in Firestore
- Consolidate invoice + document metadata
- Add verification results
- Add risk results
- Add approval decision

---

## Existing Tests - Preservation

✅ **99 existing tests MUST pass**:
- 60 anomaly tests (DO NOT TOUCH)
- 20 invoice validation tests
- 19 invoice routes tests

**New tests to add**:
- Context building tests
- Verification tests
- Explanation generation tests
- Finance approval tests
- Role enforcement tests

---

## Next Steps (STEP 3)

Modify domain model:
1. Unify invoices + invoiceDocuments schemas
2. Update invoice lifecycle statuses
3. Add verification result fields
4. Add risk result fields
5. Add approval decision fields
