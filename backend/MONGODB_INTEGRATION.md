# MongoDB Integration Guide

## Overview

The InvoiceFlow backend has been successfully integrated with MongoDB, replacing Firebase for data persistence. This document provides a complete guide to the MongoDB setup, models, services, and API endpoints.

## Architecture

### Database: Pragyan
- **Cluster**: cluster0.7fsqglj.mongodb.net
- **Database Name**: Pragyan
- **Collections**: User, Invoice, Vendor

### Collections Structure

#### 1. User Collection
Stores user accounts with authentication credentials.

**Schema:**
```typescript
{
  _id: ObjectId,
  email: string (unique, required),
  password: string (hashed with bcrypt, required),
  name: string (required),
  role: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "ADMIN",
  isActive: boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

**Validation Rules:**
- Email must be unique and valid email format
- Password minimum 6 characters
- Role defaults to PROCUREMENT_OFFICER
- Password is hashed before storage using bcrypt (salt rounds: 10)

**Key Methods:**
- `comparePassword()`: Validates password during login
- `toJSON()`: Returns user object without password field

#### 2. Invoice Collection
Stores invoice documents with line items and status tracking.

**Schema:**
```typescript
{
  _id: ObjectId,
  invoiceNumber: string (unique, required),
  vendorId: ObjectId (ref: Vendor),
  vendorName: string (required),
  invoiceDate: Date (required),
  dueDate: Date (optional),
  totalAmount: number (required, min: 0),
  gstin: string (optional, validates GSTIN format),
  poNumber: string (optional),
  description: string (optional),
  status: "PENDING" | "APPROVED" | "REJECTED" | "ON_HOLD",
  uploadedBy: ObjectId (ref: User, required),
  approvedBy: ObjectId (ref: User, optional),
  rejectionReason: string (optional),
  attachmentUrl: string (optional),
  lineItems: [
    {
      description: string,
      quantity: number (min: 0),
      unitPrice: number (min: 0),
      amount: number
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ vendorId: 1, status: 1 }`: Fast queries by vendor and status
- `{ uploadedBy: 1, createdAt: -1 }`: Fast queries by user with date sorting
- `{ status: 1, createdAt: -1 }`: Fast queries by status with date sorting

#### 3. Vendor Collection
Stores vendor information and statistics.

**Schema:**
```typescript
{
  _id: ObjectId,
  vendorName: string (required),
  vendorCode: string (unique, required),
  gstin: string (optional, validates GSTIN format),
  email: string (optional, validates email format),
  phone: string (optional, validates 10-digit format),
  address: string (optional),
  city: string (optional),
  state: string (optional),
  pincode: string (optional, validates 6-digit format),
  bankName: string (optional),
  accountNumber: string (optional),
  ifscCode: string (optional),
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" (default: ACTIVE),
  isApproved: boolean (default: false),
  approvedOn: Date (optional),
  approvedBy: string (optional),
  totalInvoices: number (default: 0),
  totalAmount: number (default: 0),
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `{ status: 1, isApproved: 1 }`: Fast filtering by status and approval
- `{ vendorCode: 1 }`: Fast lookup by vendor code
- `{ gstin: 1 }`: Fast lookup by GSTIN

## Authentication

### JWT Token
- **Algorithm**: HS256
- **Expiration**: 24 hours
- **Secret**: Set via `JWT_SECRET` environment variable

**JWT Payload:**
```typescript
{
  userId: string,
  email: string,
  role: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER" | "ADMIN"
}
```

### Authentication Flow
1. User registers with email, password, name, and role
2. Password is hashed with bcrypt before storage
3. User logs in with email and password
4. Backend validates credentials and returns JWT token
5. Client includes token in `Authorization: Bearer <token>` header
6. Backend verifies token and sets `req.user` object

## Services

### UserService
Handles user authentication and profile management.

**Methods:**
- `register(input: RegisterInput): Promise<AuthResponse>`
  - Creates new user with hashed password
  - Returns user object and JWT token
  - Throws error if user already exists or passwords don't match

- `login(input: LoginInput): Promise<AuthResponse>`
  - Validates email and password
  - Returns user object and JWT token
  - Throws error if credentials invalid or user inactive

- `getUserById(userId: string): Promise<IUser | null>`
  - Returns user object by ID

- `getUserByEmail(email: string): Promise<IUser | null>`
  - Returns user object by email

- `updateUser(userId: string, updates: Partial<IUser>): Promise<IUser | null>`
  - Updates user profile (password changes not allowed through this method)

- `getAllUsers(role?: string): Promise<IUser[]>`
  - Returns all active users, optionally filtered by role

### InvoiceService
Handles invoice CRUD operations and status management.

**Methods:**
- `createInvoice(input: CreateInvoiceInput, userId: string): Promise<IInvoice>`
  - Creates new invoice with line items
  - Validates vendor exists
  - Updates vendor statistics (totalInvoices, totalAmount)
  - Returns populated invoice object

- `getInvoiceById(invoiceId: string): Promise<IInvoice | null>`
  - Returns invoice by ID with populated references

- `getInvoices(filters: InvoiceFilters): Promise<{ invoices: IInvoice[], total: number }>`
  - Returns paginated invoices with optional filters
  - Supports filters: vendorId, status, uploadedBy
  - Supports pagination: skip, limit
  - Sorted by createdAt descending

- `updateInvoiceStatus(invoiceId: string, status: string, approvedBy?: string, rejectionReason?: string): Promise<IInvoice | null>`
  - Updates invoice status (PENDING, APPROVED, REJECTED, ON_HOLD)
  - Stores approver ID and rejection reason if applicable
  - Returns updated invoice

- `deleteInvoice(invoiceId: string): Promise<void>`
  - Deletes invoice
  - Updates vendor statistics (decrements totalInvoices, totalAmount)

- `getPendingInvoices(skip?: number, limit?: number): Promise<{ invoices: IInvoice[], total: number }>`
  - Returns paginated list of pending invoices

- `getInvoicesByUser(userId: string, skip?: number, limit?: number): Promise<{ invoices: IInvoice[], total: number }>`
  - Returns paginated list of invoices uploaded by specific user

## API Endpoints

### Authentication Endpoints

#### POST /api/auth/register
Register a new user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "confirmPassword": "password123",
  "name": "John Doe",
  "role": "PROCUREMENT_OFFICER"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "objectid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PROCUREMENT_OFFICER",
      "isActive": true,
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- 400: Missing required fields, passwords don't match, user already exists

#### POST /api/auth/login
Login user and get JWT token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "objectid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PROCUREMENT_OFFICER",
      "isActive": true
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**
- 400: Missing email or password
- 401: Invalid credentials or user inactive

#### GET /api/auth/me
Get current user profile. **Requires JWT token.**

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "objectid",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "PROCUREMENT_OFFICER",
      "isActive": true
    }
  }
}
```

#### PUT /api/auth/profile
Update user profile. **Requires JWT token.**

**Headers:**
```
Authorization: Bearer <token>
```

**Request:**
```json
{
  "name": "Jane Doe"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "_id": "objectid",
      "email": "user@example.com",
      "name": "Jane Doe",
      "role": "PROCUREMENT_OFFICER",
      "isActive": true
    }
  }
}
```

### Invoice Endpoints

#### POST /api/invoices
Create a new invoice. **Requires JWT token with PROCUREMENT_OFFICER role.**

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "invoiceNumber": "INV-001",
  "vendorId": "objectid",
  "vendorName": "Vendor ABC",
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "totalAmount": 5000,
  "gstin": "18AABCT1234H1Z0",
  "poNumber": "PO-001",
  "description": "Office supplies",
  "lineItems": [
    {
      "description": "Item 1",
      "quantity": 10,
      "unitPrice": 100,
      "amount": 1000
    },
    {
      "description": "Item 2",
      "quantity": 40,
      "unitPrice": 100,
      "amount": 4000
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "objectid",
      "invoiceNumber": "INV-001",
      "vendorId": { /* vendor object */ },
      "vendorName": "Vendor ABC",
      "invoiceDate": "2024-01-15T00:00:00Z",
      "totalAmount": 5000,
      "status": "PENDING",
      "uploadedBy": { /* user object */ },
      "lineItems": [...],
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  }
}
```

