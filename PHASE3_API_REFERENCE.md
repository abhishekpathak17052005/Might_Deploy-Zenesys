# Phase 3 API Reference Quick Guide

## Base URL
```
http://localhost:3000/api
```

## Authentication
All endpoints except `/vendor/register` require:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 1. Vendor Registration

**Endpoint:** `POST /vendor/register`

**Authentication:** Not required

**Request:**
```json
{
  "email": "vendor@example.com",
  "password": "secure_password123",
  "confirmPassword": "secure_password123",
  "name": "Tech Vendor Co",
  "gstin": "27AABCT1234H1Z0"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "user_id",
      "email": "vendor@example.com",
      "name": "Tech Vendor Co",
      "role": "VENDOR",
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "vendor": {
      "_id": "vendor_id",
      "userId": "user_id",
      "name": "Tech Vendor Co",
      "email": "vendor@example.com",
      "gstin": "27AABCT1234H1Z0",
      "organizationIds": [],
      "status": "ACTIVE",
      "isApproved": false,
      "totalInvoices": 0,
      "totalAmount": 0,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Missing required fields
- `400 REGISTRATION_ERROR` - Email already exists or password mismatch

---

## 2. Search Organizations

**Endpoint:** `POST /vendor/organizations/search?q=<search_query>`

**Authentication:** Required (VENDOR role)

**Query Parameters:**
- `q` (required) - Search term (name, legalName, or GSTIN)

**Request:**
```
POST /vendor/organizations/search?q=Acme
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "organizations": [
      {
        "id": "org_id_1",
        "name": "Acme Corporation",
        "legalName": "Acme Corp Ltd",
        "gstin": "27AABCT5678H1Z0",
        "email": "contact@acme.com"
      },
      {
        "id": "org_id_2",
        "name": "Acme Industries",
        "legalName": "Acme Industries Pvt Ltd",
        "gstin": "27AABCT9999H1Z0",
        "email": "info@acmeindustries.com"
      }
    ]
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - Search query missing
- `401 UNAUTHORIZED` - Invalid or expired token
- `403 FORBIDDEN` - Not VENDOR role

---

## 3. Select Organization

**Endpoint:** `POST /vendor/organizations/select`

**Authentication:** Required (VENDOR role)

**Request:**
```json
{
  "organizationId": "org_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "_id": "vendor_id",
      "userId": "user_id",
      "name": "Tech Vendor Co",
      "organizationIds": ["org_id"],
      "status": "ACTIVE",
      "isApproved": false,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:05:00Z"
    }
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - organizationId missing
- `404 NOT_FOUND` - Organization not found
- `409 CONFLICT` - Vendor already associated with org
- `401 UNAUTHORIZED` - Invalid token
- `403 FORBIDDEN` - Not VENDOR role

---

## 4. Submit Invoice

**Endpoint:** `POST /vendor/invoices`

**Authentication:** Required (VENDOR role)

**Content-Type:** `multipart/form-data`

**Request:**
```
POST /vendor/invoices
Authorization: Bearer <token>
Content-Type: multipart/form-data

Form Data:
  organizationId: "org_id"
  invoice: <file_binary>
```

**Supported File Types:**
- PDF (application/pdf)
- JPEG (image/jpeg)
- PNG (image/png)
- TIFF (image/tiff)
- WebP (image/webp)

**Max File Size:** 10MB

**Response (201):**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "invoice_id",
      "organizationId": "org_id",
      "vendorId": "vendor_id",
      "vendorName": "Tech Vendor Co",
      "uploadedBy": "user_id",
      "status": "OCR_PROCESSING",
      "attachmentUrl": "invoice_filename.pdf",
      "lineItems": [],
      "ocrResult": null,
      "category": null,
      "riskScore": null,
      "riskLevel": null,
      "anomalies": [],
      "createdAt": "2024-01-15T10:10:00Z",
      "updatedAt": "2024-01-15T10:10:00Z"
    }
  }
}
```

**Errors:**
- `400 VALIDATION_ERROR` - organizationId missing or file not provided
- `400 VALIDATION_ERROR` - Invalid file type
- `400 VALIDATION_ERROR` - File too large (>10MB)
- `403 FORBIDDEN` - Vendor not associated with organization
- `404 NOT_FOUND` - Vendor profile not found
- `401 UNAUTHORIZED` - Invalid token

