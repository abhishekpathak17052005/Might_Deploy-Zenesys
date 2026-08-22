# Might_Deploy-Zenesys Project Structure

## Overview
This is a full-stack monorepo project combining Node.js/TypeScript backend with Next.js frontend.

**Last Updated:** August 22, 2026
**Status:** Cleaned and organized (duplicate nested folder removed)

---

## Directory Structure

```
Might_Deploy-Zenesys/
├── .git/                          # Git repository metadata
├── .tanstack/                     # TanStack configuration and cache
├── backend/                       # Node.js/Express backend
│   ├── src/                       # Source code
│   │   ├── config/                # Configuration files
│   │   ├── middleware/            # Express middleware
│   │   ├── modules/               # Feature modules
│   │   │   ├── anomaly/           # Anomaly detection engine
│   │   │   ├── approvals/         # Approval workflows
│   │   │   ├── audit/             # Audit logging
│   │   │   ├── dashboard/         # Dashboard data
│   │   │   ├── invoices/          # Invoice management
│   │   │   ├── pos/               # Point of Sale
│   │   │   ├── reports/           # Reporting
│   │   │   ├── suppliers/         # Supplier management
│   │   │   ├── users/             # User management
│   │   │   └── workflowEngine/    # Workflow orchestration
│   │   ├── routes/                # API routes
│   │   ├── types/                 # TypeScript type definitions
│   │   ├── utils/                 # Utility functions
│   │   ├── app.ts                 # Express app configuration
│   │   └── server.ts              # Server entry point
│   ├── dist/                      # Compiled JavaScript output
│   ├── node_modules/              # NPM dependencies
│   ├── docs/                      # Documentation (audit files, verification reports)
│   ├── package.json               # NPM dependencies manifest
│   ├── package-lock.json          # NPM lock file
│   ├── tsconfig.json              # TypeScript configuration
│   ├── README.md                  # Backend documentation
│   ├── .env.example               # Environment variables template
│   ├── .gitignore                 # Git ignore rules
│   └── src.zip                    # Source code archive
├── frontend/                      # Next.js frontend
│   ├── app/                       # Next.js app directory (routes)
│   ├── components/                # Reusable React components
│   ├── lib/                       # Utility libraries
│   ├── public/                    # Static assets
│   └── src/                       # Additional source files
├── node_modules/                  # Root-level dependencies
├── .gitignore                     # Root-level git ignore rules
├── .prettierignore                # Prettier ignore patterns
├── .prettierrc                    # Prettier code formatting config
├── bunfig.toml                    # Bun bundler configuration
├── components.json                # UI components configuration
├── eslint.config.js               # ESLint configuration
├── next.config.mjs                # Next.js configuration
├── package.json                   # Root package manifest
├── package-lock.json              # NPM lock file
├── pnpm-lock.yaml                 # PNPM lock file
├── tsconfig.json                  # Root TypeScript configuration
├── vite.config.ts                 # Vite bundler configuration
├── server.js                      # Server entry point
└── README.md                      # Project documentation
```

---

## Key Technologies

### Backend
- **Runtime:** Node.js with TypeScript
- **Framework:** Express.js
- **Database:** Firebase (configured in `src/config/firebase.ts`)
- **Features:**
  - Anomaly detection engine with configurable rules
  - Invoice and PO management
  - User authentication via middleware
  - Approval workflow system
  - Audit logging
  - Dashboard data aggregation
  - Report generation

### Frontend
- **Framework:** Next.js
- **Package Manager:** npm/pnpm
- **UI Components:** Configured via `components.json`
- **Styling:** Configured with Prettier and ESLint

---

## Configuration Files Explained

| File | Purpose |
|------|---------|
| `package.json` | Root dependencies and workspace configuration |
| `tsconfig.json` | TypeScript compiler options for the project |
| `.prettierrc` | Code formatting rules |
| `eslint.config.js` | Code quality and linting rules |
| `next.config.mjs` | Next.js build and runtime configuration |
| `vite.config.ts` | Vite bundler configuration |
| `bunfig.toml` | Bun runtime configuration |
| `components.json` | UI component library configuration |

---

## Lock Files

- **package-lock.json:** NPM package manager lock file
- **pnpm-lock.yaml:** PNPM package manager lock file
- *(Both are present for dual-package-manager support)*

---

## Backend Modules

### Core Modules
1. **Anomaly** - Fraud/anomaly detection with rule engine
2. **Approvals** - Workflow-based approval system
3. **Audit** - Transaction and change logging
4. **Dashboard** - Analytics and metrics aggregation
5. **Invoices** - Invoice lifecycle management
6. **POS** - Point of Sale system integration
7. **Reports** - Report generation and export
8. **Suppliers** - Vendor/supplier management
9. **Users** - User authentication and management
10. **Workflow Engine** - Process orchestration

---

## Cleanup Summary

✅ **Completed:**
- Removed nested duplicate `Might_Deploy-Zenesys` folder (contained Python project files)
- Verified root-level file consolidation
- Confirmed proper project structure

✅ **Retained:**
- All backend documentation files (audit reports, verification notes) as project history
- Dual lock files (npm + pnpm) for package management compatibility
- All source code and configuration

---

## Notes

- The project uses **monorepo structure** with separate backend and frontend
- Backend is a **Node.js/Express API** with TypeScript
- Frontend is a **Next.js application**
- Multiple bundlers configured (Vite, Bun, Next.js native)
- Firebase is configured as the primary backend database

