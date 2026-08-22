# Financial Invoice Risk & Verification Backend

Express and TypeScript backend for invoice document intake, Firebase-backed storage, anomaly evaluation, finance review, approvals, and audit logging. The API is mounted under `/api`.

## Repository status

The checked-in application source is in `src/`. This checkout does not currently include a `package.json` or `tsconfig.json`, so the TypeScript build and start scripts still need to be supplied before the server can be launched with npm. `requirements.txt` belongs to the previous FastAPI layout and is not used by the current Express application.

## Configuration

Copy `.env.example` to `.env` and provide Firebase Admin credentials:

```dotenv
PORT=5000
NODE_ENV=development
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
CORS_ORIGIN=http://localhost:5173
```

`FIREBASE_PRIVATE_KEY` may contain escaped `\n` characters; the application converts them to line breaks during Firebase initialization. The server validates all required Firebase settings at startup.

## API

Protected endpoints require `Authorization: Bearer <Firebase ID token>`.

| Method | Endpoint | Access | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Check that the API is running |
| GET | `/api/health/firebase` | Public | Check Firestore, Storage, and Auth configuration |
| GET | `/api/auth/me` | Authenticated | Return the authenticated Firebase user |
| POST | `/api/invoices/upload` | `PROCUREMENT`, `ADMIN` | Upload one PDF or image invoice |
| GET | `/api/invoices` | `PROCUREMENT`, `ADMIN` | List the current user's invoices |
| GET | `/api/invoices/:documentId` | Authenticated owner | Read an invoice document |
| GET | `/api/invoices/:documentId/download` | Authenticated owner | Create a one-hour download URL |
| DELETE | `/api/invoices/:documentId` | Authenticated owner | Delete an invoice document |
| POST | `/api/anomaly/evaluate` | Public | Evaluate a supplied invoice context against anomaly rules |
| GET | `/api/finance/review` | `FINANCE_MANAGER`, `CFO`, `ADMIN` | List invoices awaiting review |
| GET | `/api/finance/invoices/:documentId` | Finance roles | Get the full review packet |
| POST | `/api/finance/invoices/:documentId/approve` | Finance roles | Approve an invoice |
| POST | `/api/finance/invoices/:documentId/reject` | Finance roles | Reject an invoice |
| GET | `/api/finance/stats` | Finance roles | Read approval statistics |
| POST | `/api/audit/test` | Authenticated | Verify audit-log write and read access |

### Uploading an invoice

Send a `multipart/form-data` request to `/api/invoices/upload` with:

- `file`: required PDF, JPEG, PNG, TIFF, or WebP file, up to 10 MB
- `invoiceType`: required `PO_BASED` or `NON_PO`
- `vendorId`: optional vendor identifier

Example with PowerShell:

```powershell
curl.exe -X POST http://localhost:5000/api/invoices/upload `
	-H "Authorization: Bearer <firebase-id-token>" `
	-F "file=@.\invoice.pdf" `
	-F "invoiceType=PO_BASED" `
	-F "vendorId=vendor-123"
```

## Development flow

1. Add the project’s Node dependencies and TypeScript build configuration.
2. Create `.env` from `.env.example` and configure a Firebase service account.
3. Start the compiled server from `src/server.ts` on the configured port.
4. Check `GET /api/health`, then `GET /api/health/firebase`.
5. Use a Firebase ID token to upload and review invoice documents.

Unit tests are located next to the anomaly and invoice modules under `src/**/__tests__/`.

## Security boundary

Firebase Authentication verifies identity, while role middleware controls procurement and finance operations. Files are kept in Firebase Storage and metadata/results are stored in Firestore. Anomaly rules run in application code; clients should treat their results as server-generated risk signals rather than replaceable client-side validation.