**Error Responses:**
- 400: Missing required fields
- 401: Missing or invalid token
- 403: Insufficient permissions (not PROCUREMENT_OFFICER)
- 404: Vendor not found

#### GET /api/invoices
Get all invoices with optional filters. **Requires JWT token.**

**Query Parameters:**
- `vendorId` (optional): Filter by vendor ID
- `status` (optional): Filter by status (PENDING, APPROVED, REJECTED, ON_HOLD)
- `uploadedBy` (optional): Filter by user who uploaded
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "total": 50
  }
}
```

#### GET /api/invoices/:id
Get invoice by ID. **Requires JWT token.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "objectid",
      "invoiceNumber": "INV-001",
      ...
    }
  }
}
```

**Error Responses:**
- 404: Invoice not found

#### PUT /api/invoices/:id/status
Update invoice status. **Requires JWT token with FINANCE_MANAGER or ADMIN role.**

**Request:**
```json
{
  "status": "APPROVED"
}
```

Or for rejection:
```json
{
  "status": "REJECTED",
  "rejectionReason": "Invalid amount"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "objectid",
      "status": "APPROVED",
      "approvedBy": { /* user object */ },
      ...
    }
  }
}
```

**Error Responses:**
- 400: Invalid status
- 401: Missing or invalid token
- 403: Insufficient permissions (not FINANCE_MANAGER/ADMIN)
- 404: Invoice not found

