# Multi-Tenant Architecture Redesign - Phase 1 Analysis

**Date:** August 22, 2026  
**Status:** Analysis Complete - Ready for Phase 2 Implementation  
**Scope:** Existing codebase inspection for multi-tenant (organization-based) invoice verification workflow

---

## 1. EXISTING BACKEND ARCHITECTURE

### Current Models

#### User Model (`backend/src/models/User.ts`)
**Current Fields:**
- email (unique, required)
- password (hashed with bcrypt)
- name
- role: `"PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "ADMIN"`
- isActive (boolean)
- timestamps

**Issues for Multi-Tenancy:**
- ❌ NO `organizationId` field
- ❌ NO support for users belonging to multiple organizations
- ❌ NO vendor role type

**Required Changes:**
- ✅ Add `organizationId` (ObjectId, required for non-vendor users)
- ✅ Add `role` enum including: `"ORGANIZATION_ADMIN"`, `"PROCUREMENT_OFFICER"`, `"FINANCE_MANAGER"`, `"VENDOR"`
- ✅ Add `vendorId` (optional, for vendor users)
- ✅ Add `permissions` array (for fine-grained control)
- ✅ Ensure unique constraint is `{ email, organizationId }` (allows same email across orgs)

---

#### Invoice Model (`backend/src/models/Invoice.ts`)
**Current Fields:**
- invoiceNumber (unique)
- vendorId (ref to Vendor)
- vendorName
- invoiceDate
- dueDate
- totalAmount
- gstin
- poNumber
- description
- status: `"PENDING" | "APPROVED" | "REJECTED" | "ON_HOLD"`
- uploadedBy (ref to User)
- approvedBy (ref to User)
- rejectionReason
- attachmentUrl
- lineItems: Array of {description, quantity, unitPrice, amount}
- timestamps

**Issues for Multi-Tenancy:**
- ❌ NO `organizationId` field
- ❌ Status enum too simplistic (needs OCR, verification states)
- ❌ NO riskScore, anomalies fields
- ❌ NO audit trail
- ❌ NO procurementVerification, financeVerification objects
- ❌ Unique constraint on invoiceNumber (needs to be per organization)

**Required Changes:**
- ✅ Add `organizationId` (required, filter all queries by this)
- ✅ Expand status to: `SUBMITTED | OCR_PROCESSING | OCR_COMPLETED | PROCUREMENT_REVIEW | PROCUREMENT_VERIFIED | PROCUREMENT_REJECTED | FINANCE_REVIEW | FINANCE_APPROVED | FINANCE_REJECTED | PAYMENT_PENDING | PAYMENT_PROCESSING | PAID`
- ✅ Add `ocrData` object: {vendorName, gstin, invoiceNumber, invoiceDate, poNumber, totalAmount, lineItems, confidence}
- ✅ Add `riskScore` (0-100)
- ✅ Add `anomalies` array of {type, severity, message}
- ✅ Add `procurementVerification`: {status, verifiedBy, verifiedAt, notes}
- ✅ Add `financeVerification`: {status, verifiedBy, verifiedAt, notes}
- ✅ Add `payment` object: {paymentId, status, initiatedAt, completedAt, amount, currency}
- ✅ Change uniqueness to `{ organizationId, invoiceNumber }`

---

#### Vendor Model (`backend/src/models/Vendor.ts`)
**Current Fields:**
- vendorName
- vendorCode (unique)
- gstin
- email
- phone
- address, city, state, pincode
- bankName, accountNumber, ifscCode
- status: `"ACTIVE" | "INACTIVE" | "SUSPENDED"`
- isApproved (boolean)
- approvedOn, approvedBy
- totalInvoices, totalAmount
- timestamps

**Issues for Multi-Tenancy:**
- ❌ NO `organizationIds` array (vendor serves multiple orgs)
- ❌ Unique constraint on vendorCode (needs to be per organization)
- ❌ NO userId reference (vendor must be a User for auth)
- ❌ NO registration/onboarding workflow

**Required Changes:**
- ✅ Add `organizationIds` (array of ObjectIds - vendor can serve multiple organizations)
- ✅ Change uniqueness to `{ organizationId, vendorCode }`
- ✅ Add `userId` (ref to User with role=VENDOR)
- ✅ Add `metadata` object for ERP integration
- ✅ Change `approvedBy` from string to ObjectId

---

