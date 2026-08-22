# InvoiceFlow

InvoiceFlow is an intelligent invoice verification and risk-intelligence platform for finance and procurement teams.

It combines a modern frontend experience with backend anomaly detection, validation logic, and approval workflows to help organizations identify suspicious or inconsistent invoices before they are approved.

## Overview

The platform converts vendor invoices into structured financial data, validates them against purchase orders and vendor records, analyzes historical patterns, and surfaces explainable risk findings to finance managers.

## Problem

Manual invoice review is slow and error-prone. Teams often need to validate:

- vendor legitimacy and approval status
- GSTIN and vendor information accuracy
- purchase order existence and matches
- invoice quantity and amount consistency
- duplicate or split-invoice patterns
- unusual vendor behavior or historical anomalies
- suspicious relationships that require manual review

## Solution

The system creates a verification layer between invoice submission and final approval.

```text
Vendor
   ↓
Procurement Officer
   ↓
Invoice Upload
   ↓
Document Processing
   ↓
OCR / AI Extraction
   ↓
Invoice Categorization
   ↓
Deterministic Validation
   ↓
Vendor / GST / PO Verification
   ↓
Relationship & Historical Analysis
   ↓
Risk Engine
   ↓
Explainable Risk Findings
   ↓
Finance Manager
   ↓
Approve / Reject
```

## Frontend

This repository contains a frontend app built with React, Vite, Tailwind, and TanStack tooling.

### Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173 in your browser.

## Backend

The project also includes backend services for extraction, categorization, validation, anomaly detection, approval flows, and audit logging.

## Tech stack

- React + Vite
- TypeScript
- Tailwind CSS
- TanStack Router / Query
- Recharts
- Backend API modules for invoice processing and risk analysis

## Related project info

This repository is also connected to a v0 project setup with a full frontend workflow and can be continued in the app environment.