---

## 5. List Vendor Invoices

**Endpoint:** `GET /vendor/invoices`

**Authentication:** Required (VENDOR role)

**Query Parameters (all optional):**
- `organizationId` - Filter by organization
- `status` - Filter by status (SUBMITTED, OCR_PROCESSING, OCR_COMPLETED, PROCUREMENT_REVIEW, APPROVED, REJECTED, ON_HOLD)
- `limit` - Records per page (default: 20, max: 100)
- `offset` - Pagination offset (default: 0)

**Request:**
```
GET /vendor/invoices?organizationId=org_id&status=OCR_COMPLETED&limit=20&offset=0
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "invoice_id_1",
        "organizationId": "org_id",
        "invoiceNumber": "INV-001",
        "vendorId": "vendor_id",
        "vendorName": "Tech Vendor Co",
        "totalAmount": 50000,
        "status": "OCR_COMPLETED",
        "category": "SERVICES",
        "categoryConfidence": 0.95,
        "riskScore": 25,
        "riskLevel": "LOW",
        "uploadedBy": "user_id",
        "attachmentUrl": "invoice.pdf",
        "createdAt": "2024-01-15T10:10:00Z",
        "updatedAt": "2024-01-15T10:15:00Z"
      }
    ],
    "total": 1
  }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid token
- `403 FORBIDDEN` - Not VENDOR role
- `404 NOT_FOUND` - Vendor not found

---

## 6. Get Invoice Details

**Endpoint:** `GET /vendor/invoices/:id`

**Authentication:** Required (VENDOR role)

**URL Parameters:**
- `id` (required) - Invoice ID

**Request:**
```
GET /vendor/invoices/invoice_id
Authorization: Bearer <token>
```

**Response (200):**
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
      "dueDate": "2024-02-10",
      "totalAmount": 50000,
      "poNumber": "PO-12345",
      "status": "OCR_COMPLETED",
      "uploadedBy": "user_id",
      "attachmentUrl": "invoice.pdf",
      "ocrResult": {
        "vendorName": "Tech Vendor Co",
        "gstin": "27AABCT1234H1Z0",
        "invoiceNumber": "INV-001",
        "invoiceDate": "2024-01-10",
        "poNumber": "PO-12345",
        "totalAmount": 50000,
        "lineItems": [
          {
            "description": "Software Development Services",
            "quantity": 1,
            "unitPrice": 50000,
            "amount": 50000
          }
        ],
        "confidence": {
          "vendorName": 0.98,
          "invoiceNumber": 0.95,
          "totalAmount": 0.99
        },
        "extractedAt": "2024-01-15T10:12:00Z"
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
      ],
      "createdAt": "2024-01-15T10:10:00Z",
      "updatedAt": "2024-01-15T10:15:00Z"
    }
  }
}
```

**Errors:**
- `404 NOT_FOUND` - Invoice not found
- `403 FORBIDDEN` - Access denied (not vendor's invoice)
- `401 UNAUTHORIZED` - Invalid token

---

## 7. Get Vendor Profile

**Endpoint:** `GET /vendor/profile`

**Authentication:** Required (VENDOR role)

**Request:**
```
GET /vendor/profile
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "_id": "vendor_id",
      "userId": "user_id",
      "name": "Tech Vendor Co",
      "email": "vendor@example.com",
      "gstin": "27AABCT1234H1Z0",
      "organizationIds": ["org_id_1", "org_id_2"],
      "phone": "9876543210",
      "address": "123 Tech Street",
      "city": "Bangalore",
      "state": "Karnataka",
      "pincode": "560001",
      "bankName": "Tech Bank",
      "accountNumber": "****5678",
      "ifscCode": "TECH0001234",
      "status": "ACTIVE",
      "isApproved": false,
      "totalInvoices": 5,
      "totalAmount": 250000,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:20:00Z"
    }
  }
}
```

**Errors:**
- `401 UNAUTHORIZED` - Invalid token
- `403 FORBIDDEN` - Not VENDOR role
- `404 NOT_FOUND` - Vendor not found

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": "ERROR_CODE",
  "message": "Human readable error message",
  "statusCode": 400
}
```

**Common HTTP Status Codes:**
- `200 OK` - Success
- `201 CREATED` - Resource created
- `400 BAD REQUEST` - Validation error
- `401 UNAUTHORIZED` - Missing/invalid auth
- `403 FORBIDDEN` - Access denied
- `404 NOT FOUND` - Resource not found
- `409 CONFLICT` - Resource conflict (e.g., duplicate)
- `500 INTERNAL SERVER ERROR` - Server error

---

## Vendor Workflow Example

### Step 1: Register
```bash
curl -X POST http://localhost:3000/api/vendor/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "vendor@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "name": "Tech Vendor",
    "gstin": "27AABCT1234H1Z0"
  }'
