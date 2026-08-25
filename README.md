# InvoiceFlow - Enterprise Invoice Verification & Risk Intelligence System

InvoiceFlow is an intelligent invoice verification and risk-intelligence platform for finance and procurement teams. It combines a modern frontend experience with backend anomaly detection, validation logic, and approval workflows to help organizations identify suspicious or inconsistent invoices before they are approved.

## 🎯 Overview

The platform converts vendor invoices into structured financial data, validates them against purchase orders and vendor records, analyzes historical patterns, and surfaces explainable risk findings to finance managers.

**Status:** Phase 2 Implementation Complete ✅ | MongoDB Integration In Progress ⏳
**Architecture:** Deterministic (rule-based, no AI except OCR)
**Database:** MongoDB Atlas (Primary) + Firebase Firestore (Legacy)
**Authentication:** Firebase Auth (Email/Password) + Role-Based Access Control
**OCR Provider:** Gemini API (Default) | Ollama (Free Alternative)

---

## 🔴 Problem

Manual invoice review is slow and error-prone. Teams often need to validate:

- Vendor legitimacy and approval status
- GSTIN and vendor information accuracy
- Purchase order existence and amount matches
- Invoice quantity and amount consistency
- Duplicate or split-invoice patterns
- Unusual vendor behavior or historical anomalies
- Suspicious relationships requiring manual review

## ✅ Solution

The system creates a verification layer between invoice submission and final approval:

```text
Vendor Invoice
   ↓
Procurement Officer (Upload)
   ↓
Firebase Authentication
   ↓
Document Processing (OCR)
   ↓
Gemini AI Extraction
   ↓
Deterministic Categorization
   ↓
Vendor Verification (Master Data)
   ↓
GST Validation
   ↓
PO Verification
   ↓
Anomaly Detection
   ↓
Risk Scoring & Evidence
   ↓
Finance Manager (Review & Approve/Reject)
   ↓
Firestore Database + Audit Trail
```

---

## 🚀 Features

### Backend Services (Phase 2 Complete)

| Service | Status | Features |
|---------|--------|----------|
| **Categorization** | ✅ | Keyword-based GL account mapping (9 categories) |
| **Extraction** | ✅ | Gemini OCR + Mock providers for dev |
| **Vendor Verification** | ✅ | Existence, active status, approval checks |
| **GST Verification** | ✅ | Format validation + vendor master match |
| **PO Verification** | ✅ | Vendor match, amount & quantity validation |
| **ERP Abstraction** | ✅ | MockNetSuiteProvider for demo data |
| **Invoice Processing** | ✅ | Complete workflow orchestration |
| **Email Notifications** | ✅ | SMTP + Mock providers |
| **Anomaly Engine** | ✅ | 10+ deterministic rules (existing) |
| **Firebase Auth** | ✅ | Email/Password + role-based access |

### Frontend Components

- React + Vite + TypeScript
- Tailwind CSS + Recharts
- TanStack Router / Query
- Firebase SDK integration
- Centralized API client

### Database & Storage

- **Firestore** - Invoice documents, vendors, POs, users, approvals
- **Cloud Storage** - Original invoice files (PDF, images)
- **Collections** - Real-time queries, transactions support

---

## 🏗️ Project Structure

