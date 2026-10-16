# InvoiceFlow

InvoiceFlow is an invoice intake and review application. The frontend is a TanStack Start app in `frontend/`; the Express API and MongoDB services are in `backend/`.

## Run locally

Requirements: Node.js 20 or newer and MongoDB.

1. Install frontend dependencies from the repository root with `npm install`.
2. Install backend dependencies with `cd backend` then `npm install`.
3. Configure backend values in `backend/.env` using `backend/.env.example` as the variable reference. Set the MongoDB URL, JWT secret, CORS origin, and any OCR provider key you use.
4. Configure `VITE_API_URL` in `frontend/.env.local` (normally `http://localhost:5000/api`).
5. Start the API in one terminal: `cd backend` then `npm run dev`.
6. Start the frontend from the repository root in another terminal: `npm run dev`.

The frontend runs on Vite's local URL and the API defaults to port 5000. The root Vite config proxies `/api` during local development. To run the frontend from its own folder or from the frontend ZIP, use `cd frontend`, `npm install`, and `npm run dev`.

## Useful commands

- Frontend: `npm run dev`, `npm run build`, `npm run typecheck`
- Backend: `cd backend && npm run dev`, `npm run build`, `npm test`

Set `VITE_API_URL` to the deployed API base URL for production. Keep real credentials in local environment files or the hosting provider's secret store; do not commit them.