```
Save the `token` from response.

### Step 2: Search Organizations
```bash
curl -X POST "http://localhost:3000/api/vendor/organizations/search?q=Acme" \
  -H "Authorization: Bearer <token>"
```

### Step 3: Select Organization
```bash
curl -X POST http://localhost:3000/api/vendor/organizations/select \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "org_id"}'
```

### Step 4: Submit Invoice
```bash
curl -X POST http://localhost:3000/api/vendor/invoices \
  -H "Authorization: Bearer <token>" \
  -F "organizationId=org_id" \
  -F "invoice=@/path/to/invoice.pdf"
```

### Step 5: List Invoices
```bash
curl -X GET "http://localhost:3000/api/vendor/invoices?organizationId=org_id&status=OCR_COMPLETED" \
  -H "Authorization: Bearer <token>"
```

### Step 6: Get Invoice Details
```bash
curl -X GET http://localhost:3000/api/vendor/invoices/invoice_id \
  -H "Authorization: Bearer <token>"
```

---

## Data Types Reference

### Invoice Status
```typescript
type InvoiceStatus = 
  | "SUBMITTED"           // Initial upload
  | "OCR_PROCESSING"      // OCR in progress
  | "OCR_COMPLETED"       // OCR finished
  | "PROCUREMENT_REVIEW"  // Waiting for procurement review
  | "APPROVED"            // Approved for payment
  | "REJECTED"            // Rejected
  | "ON_HOLD"             // On hold
```

### Risk Level
```typescript
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
```

### Vendor Status
```typescript
type VendorStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED"
```

---

## Rate Limiting

Not yet implemented. Will be added in Phase 4.

---

## Webhook Endpoints

Not yet implemented. Will be added in Phase 4.

---

## API Versioning

Current version: `v1` (implicit in `/api`)

Future versions will use `/api/v2`, `/api/v3`, etc.

---

## CORS Settings

Allowed origins configured in `CORS_ORIGIN` environment variable.

---

## Pagination

For list endpoints:
- `limit`: Records per page (default: 20, max: 100)
- `offset`: Skip N records (for offset-based pagination)

Example:
```
GET /vendor/invoices?limit=20&offset=40
```
Returns records 40-59.

---

## Sorting

Not yet implemented for list endpoints. Will be added in Phase 4.

---

## Filtering

Supported filters per endpoint (see specific endpoint docs above):
- `organizationId` - Vendor invoices, organization invoices
- `status` - Vendor invoices, organization invoices
- `riskLevel` - Organization invoices
- `vendorId` - Organization invoices

---

## Response Headers

Standard HTTP headers included:
- `Content-Type: application/json`
- `X-Request-ID: <uuid>` (for tracking)
- `X-Response-Time: <ms>`

---

## Testing with cURL

Example with cURL:
```bash
# Register
TOKEN=$(curl -s -X POST http://localhost:3000/api/vendor/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@ex.com","password":"pass123","confirmPassword":"pass123","name":"Test","gstin":"27AABCT1234H1Z0"}' \
  | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

# Use token
curl -X GET http://localhost:3000/api/vendor/profile \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing with Postman

Import collection:
```json
{
  "info": {
    "name": "Phase 3 Vendor API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "item": [
    {
      "name": "Vendor Register",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/vendor/register",
        "body": {
          "mode": "raw",
          "raw": "{...}"
        }
      }
    }
  ],
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000/api"
    },
    {
      "key": "token",
      "value": ""
    }
  ]
}
```

---

## API Performance Targets

- Register: < 500ms
- Search: < 200ms
- List: < 500ms
- Submit: < 1000ms (excluding file upload)
- Details: < 300ms

---

**Last Updated**: 2024-01-15
**API Version**: v1 (Implicit)
**Status**: Production Ready