```
Might_Deploy-Zenesys/
├── frontend/                        # React + TanStack Start
│   ├── src/
│   │   ├── lib/
│   │   │   └── firebase.ts          # Firebase SDK init
│   │   ├── routes/                  # TanStack Router pages
│   │   ├── components/              # Reusable UI components
│   │   └── api/
│   │       └── client.ts            # Centralized API client
│   ├── .env.local                   # Firebase Web config (local only)
│   ├── .env.example                 # Template for .env.local
│   └── package.json
│
├── backend/                         # Express.js API Server
│   ├── src/
│   │   ├── config/
│   │   │   ├── firebase.ts          # Firebase Admin init
│   │   │   ├── env.ts               # Environment validation
│   │   │   └── constants.ts
│   │   ├── middleware/
│   │   │   ├── auth.middleware.ts   # Firebase token verification
│   │   │   ├── error.middleware.ts
│   │   │   └── notFound.middleware.ts
│   │   ├── modules/
│   │   │   ├── anomaly/             # Anomaly detection rules
│   │   │   ├── categorization/      # Deterministic categorization
│   │   │   ├── extraction/          # Gemini OCR integration
│   │   │   ├── vendors/             # Vendor verification
│   │   │   ├── gst/                 # GST validation
│   │   │   ├── purchaseOrders/      # PO verification
│   │   │   ├── erp/                 # ERP provider abstraction
│   │   │   ├── processing/          # Orchestrator
│   │   │   ├── invoices/            # Invoice CRUD
│   │   │   ├── notifications/       # Email service
│   │   │   ├── approvals/           # Approval workflows
│   │   │   ├── audit/               # Audit logging
│   │   │   └── users/               # User management
│   │   └── app.ts                   # Express app setup
│   ├── tests/                       # Test & POC scripts
│   │   ├── test-firebase-auth.js    # Auth test
│   │   ├── test-gemini-api.ts       # Gemini test
│   │   └── test-gemini-v*.js        # Gemini variants
│   ├── .env                         # Firebase Admin + Gemini (local only)
│   ├── .env.example                 # Template for .env
│   ├── .env.production              # Production config
│   └── package.json
│
├── docs/                            # 📚 ALL Documentation
│   ├── audits/                      # Architecture & verification reports
│   │   ├── ARCHITECTURE_AUDIT.md
│   │   ├── AUDIT_EXECUTIVE_SUMMARY.md
│   │   ├── AUDIT_INDEX.md
│   │   ├── AUDIT_RESULTS.txt
│   │   └── VERIFICATION_AUDIT.md
│   ├── deployment/                  # Setup & deployment guides (22 files)
│   │   ├── QUICK_START.md           # 5-minute quickstart
│   │   ├── DEPLOYMENT_GUIDE.md      # Render deployment
│   │   ├── OLLAMA_SETUP.md          # Free OCR setup
│   │   ├── SECURITY_ENV_SETUP.md    # Secrets management
│   │   ├── SECRETS_CHECKLIST.md
│   │   ├── FIREBASE_SETUP.md
│   │   ├── FIREBASE_SETUP_COMPLETE.md
│   │   ├── OCR_PROVIDER_COMPARISON.md
│   │   └── ... (14+ more guides)
│   ├── CONDITION_STATUS_TABLE.md    # Requirement tracking
│   ├── PHASE2_VERIFICATION.md       # Phase 2 checklist
│   ├── REDESIGN_COMPLETE.md         # Redesign summary
│   └── WORKFLOW_MAPPING.md
│
├── .gitignore                       # Protects .env files
├── FOLDER_STRUCTURE.md              # 📋 Guide to project organization
├── README.md                        # This file
├── package.json                     # Root workspace config
├── tsconfig.json                    # TypeScript config
├── render.yaml                      # Render deployment config
└── vite.config.ts                   # Frontend build config
```

**See [`FOLDER_STRUCTURE.md`](./FOLDER_STRUCTURE.md) for detailed organization guide.**

---

## 🔐 Authentication & Authorization

### Firebase Authentication Setup ✅

- **Method:** Email/Password
- **Demo User:** ap17052005@gmail.com (Demo@12345)
- **Web App:** genesis-ec0bd project
- **Token Verification:** Backend validates Firebase ID tokens

### Role-Based Access Control

```typescript
// Middleware verifies role from Firebase custom claims
enum UserRole {
  PROCUREMENT_OFFICER,  // Upload invoices
  FINANCE_MANAGER,      // Review & approve
  ADMIN
}

// Backend middleware
app.use(requireAuth, requireRole(['FINANCE_MANAGER']));
```

---

## 💾 Database Schema

### Firestore Collections