#### DELETE /api/invoices/:id
Delete invoice. **Requires JWT token. PROCUREMENT_OFFICER can only delete own invoices; ADMIN can delete any.**

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": "Invoice deleted successfully"
  }
}
```

**Error Responses:**
- 401: Missing or invalid token
- 403: Cannot delete other users' invoices (if not ADMIN)
- 404: Invoice not found

#### GET /api/invoices/status/pending
Get pending invoices. **Requires JWT token with FINANCE_MANAGER or ADMIN role.**

**Query Parameters:**
- `page` (optional, default: 1): Page number
- `limit` (optional, default: 20): Items per page

**Response (200):**
```json
{
  "success": true,
  "data": {
    "invoices": [...],
    "total": 15
  }
}
```

## Environment Variables

**Required in `.env`:**
```
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/Pragyan?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your-secret-key-change-in-production
PORT=5000
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
NODE_ENV=development
```

## Error Handling

All endpoints follow consistent error response format:

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

**Common Error Codes:**
- `VALIDATION_ERROR`: Missing or invalid input fields
- `UNAUTHORIZED`: Missing or invalid authentication token
- `FORBIDDEN`: Insufficient permissions
- `NOT_FOUND`: Resource not found
- `REGISTRATION_ERROR`: User registration failed
- `LOGIN_ERROR`: Login failed
- `CREATE_ERROR`: Creation failed
- `UPDATE_ERROR`: Update failed
- `DELETE_ERROR`: Deletion failed

## Role-Based Access Control

### Roles:
1. **PROCUREMENT_OFFICER**
   - Can register invoices
   - Can view all invoices
   - Can delete only own invoices
   - Cannot approve invoices

2. **FINANCE_MANAGER**
   - Can view all invoices
   - Can approve or reject invoices
   - Cannot upload invoices

3. **ADMIN**
   - Can do everything
   - Can manage all users and invoices

## Connection Status

### To Check MongoDB Connection:
```bash
curl http://localhost:5000/api/health
```

**Response when connected:**
```json
{
  "success": true,
  "data": {
    "message": "Backend is running (Firebase removed - MongoDB mode)",
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

## Known Issues

### MongoDB Connection Firewall Issue
- **Error**: `querySrv ECONNREFUSED _mongodb._tcp.cluster0.7fsqglj.mongodb.net`
- **Cause**: Windows Firewall or network-level firewall blocking port 27017
- **Solution**: 
  1. Add Windows Firewall exception for port 27017
  2. Or configure MongoDB Atlas to allow connection from 0.0.0.0/0 (not recommended for production)
  3. Or contact ISP to unblock MongoDB connections

See `FIREWALL_SOLUTION.md` for detailed troubleshooting steps.

## Testing

### Test User Registration:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "confirmPassword": "password123",
    "name": "Test User",
    "role": "PROCUREMENT_OFFICER"
  }'
```

### Test User Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### Test Protected Endpoint:
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Next Steps

1. **Resolve MongoDB Connection**: Add firewall exception or configure network access
2. **Test Endpoints**: Once MongoDB connects, run endpoint tests
3. **Frontend Integration**: Update frontend to use new MongoDB auth endpoints
4. **Data Migration**: Migrate any existing data from Firebase to MongoDB
5. **Performance Optimization**: Monitor and optimize database queries

## Additional Documentation

- See `FIREWALL_SOLUTION.md` for MongoDB connection troubleshooting
- See `AUDIT_INDEX.md` for audit trail documentation
- See backend README for build and deployment instructions
