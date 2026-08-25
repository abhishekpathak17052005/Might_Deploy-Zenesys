# Phase 3 Frontend Implementation Guide

## Overview
Phase 3 frontend focuses on building the vendor dashboard and invoice submission workflow. This guide outlines the UI components, pages, and flows needed.

## Architecture

### Key Components

#### 1. Vendor Navigation/Sidebar
Location: `src/components/VendorNavigation.tsx`

**Navigation Items:**
- Dashboard
- Organizations
- Create Invoice
- My Invoices
- Profile
- Logout

**Features:**
- Responsive mobile menu
- Active route highlighting
- User profile preview

#### 2. Organization Search Page
Location: `src/pages/vendor/OrganizationSearch.tsx`

**Features:**
- Search bar (search by name, legalName, GSTIN)
- Search results table showing:
  - Organization name
  - Legal name
  - GSTIN
  - Contact email
  - "Select" button
- Pagination (if many results)
- Loading states
- Empty state when no results

**API Integration:**
```typescript
POST /api/vendor/organizations/search?q=search_term
```

#### 3. Organization Selection Confirmation
Location: `src/components/OrganizationSelectModal.tsx`

**Features:**
- Confirm selection modal/drawer
- Show organization details
- Confirmation button
- Cancel option
- Success toast notification
- Error handling

**API Integration:**
```typescript
POST /api/vendor/organizations/select
Body: { organizationId }
```

#### 4. Create Invoice Page
Location: `src/pages/vendor/CreateInvoice.tsx`

**Workflow:**
1. **Select Organization**
   - Dropdown/combobox of user's accessible organizations
   - Must have at least one organization selected

2. **File Upload**
   - Drag-and-drop zone
   - File picker button
   - Accepted formats: PDF, JPEG, PNG, TIFF, WebP
   - Max size: 10MB
   - Show file preview/thumbnail

3. **Extraction Preview**
   - After successful upload, show extracted data:
     - Invoice Number
     - Vendor Name
     - GST IN
     - Invoice Date
     - PO Number
     - Total Amount
     - Line Items (table)
   - Show confidence scores
   - Edit capability for corrections

4. **Submit**
   - Submit button to finalize
   - Success notification
   - Redirect to invoice details or list

**API Integration:**
```typescript
POST /api/vendor/invoices
Content-Type: multipart/form-data
Body: {
  organizationId,
  invoice: File
}
```

#### 5. Invoice List Page
Location: `src/pages/vendor/MyInvoices.tsx`

**Table Columns:**
- Invoice Number
- Organization Name
- Vendor Name
- Amount
- Risk Level (with color coding)
- Status
- Submitted Date
- Actions (View, Download)

**Features:**
- Sortable columns
- Filterable by:
  - Organization
  - Status (SUBMITTED, OCR_PROCESSING, OCR_COMPLETED, etc.)
  - Risk Level
  - Date Range
- Pagination
- Bulk actions (export)

**Status Badge Colors:**
- SUBMITTED: Gray
- OCR_PROCESSING: Blue
- OCR_COMPLETED: Light Blue
- PROCUREMENT_REVIEW: Orange
- APPROVED: Green
- REJECTED: Red
- ON_HOLD: Yellow

**Risk Level Badge Colors:**
- LOW: Green
- MEDIUM: Orange
- HIGH: Red
- CRITICAL: Dark Red

**API Integration:**
```typescript
GET /api/vendor/invoices?organizationId=org_id&status=STATUS&limit=20&offset=0
```

#### 6. Invoice Details Page
Location: `src/pages/vendor/InvoiceDetails.tsx`

**Sections:**

**A. Basic Information**
- Invoice Number
- Vendor Name
- GST IN
- Invoice Date
- Due Date
- PO Number

**B. Extraction Results**
- Extracted by: OCR Provider
- Extraction Date
- Confidence Score (%)
- Extracted Line Items (table)

**C. Categorization**
- Category
- Confidence Score (%)