```javascript
// invoiceDocuments
{
  id: uuid,
  invoiceNumber: string,
  uploaderUserId: string,           // Firebase UID
  vendorId: string,
  invoiceType: "PO_BASED" | "NON_PO",
  documentStatus: string,
  storagePath: string,              // Cloud Storage path
  invoiceDate: timestamp,
  totalAmount: number,
  gstin: string,
  poNumber: string,
  lineItems: [...],
  category: {...},
  riskScore: number,
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED",
  extractedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
}

// vendors (master data)
{
  vendorId: string,
  vendorName: string,
  gstin: string,
  status: "ACTIVE" | "INACTIVE",
  approvalStatus: "APPROVED" | "PENDING",
  vendorType: string,
  createdAt: timestamp
}

// purchaseOrders
{
  poId: string,
  vendorId: string,
  poNumber: string,
  poDate: timestamp,
  totalAmount: number,
  items: [...],
  status: string,
  createdAt: timestamp
}

// users
{
  uid: string,              // Firebase UID
  email: string,
  displayName: string,
  role: "PROCUREMENT_OFFICER" | "FINANCE_MANAGER",
  createdAt: timestamp
}

// approvals
{
  approvalId: uuid,
  invoiceDocumentId: string,
  requestedBy: string,      // Firebase UID
  approvedBy: string,
  approvalStatus: string,
  comments: string,
  createdAt: timestamp,
  completedAt: timestamp
}
```

---

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19.2.0 + Vite 8.1.5
- **Language:** TypeScript 5.8.3
- **UI Framework:** Tailwind CSS 4.2.1
- **Routing:** TanStack Router 1.170.18
- **State:** TanStack Query 5.101.1
- **Charts:** Recharts 2.15.4
- **Firebase:** firebase@12.18.0
- **Components:** Custom Card, Button, Input components

### Backend
- **Runtime:** Node.js
- **Framework:** Express 4.19.2
- **Language:** TypeScript 5.5.4
- **Database:** Firebase Firestore + Cloud Storage
- **Authentication:** Firebase Admin SDK 12.4.0
- **Validation:** Zod 3.23.8
- **File Upload:** Multer 1.4.5
- **OCR/AI:** Gemini API (vision models)
- **Testing:** TSX + Native tests

### Infrastructure
- **Database:** MongoDB Atlas (Primary) + Google Cloud Firestore (Legacy)
- **Storage:** Google Cloud Storage
- **Auth:** Firebase Authentication
- **Deployment:** Ready for Render, Vercel, or similar
- **OCR:** Gemini API (Default) or Ollama (Free Alternative)

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Firebase project (genesis-ec0bd configured)
- Gemini API key (for OCR - currently in setup)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd Might_Deploy-Zenesys

# Install dependencies
npm install

# Frontend setup
cd frontend
npm install
# Create .env.local with Firebase config (see FIREBASE_SETUP.md)

# Backend setup
cd ../backend
npm install
# Create .env with Firebase Admin + Gemini config
```

### Run Locally

**Backend:**
```bash
cd backend
npm run dev
# Runs on http://localhost:5000
# API available at http://localhost:5000/api
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
# Open http://localhost:5173 in browser
```

### Testing

```bash
# Backend tests
cd backend
npm run test

# Firebase authentication test
node test-firebase-auth.js

# Gemini API test
node test-gemini.js

