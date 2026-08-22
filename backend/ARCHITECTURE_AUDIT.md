# Architecture Audit - Current State

## Executive Summary

**Date**: August 21, 2026
**Status**: Ready for redesign
**Existing Tests**: 99 passing (60 anomaly + 20 invoice validation + 19 routes design)
**Build Status**: Compiles cleanly, 0 TypeScript errors

---

## Current Module Structure

### ✅ Existing Modules (Working)

#### 1. **anomaly/** (CORE - PRESERVE ENTIRELY)
- **Status**: Fully functional, 60 passing tests
- **Keep**: All existing logic, rules, tests
- **10 Rule Families**: Duplicate, PO, Amount, Quantity, Vendor, Unusual, Date, GSTIN, Round, Split
- **Features**: Correlation bonuses, quantity aggregation, hard-block precedence

#### 2. **invoices/** (PHASE 2 - PRESERVE & EXTEND)
- **Status**: Phase 2 implemented, 39 passing tests
- **Current**: Document intake only (upload, get, list, download, delete)
- **Issue**: Missing business logic connection (no anomaly linkage, no finance workflow)
- **Action**: Extend with submission tracking, risk evaluation connection

#### 3. **audit/** (EXISTS)
- **Status**: Basic structure present (routes, schema, service)
- **Current**: Only test endpoint exists
- **Action**: Activate for financial action logging

#### 4. **approvals/** (EXISTS BUT UNUSED)
- **Status**: Schema only
- **Action**: Will implement for Finance Manager approval workflow

#### 5. **users**, **vendors**, **purchaseOrders**, **erp** (EXIST)
- **Status**: Schemas only
- **Action**: Use as-is (no major changes needed)

---

## Current Schemas

### Invoice Issue: Two Separate Schemas

**invoiceSchema** (Original):
- `status`: ["RECEIVED", "IN_REVIEW", "APPROVED", "REJECTED", "PAID"] — Payment status
- `validationStatus`: ["PENDING", "PASSED", "FAILED"]
- `approvalStatus`: ["NOT_STARTED", "PENDING", "APPROVED", "REJECTED"]
- No risk fields, no document linkage

**invoiceDocumentSchema** (Phase 2):
- `documentStatus`: ["UPLOADED", "EXTRACTION_PENDING", "EXTRACTION_IN_PROGRESS", "EXTRACTION_COMPLETE", "EXTRACTION_FAILED"]
- No financial data, separate from invoice
- No approval workflow fields

**Problem**: Two disconnected schemas; need unified workflow

---

## Current Roles (Already Defined!)

```typescript
"ADMIN", "EMPLOYEE", "PROCUREMENT", "AP_EXECUTIVE", "FINANCE_MANAGER", "CFO"
```

✅ **Already exist** — just need enforcement at endpoints

---

## Current Tests: 99 Passing

- Anomaly Engine: 60 tests
- Invoice Validation: 20 tests
- Invoice Routes: 19 tests

**MUST PRESERVE ALL** during redesign

---

## What Must Be Added

1. **Procurement Officer Submission Workflow** — tracking submission status
2. **Risk Evaluation Linkage** — connect document upload to anomaly engine
3. **Finance Manager Review Interface** — view + approve/reject
4. **Context Builder** — gather financial context before anomaly evaluation
5. **Verification Layer** — GST, Vendor, PO validation structure
6. **Explanation Generation** — convert signals to deterministic explanations
7. **Approval Authorization** — enforce role-based decisions
8. **Audit Events** — log important financial actions

---

## Design Principle

**Preserve working code. Extend with business workflow.**

The anomaly engine is deterministic, tested, and correct. Do not refactor it.

Add new modules around it to support:
- Procurement submission
- Finance review
- Approval workflow
- Audit logging

---

## Next Steps

1. Map existing modules to workflow
2. Create unified invoice document model
3. Implement Procurement submission flow
4. Build context builder
5. Connect anomaly engine
6. Implement Finance approval
7. Add deterministic explanations
8. Add audit logging
9. Test all integrations