**D. Risk Analysis**
- Risk Score (0-100)
- Risk Level
- Anomalies Detected (table with type, severity, message)

**E. Approval Status**
- Current Status
- If Approved: Approver name, approval date
- If Rejected: Rejection reason

**F. Actions**
- Download Invoice
- View Full Document
- Edit (if status allows)

**API Integration:**
```typescript
GET /api/vendor/invoices/:id
```

#### 7. Vendor Profile Page
Location: `src/pages/vendor/Profile.tsx`

**Displays:**
- Vendor Name
- Email
- GST IN
- Phone (if available)
- Address Information
- Bank Details (masked for security)

**Sections:**
- Organizations: List of accessible organizations with ability to remove
- Statistics:
  - Total Invoices
  - Total Amount Submitted
  - Average Risk Score
  - Approval Rate

**API Integration:**
```typescript
GET /api/vendor/profile
```

## Component Structure

```
src/
├── components/
│   ├── VendorNavigation.tsx
│   ├── OrganizationSelectModal.tsx
│   ├── InvoiceTable.tsx
│   ├── InvoiceStatusBadge.tsx
│   ├── RiskLevelBadge.tsx
│   ├── FileUploadZone.tsx
│   └── ExtractionPreview.tsx
├── pages/
│   ├── vendor/
│   │   ├── Dashboard.tsx
│   │   ├── OrganizationSearch.tsx
│   │   ├── CreateInvoice.tsx
│   │   ├── MyInvoices.tsx
│   │   ├── InvoiceDetails.tsx
│   │   ├── Profile.tsx
│   │   └── index.tsx (routing)
├── hooks/
│   ├── useVendor.ts
│   ├── useInvoices.ts
│   ├── useOrganizations.ts
│   └── useAuth.ts
├── services/
│   ├── vendorService.ts
│   ├── invoiceService.ts
│   └── organizationService.ts
└── types/
    ├── vendor.ts
    ├── invoice.ts
    └── organization.ts
```

## Key Hooks

### useVendor
```typescript
const { vendor, loading, error, refetch } = useVendor();
```

### useInvoices
```typescript
const { 
  invoices, 
  total, 
  loading, 
  error, 
  filters, 
  setFilters,
  refetch 
} = useInvoices({ organizationId, status });
```

### useOrganizations
```typescript
const {
  organizations,
  loading,
  error,
  search,
  selectOrganization,
  removeOrganization
} = useOrganizations();
```

## State Management

### Vendor State (Redux/Context)
```typescript
{
  vendor: {
    id: string;
    name: string;
    email: string;
    gstin: string;
    organizationIds: string[];
    isApproved: boolean;
  };
  selectedOrganization: string | null;
  loading: boolean;
  error: string | null;
}
```

### Invoices State
```typescript
{
  invoices: Invoice[];
  total: number;
  filters: {
    organizationId?: string;
    status?: string;
    limit: number;
    offset: number;
  };
  loading: boolean;
  error: string | null;
}
```

## API Service Methods

### vendorService.ts
```typescript
export const vendorService = {
  register: (data: RegisterInput): Promise<AuthResponse>,
  getProfile: (): Promise<Vendor>,
  searchOrganizations: (query: string): Promise<Organization[]>,
  selectOrganization: (organizationId: string): Promise<Vendor>,
  getInvoices: (filters?: InvoiceFilters): Promise<InvoiceListResponse>,
  getInvoiceById: (id: string): Promise<Invoice>,
  submitInvoice: (organizationId: string, file: File): Promise<Invoice>,
};
```

## Authentication Flow for Vendor

1. **Registration**
   - User enters email, password, name, GSTIN
   - API returns token + vendor profile
   - Store token in localStorage/secure cookie
   - Redirect to dashboard or organization search

2. **Login** (use existing auth service)
   - API validates VENDOR role
   - Token includes vendorId
   - Redirect to dashboard

3. **Token Renewal**
   - Auto-refresh on 401 responses
   - Clear storage on failed refresh