# TypeScript check
npm run typecheck
```

---

## 📊 API Endpoints (Backend)

### Authentication
- `POST /api/auth/login` - Firebase login (frontend handles, backend verifies)
- `POST /api/auth/logout` - Logout

### Invoices
- `POST /api/invoices/upload` - Upload invoice document (Procurement Officer)
- `GET /api/invoices/:id` - Get invoice details (Finance Manager)
- `GET /api/invoices` - List invoices (user's uploads)
- `DELETE /api/invoices/:id` - Delete invoice (owner only)

### Processing
- `POST /api/invoices/:id/process` - Trigger OCR + extraction
- `GET /api/invoices/:id/extraction` - Get extraction result
- `GET /api/invoices/:id/categorization` - Get categorization
- `GET /api/invoices/:id/risk` - Get risk analysis

### Approvals
- `POST /api/approvals` - Submit approval (Finance Manager)
- `GET /api/approvals/:id` - Get approval status
- `GET /api/approvals/pending` - List pending approvals

### Vendors
- `GET /api/vendors` - List vendors (master data)
- `GET /api/vendors/:id/verify` - Verify vendor
- `POST /api/vendors` - Create vendor (admin)

---

## 📝 Environment Variables

### Frontend (.env.local)
```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=genesis-ec0bd.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=genesis-ec0bd
VITE_FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
VITE_API_URL=http://localhost:5000/api
```

### Backend (.env)
```env
FIREBASE_PROJECT_ID=genesis-ec0bd
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@genesis-ec0bd.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=...
FIREBASE_STORAGE_BUCKET=genesis-ec0bd.firebasestorage.app
GEMINI_API_KEY=...
GEMINI_EXTRACTION_MODEL=gemini-pro-vision
GEMINI_CATEGORIZATION_MODEL=gemini-pro
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

---

## 📋 Configuration Files

- **FIREBASE_SETUP.md** - Complete Firebase setup instructions
- **FIREBASE_SETUP_COMPLETE.md** - Setup completion status & next steps
- **.gitignore** - Protects `.env`, `.env.local`, sensitive files

---

## 🏪 Design Decisions

### Deterministic Architecture (vs LLM-based)
- ✅ **Categorization:** Keyword-based GL mapping (not Gemini)
- ✅ **Verification:** Business rules (vendor existence, PO checks)
- ✅ **Risk Scoring:** Existing anomaly engine (rule-based)
- ✅ **OCR Only:** Gemini used ONLY for field extraction
- ✅ **Auditability:** All decisions are explainable

### Mock Providers for Development
- ✅ **MockNetSuiteProvider:** Demo vendor/PO data
- ✅ **MockEmailProvider:** No external SMTP needed
- ✅ Development works without credentials

### Firebase over Custom Auth
- ✅ **Centralized:** Backend already uses firebase-admin
- ✅ **Scalable:** Handles thousands of users
- ✅ **Secure:** Industry-standard JWT verification

---

## 🧪 Testing & Verification

### All Systems Tested ✅

```
✅ Firebase Authentication (Email/Password)
✅ Firebase Admin SDK initialization
✅ Firestore database access
✅ Cloud Storage file operations
✅ Custom token creation
✅ User listing & management
✅ Vendor verification logic
✅ GST validation rules
✅ PO verification logic
✅ Anomaly detection engine
✅ Invoice categorization
```

---

## 📚 Documentation

- **FIREBASE_SETUP.md** - Firebase configuration guide
- **FIREBASE_SETUP_COMPLETE.md** - Completion report
- **ARCHITECTURE_AUDIT.md** - System design review
- **CONDITION_STATUS_TABLE.md** - Requirement tracking
- **PHASE2_VERIFICATION.md** - Phase 2 checklist
- **REDESIGN_COMPLETE.md** - Redesign summary

---

## 🚢 Deployment

### Backend (Render)
```bash
# Push to GitHub
git push origin main

# Render deployment
# - Set environment variables in Render dashboard
# - Deploy from Git
# - Runs on PORT (default 5000)
```

### Frontend (Vercel)
```bash
# Push to GitHub
git push origin main

# Vercel deployment
# - Import from Git
# - Set VITE_FIREBASE_* env vars
# - Deploy
```

---

## 🔗 Resources

- **Firebase Console:** https://console.firebase.google.com/project/genesis-ec0bd
- **Gemini API:** https://aistudio.google.com/app/apikey
- **React Docs:** https://react.dev
- **Express Docs:** https://expressjs.com
- **Firestore Docs:** https://firebase.google.com/docs/firestore

---

## 👥 Team & Support

**Project Status:** Phase 2 Implementation Complete ✅
**Last Updated:** August 22, 2026
**Demo User:** ap17052005@gmail.com

For questions or issues, refer to documentation files or check test scripts for verification.

---

## 📄 License

MIT