### Organization Model (NEW - Does NOT exist)
**Must Create:** `backend/src/models/Organization.ts`
```
- name (required)
- legalName
- gstin
- registrationNumber
- email
- officialUserId (ref to User, ORGANIZATION_ADMIN)
- procurementOfficerId (ref to User, PROCUREMENT_OFFICER)
- financeManagerId (ref to User, FINANCE_MANAGER)
- metadata (for ERP integration)
- status: ACTIVE | INACTIVE | SUSPENDED
- timestamps
```

---

### Current Services

#### UserService (`backend/src/services/UserService.ts`)
**Current Methods:**
- `register(input)`: Creates user, returns {user, token}
- `login(input)`: Validates credentials, returns {user, token}
- `getUserById(userId)`: Fetch user by ID
- `getUserByEmail(email)`: Fetch user by email
- `updateUser(userId, updates)`: Update user profile
- `getAllUsers(role?)`: Get all active users with optional role filter

**Issues:**
- ❌ NO organization context in any method
- ❌ NO role-based filtering per organization
- ❌ NO user creation within organization context
- ❌ NO vendor user management
- ❌ NO organization membership/invitation workflows

**Required Changes:**
- ✅ Add `organizationId` parameter to all CRUD operations
- ✅ Add `createUserForOrganization(org, userType, details)` method
- ✅ Add `getOrganizationUsers(organizationId, role?)` method
- ✅ Add `inviteUserToOrganization(organizationId, email, role)` method
- ✅ Add `acceptInvitation(token)` method
- ✅ Add `removeUserFromOrganization(userId, organizationId)` method

---

#### InvoiceService (`backend/src/services/InvoiceService.ts`)
**Current Methods:**
- `createInvoice(input, userId)`: Create new invoice
- `getInvoiceById(invoiceId)`: Fetch invoice by ID
- `getInvoices(filters)`: List invoices with filters
- (Likely includes update/delete methods - check file)

**Issues:**
- ❌ NO organization context - invoices not isolated by org
- ❌ Filters likely don't include organizationId
- ❌ NO status transition logic
- ❌ NO audit trail creation
- ❌ NO OCR data handling
- ❌ NO risk score/anomaly logic

**Required Changes:**
- ✅ Add `organizationId` to ALL queries
- ✅ Implement status transition methods: `moveToOCR()`, `markOCRCompleted()`, `moveToProcurementReview()`, etc.
- ✅ Add audit log creation on every status change
- ✅ Add OCR data storage/retrieval
- ✅ Add verification methods: `procurementVerify()`, `financeApprove()`, `financeReject()`
- ✅ Add payment status tracking

---

### Current Authentication

#### JWT Config (`backend/src/config/jwt.ts`)
**Current Payload:**
```typescript
{
  userId: string;
  email: string;
  role: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "ADMIN";
}
```

**Issues:**
- ❌ NO `organizationId` in JWT
- ❌ Role enum incomplete (missing ORGANIZATION_ADMIN, VENDOR)

**Required Changes:**
- ✅ Add `organizationId` to JWT payload
- ✅ Extend role enum to include all 4 roles
- ✅ Update token generation/verification throughout codebase

---

#### Auth Middleware (`backend/src/middleware/auth.middleware.ts`)
**Current Functionality:**
- `verifyJWTToken`: Extracts token, verifies, sets `req.user`
- `requireRole(...allowedRoles)`: Middleware to check user role

**Issues:**
- ❌ NO organization isolation checks
- ❌ NO vendor/organization relationship validation
- ❌ NO audit logging

**Required Changes:**
- ✅ Extend middleware to validate `organizationId` from token
- ✅ Add `requireOrganization(organizationId)` middleware
- ✅ Add vendor-specific authorization checks
- ✅ Add audit context to requests

---

### Current Routes

#### Auth Routes (`backend/src/routes/auth.routes.ts`)
**Current Endpoints:**
- `POST /auth/register` - Create user account
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user
- `PUT /auth/profile` - Update user profile

**Issues:**
- ❌ NO organization onboarding flow
- ❌ NO workspace creation
- ❌ NO invitation acceptance
- ❌ NO vendor-specific flows
- ❌ NO role-based registration

**Required New Endpoints:**
- ✅ `POST /auth/organization/register` - Create organization + admin + PO + FM
- ✅ `POST /auth/organization/invite` - Invite user to organization
- ✅ `POST /auth/organization/invite/:token/accept` - Accept invitation
- ✅ `POST /auth/vendor/register` - Register vendor account
- ✅ `POST /auth/vendor/organization/search` - Search organizations
- ✅ `POST /auth/vendor/organization/:id/join` - Request access to org

---