## Error Handling

### Common Errors
```typescript
{
  "statusCode": 400,
  "error": "VALIDATION_ERROR",
  "message": "Missing required field",
  "details": {}
}

{
  "statusCode": 403,
  "error": "FORBIDDEN",
  "message": "Vendor does not have access to this organization"
}

{
  "statusCode": 404,
  "error": "NOT_FOUND",
  "message": "Invoice not found"
}

{
  "statusCode": 409,
  "error": "CONFLICT",
  "message": "Vendor already associated with this organization"
}
```

## Loading & Skeleton States

- Invoice table rows: Skeleton cards
- Search results: Skeleton list
- Invoice details: Skeleton sections
- File upload: Progress bar

## Accessibility

- ARIA labels on form inputs
- Keyboard navigation support
- Color not only indicator for status (use icons too)
- Proper heading hierarchy
- Form validation messages

## Responsive Design

- Mobile: Single column, stacked layout
- Tablet: Two-column layout where applicable
- Desktop: Full multi-column layout
- Touch-friendly button sizes (48px minimum)

## Testing Strategy

### Unit Tests
- Component rendering
- Props validation
- User interactions

### Integration Tests
- Form submission flow
- API integration
- Navigation flow

### E2E Tests
- Complete vendor workflow:
  - Register
  - Search organization
  - Select organization
  - Create invoice
  - View invoice

## Implementation Priority

1. **Phase 1 (MVP)**
   - Vendor Navigation
   - Organization Search
   - Organization Select
   - Create Invoice
   - Invoice List

2. **Phase 2 (Enhancement)**
   - Invoice Details
   - Vendor Profile
   - Export/Download

3. **Phase 3 (Polish)**
   - Advanced filtering
   - Search history
   - Bulk operations

## API Response Examples

### Get Vendor Invoices
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "invoice_id",
        "organizationId": "org_id",
        "invoiceNumber": "INV-001",
        "vendorName": "Tech Vendor Co",
        "totalAmount": 50000,
        "riskLevel": "LOW",
        "riskScore": 25,
        "status": "OCR_COMPLETED",
        "category": "SERVICES",
        "categoryConfidence": 0.95,
        "createdAt": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 1
  }
}
```

### Get Invoice Details
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "organizationId": "org_id",
      "invoiceNumber": "INV-001",
      "vendorId": "vendor_id",
      "vendorName": "Tech Vendor Co",
      "gstin": "27AABCT1234H1Z0",
      "invoiceDate": "2024-01-10",
      "totalAmount": 50000,
      "status": "OCR_COMPLETED",
      "ocrResult": {
        "vendorName": "Tech Vendor Co",
        "invoiceNumber": "INV-001",
        "totalAmount": 50000,
        "confidence": {
          "vendorName": 0.98,
          "invoiceNumber": 0.95,
          "totalAmount": 0.99
        }
      },
      "category": "SERVICES",
      "categoryConfidence": 0.95,
      "riskScore": 25,
      "riskLevel": "LOW",
      "anomalies": [],
      "lineItems": [
        {
          "description": "Software Development Services",
          "quantity": 1,
          "unitPrice": 50000,
          "amount": 50000
        }
      ]
    }
  }
}
```

## Notes for Development Team

1. **Error Boundaries**: Implement error boundaries around vendor pages
2. **Loading States**: Always show loading indicator during API calls
3. **Optimistic Updates**: Update UI before API response where appropriate
4. **Caching**: Cache organization list locally for quick access
5. **Real-time**: Consider WebSocket for invoice status updates
6. **Analytics**: Track vendor actions for reporting

## Deployment Considerations

- Environment variables for API base URL
- Feature flags for Phase 3 features
- Roll-out strategy (beta access)
- Performance monitoring
- Error tracking (Sentry)

---

This guide provides the foundation for Phase 3 frontend development. Refer to existing component patterns in the codebase and maintain consistency with design system.
