# Invoice/document mismatch audit

## Investigation record (before changes)

**Root cause:** The vendor upload route calls `ExtractionService`, but its default Gemini provider fabricates a deterministic sample invoice whenever credentials are unavailable, the Gemini request fails, or the response is unusable. That fabricated invoice explicitly defaults to `ABC Technologies`, `PO-1001`, `Enterprise Software License & Support`, and ₹48,000. The upload handler treats this return as successful OCR and writes those fields to the newly created invoice. This precisely matches the values reported for the catering bill.

The fallback can also invent a random invoice number and GSTIN. For non-text PDFs it converts binary bytes to UTF-8, fails to identify the printed total, and falls back to ₹48,000. `InvoiceService.saveVendorOCRResult` also overwrites the canonical vendor name from the authenticated vendor mapping with the OCR vendor string, so the page can display the fabricated name instead of the actual linked vendor.

The same extraction service normalizer defaults a missing risk result to `LOW` / `0` in `frontend/src/lib/invoice-adapter.ts`. Vendor submission does not run the verification/risk pipeline before persisting, so showing `0/100` does not represent an evaluated risk score.

## Evidence inspected

- `backend/src/routes/vendor.routes.ts`: creates a new invoice with uploaded bytes, then invokes OCR and persists the result.
- `backend/src/modules/extraction/geminiExtractionProvider.ts`: API/credential/error branches returned fabricated sample fields listed above.
- `backend/src/modules/extraction/extraction.service.ts`: normalized provider data and returned it as an extraction result without rejecting absent/weak field evidence.
- `backend/src/services/InvoiceService.ts`: persisted OCR vendor name onto the canonical `vendorName` field; no durable OCR failure state or confidence evidence was stored.
- `backend/src/models/Invoice.ts`: invoice attachment bytes are embedded in the invoice record, but no upload hash or extraction state was recorded.
- `frontend/src/routes/procurement.invoices.$id.tsx` and `frontend/src/lib/invoice-adapter.ts`: detail fetches by route ID, but defaulted missing risk to `LOW` / `0` and preferred the unverified invoice vendor name.
- `backend/src/modules/invoices/invoice.routes.ts`: a separate pipeline path contains a synthetic sample-document fallback, also unsafe for operational extraction.

## Exact record and live evidence

Read-only inspection of invoice `6ad22947e0d3ea6c25d4fa9d` confirmed:

- Before correction it was `OCR_COMPLETED` with `INV-2026-3416`, `ABC Technologies`, `PO-1001`, `Enterprise Software License & Support`, ₹48,000, and no risk evaluation.
- The uploader was a `VENDOR` whose authenticated vendor mapping was `TechSupplies Global` (vendor ID `6ad1f8511860bb390eebfb3b`). The record's old `vendorName` had been overwritten by OCR.
- The record held the upload as an 108,882-byte PNG in `attachmentData`; it had no separate `InvoiceDocument` association and no stored hash. SHA-256 of those exact bytes is `187c63440591afd8d1b89f6c510a95ecd33672ba4f7a61c8bd4b38dc41d3458e`.
- Visual inspection of the stored image confirmed the source is an OM Caterers bill for 1,000 persons with a printed total of about ₹1,00,000. Its printed vendor name does not match the account's registered TechSupplies Global vendor mapping, so the app cannot assert they are the same vendor.
- Before the fix, the authenticated procurement review service returned the same incorrect fields from MongoDB. No separate document record was linked.

After the fix, an authenticated HTTP request to `GET /api/invoices/6ad22947e0d3ea6c25d4fa9d/procurement-review` returned HTTP 200 for the same ID, now `REVIEW_REQUIRED`, with no extracted invoice number, amount, description, or risk score. The canonical vendor is TechSupplies Global, OCR is marked failed due to unverifiable legacy provenance, the PO is unverified, and the response hash matches the stored image. The response is 971 bytes and excludes both the embedded file bytes and private legacy snapshot. Procurement still loads the original image through the authenticated file route.

## Changes

- Removed Gemini's fabricated fallback invoice. Missing credentials, provider failures, empty responses, and malformed JSON now fail extraction.
- Removed the synthetic invoice-byte fallback from the pipeline processing path.
- Added upload SHA-256, extraction status/error/confidence, vendor-match status, PO-match status, and risk-evaluation status to invoice records. Uploaded bytes remain embedded on their newly created invoice record, establishing the document association.
- Kept `vendorName` bound to the authenticated vendor master record. OCR vendor name stays in extraction evidence and is compared to that mapping.
- Persisted OCR totals, subtotal, tax, dates, PO and line items from the extraction result. Low/missing confidence or invalid validation becomes `REVIEW_REQUIRED`.
- Recomputed anomaly/risk output from the persisted invoice and registered vendor. Extraction failure leaves risk `NOT_EVALUATED`; frontend displays this state instead of `LOW / 0`.
- Added an explicit, audited procurement exception acknowledgement before forwarding uploads with unverified OCR/vendor/PO evidence. Finance approval remains a separate step.
- Added a legacy upload reconciliation on the authenticated procurement-review read path. It hashes the original embedded file, removes unverifiable derived fields from operational data, restores the registered vendor name, marks the invoice failed/review-required, clears uncomputed risk, and stores the prior fields in a private non-API snapshot.
- Excluded attachment bytes and private snapshot fields from the review response.
- Updated operational procurement rendering to show extraction/match states and avoid substituting total for subtotal. Added a vendor identity matcher and catering regression tests.
- Updated the stale Phase 3 expected upload status from `OCR_PROCESSING` to the actual `SUBMITTED` state.
- Updated `backend/src/modules/extraction/__tests__/invoice-document-mismatch.regression.test.ts`, `backend/src/__tests__/invoice-document-association.integration.test.ts`, and the backend `test` script.

## Verification

- Backend typecheck: passed.
- Frontend typecheck: passed.
- Backend production TypeScript build: passed.
- Frontend Vite production build: passed.
- New deterministic catering regression suite: 6 passed, 0 failed.
- Complete backend test script: exited successfully. Existing Phase 3 suite passed all 34 checks. The three MongoDB association integration cases were skipped because no dedicated `INVOICEFLOW_TEST_DATABASE_URL` was configured; the separate DB-backed run did not complete in this environment.
- Live authenticated procurement review HTTP request for the exact invoice: HTTP 200, corrected record and hash returned, no file bytes or private snapshot in response.
- No deployment performed.

## Remaining blockers

- The old extracted total and fields were deliberately invalidated, not replaced with manually transcribed values. The bill must be reprocessed by a working OCR provider, or corrected through an explicit human review. Until then the page correctly shows `Not extracted` and `REVIEW_REQUIRED`.
- The OM Caterers name on the document is not the registered TechSupplies Global vendor identity. Procurement must establish the relationship or handle the mismatch explicitly; the system does not equate the names.
- Full DB-backed association integration tests need a dedicated `INVOICEFLOW_TEST_DATABASE_URL`; they were skipped in the final complete test run. Live exact-record inspection and the actual authenticated review API route were exercised separately.