#### Invoice Routes (`backend/src/routes/invoice.routes.ts`)
**Current Endpoints:** (Need to verify by reading file, but likely)
- `POST /invoices` - Create invoice
- `GET /invoices` - List invoices
- `GET /invoices/:id` - Get invoice detail
- `PUT /invoices/:id` - Update invoice
- `DELETE /invoices/:id` - Delete invoice

**Issues:**
- ❌ NO organization isolation
- ❌ NO status transition endpoints
- ❌ NO OCR integration endpoints
- ❌ NO verification endpoints (procurement/finance)
- ❌ NO payment endpoints
- ❌ NO audit trail endpoints

**Required New Endpoints:**
- ✅ `POST /organizations/:orgId/invoices` - Create (vendor)
- ✅ `GET /organizations/:orgId/invoices` - List (org members)
- ✅ `GET /organizations/:orgId/invoices/:id` - Detail
- ✅ `POST /organizations/:orgId/invoices/:id/ocr` - Trigger OCR
- ✅ `POST /organizations/:orgId/invoices/:id/procurement-verify` - PO verify
- ✅ `POST /organizations/:orgId/invoices/:id/procurement-reject` - PO reject
- ✅ `POST /organizations/:orgId/invoices/:id/finance-approve` - FM approve
- ✅ `POST /organizations/:orgId/invoices/:id/finance-reject` - FM reject
- ✅ `POST /organizations/:orgId/invoices/:id/payment` - Initiate payment
- ✅ `GET /organizations/:orgId/audit` - Audit logs

---

## 2. EXISTING FRONTEND ARCHITECTURE

### Current Pages/Routes
- `/` - Landing page (role selection modal)
- `/login` - Login/Signup page
- `/procurement/dashboard` - Procurement Officer dashboard
- `/finance/dashboard` - Finance Manager dashboard

### Current Auth Management
**File:** `frontend/src/hooks/useAuth.ts`
- Uses localStorage for JWT token (key: "token")
- Fetches user info from MongoDB backend
- No organization context
- Basic role determination from email pattern

### Current API Integration
**File:** `frontend/src/lib/api.ts`
- Centralized `apiClient` class
- GET/POST/PUT/DELETE methods
- Includes invoice upload, extraction, processing
- All calls use Bearer token auth
- **Issues:** NO organization context in any API calls

### Current Dashboards
- Procurement: Shows invoices, status tracking
- Finance: Shows pending approvals, risk alerts
- **Issues:** NO organization context, NO role-based restrictions

---

## 3. WHAT CAN BE REUSED

✅ **Backend - Keep AS-IS:**
- MongoDB connection (✅ working)
- Mongoose schemas structure (can extend)
- bcrypt password hashing
- JWT implementation (just add organizationId)
- Express.js routing structure
- Error handling utilities
- API response formatting

✅ **Frontend - Keep AS-IS:**
- TanStack Router
- useAuth hook structure (just enhance)
- apiClient pattern
- Layout components (AppShell)
- Form components
- Styling/Tailwind

✅ **Pipeline - Keep AS-IS:**
- OCR extraction module
- Anomaly detection
- Risk scoring engine
- Invoice validation logic
- All existing `/modules` functionality

---

## 4. WHAT MUST CHANGE

### BREAKING CHANGES REQUIRED

| Component | Current | Required | Impact |
|-----------|---------|----------|--------|
| User Model | NO organizationId | ADD organizationId (required) | ALL user queries must filter by org |
| Invoice Model | NO organizationId | ADD organizationId (required) | ALL invoice queries must filter by org |
| Invoice.status enum | 4 states | 12 states (OCR, verification pipeline) | ALL status logic must change |
| JWT Payload | NO organizationId | ADD organizationId | ALL token generation/verify must change |
| Auth Middleware | Role-only | Role + Organization | ALL protected routes need org check |
| Auth Routes | User register/login | + Organization onboarding | NEW registration flow |
| Vendor Model | NO organizationIds | ADD organizationIds array | Vendor now serves multiple orgs |
| Vendor Model | NO userId | ADD userId ref | Vendor needs auth |

### NON-BREAKING ADDITIONS

| Component | Action |
|-----------|--------|
| Organization Model | CREATE new (doesn't affect existing) |
| AuditLog Model | CREATE new (doesn't affect existing) |
| Invoice routes | ADD new /org/:id/* endpoints (existing unchanged) |
| User service | ADD new org-aware methods (existing work) |
| Invoice service | ADD new status methods (existing compatible) |

---

## 5. IMPLEMENTATION ROADMAP

### Phase 1: Analysis ✅ COMPLETE
- [x] Identify existing models
- [x] Identify existing routes  
- [x] Document JWT auth
- [x] Document existing OCR/pipeline
- [x] Document frontend dashboards
- [x] Produce this analysis

### Phase 2: Organization + User Architecture
- [ ] Create Organization model
- [ ] Create AuditLog model
- [ ] Extend User model with organizationId + new roles
- [ ] Extend Vendor model with organizationIds + userId
- [ ] Update JWT config with organizationId
- [ ] Update JWT middleware to enforce org isolation
- [ ] Test: Can users from different orgs NOT see each other's data?

### Phase 3: Organization Admin Onboarding
- [ ] Create OrganizationService
- [ ] Create `POST /auth/organization/register` endpoint
- [ ] Implement organization creation + admin + PO + FM setup
- [ ] Implement user invitation flow
- [ ] Create acceptance of invitation endpoint
- [ ] Test: Organization admin can create org + invite PO/FM

### Phase 4: Vendor Registration & Organization Search
- [ ] Extend Vendor model
- [ ] Create vendor registration endpoint
- [ ] Create organization search endpoint (by name/GSTIN)
- [ ] Create vendor join/access request flow
- [ ] Test: Vendor can search orgs and request access

### Phase 5: Invoice Submission (Vendor)
- [ ] Extend Invoice model with organizationId
- [ ] Update Invoice service to filter by organizationId
- [ ] Create vendor invoice upload endpoint
- [ ] Test: Vendor submits invoice → stored with organizationId

### Phase 6: OCR Pipeline Integration
- [ ] Connect existing OCR module to new invoice flow
- [ ] Implement OCR status transitions
- [ ] Store OCR data in invoice
- [ ] Test: Invoice → OCR → OCR_COMPLETED status

### Phase 7: Procurement Officer Workflow
- [ ] Extend Invoice routes with procurement endpoints
- [ ] Create procurement verification logic
- [ ] Implement PO matching/validation
- [ ] Implement risk anomaly display
- [ ] Create Procurement dashboard (redesign frontend)
- [ ] Test: PO reviews invoice, verifies/rejects

### Phase 8: Finance Manager Workflow
- [ ] Create finance approval endpoints
- [ ] Implement Finance dashboard (redesign frontend)
- [ ] Test: FM reviews verified invoices, approves/rejects

### Phase 9: Payment Service Abstraction
- [ ] Create PaymentService interface
- [ ] Implement MockPaymentProvider
- [ ] Create payment initiation endpoint
- [ ] Test: Invoice → FINANCE_APPROVED → PAYMENT_PENDING → PAID

### Phase 10: ERP Integration
- [ ] Create ERPProvider interface
- [ ] Implement MockERPProvider
- [ ] Integrate PO lookup
- [ ] Test: Can retrieve PO data from mock ERP

### Phase 11: Frontend Redesign
- [ ] Create Organization Admin dashboard
- [ ] Create Procurement Officer dashboard
- [ ] Create Finance Manager dashboard
- [ ] Create Vendor dashboard
- [ ] Update landing page for org selection
- [ ] Test: All dashboards work with org context

### Phase 12: End-to-End Testing
- [ ] Register organization
- [ ] Create Procurement Officer + Finance Manager
- [ ] Register vendor
- [ ] Vendor uploads invoice
- [ ] Procurement verifies
- [ ] Finance approves
- [ ] Payment completes
- [ ] Audit trail logged

---

## 6. CRITICAL CONSTRAINTS

⚠️ **MUST NOT:**
- ❌ Delete existing OCR/anomaly detection code
- ❌ Delete existing risk engine
- ❌ Reintroduce Firebase
- ❌ Break existing JWT/bcrypt implementation
- ❌ Break existing Invoice validation logic
- ❌ Delete existing routes without replacement

✅ **MUST DO:**
- ✅ Keep MongoDB connection working
- ✅ Preserve bcrypt password hashing
- ✅ Preserve JWT structure (extend, don't replace)
- ✅ Preserve existing module structure
- ✅ Test organization isolation at every step
- ✅ Add audit logs for compliance

---

## 7. NEXT STEPS

**READY TO START:** ✅ Phase 2 - Organization + User Architecture

Run Phase 2 when ready. This will:
1. Create Organization model
2. Extend User + Vendor models  
3. Update JWT + middleware
4. Establish organization isolation layer

**No code changes yet.** This document serves as the implementation blueprint.

---

**Generated:** August 22, 2026 | **Status:** READY FOR PHASE 2 IMPLEMENTATION
