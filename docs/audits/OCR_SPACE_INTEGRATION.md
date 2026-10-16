# OCR.space integration audit

## Status

OCR.space multipart upload and text recognition are integrated into the authenticated vendor invoice upload path and selected as the default OCR provider. A live smoke test through the configured `ExtractionService` succeeded using a synthetic one-page catering invoice and the server's configured OCR.space credentials. The credential was not printed or sent to the browser. No real vendor invoice was sent to OCR.space, and the complete authenticated browser-to-Mongo workflow was not exercised against the external provider.

## Configuration

Configure these values in the backend environment only:

```dotenv
EXTRACTION_PROVIDER=ocr_space
OCR_SPACE_API_KEY=<server-side OCR.space key>
OCR_SPACE_ENDPOINT=https://api.ocr.space/parse/image
```

`OCR_SPACE_API_KEY` is sent only as the OCR.space `apikey` request header. It is not placed in multipart form fields, the frontend bundle, API responses, or application logs. The endpoint must be HTTPS and must not include credentials or query parameters. The checked-in example uses a placeholder; no key is recorded in this report.

The provider posts the uploaded bytes as multipart field `file`, with `OCREngine=2`, `isTable=true`, `detectOrientation=true`, `scale=true`, and `isOverlayRequired=false`. The implementation checks response-level and per-page OCR status, errors, and non-empty parsed text. Timeouts, rate limits, invalid credentials, oversized documents, unavailable responses, malformed responses, and empty OCR text all become explicit extraction failures and retain the upload in review-required state.

The OCR.space Free path accepts PDF and supported image signatures up to 1,000,000 bytes. OCR.space documents a 1 MB file limit, a three-page PDF limit, and a free API rate limit; excess page counts are reported as provider failures. The local upload route validates MIME type and file signatures before storage and OCR.

## Evidence and data handling

- The vendor upload creates a new invoice record, embeds that upload's bytes in that record, calculates SHA-256, and binds `sourceDocumentId` to that record ID at version 1.
- Extraction hashes the exact input bytes and carries document ID, version, and hash with the result. Persistence rejects extraction results whose identity/version/hash do not match the invoice's upload.
- OCR.space raw text and the structurer's per-field evidence excerpts are saved with the extraction result. Values without textual evidence remain missing. Model confidence is not calibrated, so extracted values remain uncertain and procurement review is required.
- OCR is separate from registered-vendor verification, PO matching, risk evaluation, and approval. OCR persistence leaves those checks unverified or not evaluated; finance approval remains behind the existing procurement action and separation-of-duties rules.
- Upload retries require an `Idempotency-Key`; MongoDB uniqueness prevents duplicate records for the same uploader, organization, and key. An atomic `PENDING` to `PROCESSING` claim permits only one OCR request for a record.
- Procurement reads remain authenticated and organization scoped. The page displays the requested invoice record, linked document ID/version/hash, OCR text, provenance, and mismatch state.
- Upload and OCR success/failure are audit logged with document identity and hash. The OCR API key and document text are not included in logs.

## Changed files

- `backend/src/config/env.ts`, `backend/.env.example`, `backend/.env.production`: OCR.space environment configuration and provider selection.
- `backend/src/modules/extraction/ocrSpaceProvider.ts`, `documentProvenance.ts`: multipart client, input validation, API response handling, OCR text parsing, field provenance, and one-to-one source association checks.
- `backend/src/modules/extraction/extraction.service.ts`, `extraction.schemas.ts`, `extraction.types.ts`, `index.ts`: OCR.space provider selection, missing-field normalization, and source document hash propagation.
- `backend/src/models/Invoice.ts`: source document ID/version, idempotency key, and OCR text/provenance fields.
- `backend/src/services/InvoiceService.ts`: source hash verification, idempotency, one-time processing claim, persistence, and audit events.
- `backend/src/routes/vendor.routes.ts`: authenticated upload validation, one-megabyte limit, required idempotency key, and OCR failure handling.
- `frontend/src/routes/vendor.invoice.new.tsx`: removal of demo organization/unauthenticated success fallback, 1 MB check, and idempotency header.
- `frontend/src/routes/procurement.invoices.$id.tsx`: source-document association, mismatch, raw OCR text, and provenance display.
- `backend/src/modules/extraction/__tests__/ocrSpaceProvider.test.ts`, `invoice-document-mismatch.regression.test.ts`, `backend/src/__tests__/invoice-document-association.integration.test.ts`, `backend/package.json`: synthetic format, error, missing-field, catering, mismatch, idempotency, and regression test coverage.

## Test results

- Live OCR.space API smoke test through `new ExtractionService()` (before the OCR/structuring separation): **passed**. A generated synthetic PDF was posted to the configured endpoint. OCR.space returned text that the then-current parser read as vendor `OM Caterers`, invoice `OM-SYNTH-2026`, total `100000`, and one catering line item. The returned extraction was linked to the synthetic document ID/version and included the uploaded-byte SHA-256. Only this synthetic file was sent. Current OCR.space adapter returns recognized text only; Gemini/Groq structure it.
- Complete backend `npm test`: **passed** (exit code 0), including the OCR.space provider and existing regression suites. MongoDB-dependent association cases require `INVOICEFLOW_TEST_DATABASE_URL`.
- Backend production TypeScript build: **passed** (`npm run build`).
- Frontend TypeScript check: **passed** (`npm run typecheck`).
- Frontend production build: **passed** (`npm run build`, client and SSR bundles).
- Separate MongoDB-backed association test attempt: **not completed**. The test process stopped after TAP initialization with no test-case output and was interrupted. Its cases remain in the suite but were not verified against MongoDB in this run.
- No deployment performed.

## Remaining limitations

- The actual OM Caterers source bill was not sent to OCR.space. The synthetic check proves the configured API request and this parser can process a synthetic PDF, not that OCR.space will recognize every layout or the original bill accurately.
- OCR.space returns recognized text rather than invoice-field confidence. Gemini/Groq structured values remain review-required; human review and separate verification are still necessary.
- OCR-space recognition and model structuring may not reliably handle complex tables, handwritten entries, multi-column scans, or unusual Indian number/date formats. Unrecognized content remains in raw OCR text rather than being fabricated.
- The Free tier has provider-side page and request limits; no asynchronous queue or retry scheduler was added. Provider failures retain the upload and require an explicit reprocess action, which is not implemented here.
- MongoDB-backed idempotency and document-mismatch integration assertions need a working dedicated test database to confirm end-to-end.
- A complete authenticated vendor upload to procurement detail request against OCR.space was not run; the live check exercised the configured provider directly, while application routes/builds were verified locally.

## Follow-up for vendor review-required screen (October 16, 2026)

The reported vendor screen showed `REVIEW REQUIRED`, `$0.00`, and an organization ending in `(Demo)`. Static trace confirmed that the upload route persisted OCR failures as `FAILED`/`REVIEW_REQUIRED` with `extractionError`, while the new-invoice page always announced success and redirected without inspecting the returned invoice. The vendor list and detail pages formatted absent `totalAmount` as zero; the detail page also displayed dollar currency. This made an OCR failure look like an accepted zero-value result.

Frontend changes now inspect the upload response and show the extraction state/message with a direct link to that invoice. Vendor list/detail show `Not extracted` when the amount is absent, use INR formatting, expose OCR failure/review details, include review-required invoices in status filters, and show risk only when the API marks the evaluation as complete. The organization name is the populated organization value returned by the authenticated vendor invoice list; this static review did not query the reported invoice's Mongo record, so it cannot establish why that specific organization is named `(Demo)`.

Follow-up verification: frontend `npm run typecheck` and `npm run build` both passed. No deployment performed.

## OCR text parsing follow-up (October 16, 2026)

The vendor submission screen exposed a review-required result with no total or line items for a JPEG upload. The stored OCR result keeps OCR.space raw text and line provenance, but the vendor detail page did not display that evidence, making it hard to tell whether text recognition or structured parsing failed. Numeric normalization now removes the actual Unicode rupee glyph before parsing, and the provider regression suite includes an Indian-formatted ₹1,00,000 catering total with quantity, unit price, and line amount. The vendor invoice detail page now displays the OCR text and per-field source evidence when available. Backend test suite and build passed; frontend typecheck/build passed. The source JPEG itself was not available in this workspace, so this does not establish that OCR.space will correctly recognize that particular image.

## OCR.space, Gemini, and Groq text structuring (October 16, 2026)

OCR.space is the only provider that receives uploaded invoice bytes in the default path. Its adapter returns OCR text only. Gemini receives that text and structures invoice fields; it never receives the source bill image through this flow. Each scalar and line item must cite an exact excerpt from OCR text, and each reported amount/quantity must appear in that excerpt. Unsupported values are discarded. Model confidence is not treated as calibrated confidence, so extraction continues to require review and separate vendor/PO verification.

When Gemini exhausts exponential-backoff retries on transient server errors (HTTP 5xx), times out, has a network failure, or returns a rate-limit/quota error (HTTP 429), the backend sends the same OCR text to Groq as a structuring fallback. Groq does not receive the file bytes. The configured default is `qwen/qwen3.8-27b`; the previous `qwen/qwen3.6-27b` default was deprecated on September 14, 2026. Groq output uses the same evidence checks. Invalid Gemini credentials remain a visible configuration error and do not trigger fallback. If both structurers fail, the original OCR text remains stored, structured fields stay empty, and the invoice remains review-required with an error.

Google receives OCR text when Gemini is called; Groq receives OCR text only when the transient-error fallback is activated. Both texts may contain vendor and financial information. Gemini and Groq keys are read only by the backend, are sent in request headers, and are not logged or returned to the browser.

Live synthetic-only API checks: Gemini `gemini-3.6-flash` successfully structured a synthetic OM Caterers invoice text. Groq `qwen/qwen3.8-27b` also successfully structured the same synthetic text with the configured backend key. These checks confirm the two structurer APIs and evidence validation, not the recognition accuracy of OCR.space on the user's original image.

## Existing invoice retry action

Vendor invoice detail includes a retry action for review-required or failed extraction. The authenticated vendor endpoint atomically claims only that vendor's original, still-reviewable invoice, checks the stored document hash, reruns OCR.space and the configured text structurers from the exact stored bytes, and audits the retry. It does not create a second invoice or change document identity. Restart the backend after environment or code changes, then use **Retry extraction from this bill** on the existing invoice.

Groq fallback verification: focused mocked extraction suite passed (13/13), covering transient Gemini failure, timeout, rate-limit/quota routing, OCR-text-only Groq input, evidence validation, and no fallback for Gemini credential errors. Backend TypeScript build passed. The quota fallback was tested with a simulated response; no live API quota error was induced. The full backend suite and frontend build were not rerun for this final fallback-condition change. No deployment performed.

## Labelled total recovery follow-up (October 16, 2026)

The provided OM Caterers bill image visibly prints `Total Amount` and `1,00,000/-` in the final table row. Added a conservative OCR-text fallback that recovers a numeric total only when it appears on the same or next two OCR lines after an explicit total label (such as `Total Amount` or `Grand Total`), records those exact OCR lines as provenance, and never infers the amount from words or unrelated numbers. This supplements Gemini/Groq structuring when they omit the total; missing or ambiguous evidence remains null. Procurement review is still required because confidence is uncalibrated.

Verification for this follow-up: focused extraction suite passed (16/16), including the printed Indian-format total and label-only negative case; backend TypeScript build passed; `git diff --check` passed. The original photo was not sent directly to an external OCR API from this workspace; the test uses synthetic OCR text matching its printed Indian-number format. No deployment performed.

## Dual model quota exhaustion follow-up (October 16, 2026)

The latest vendor upload screenshot reported that Gemini and Groq both hit their rate limits/quotas, leaving no structured fields. Added a local OCR-text-only fallback after both structurers fail: it recovers a total only next to explicit invoice-total labels and parses numbered descriptions only inside a titled details section, retaining OCR evidence for both. It does not infer vendor identity, invoice number, quantity, unit price, line amount, subtotal, or tax. Such invoices remain review-required and the provider/error fields indicate that AI structuring was unavailable. The fallback applies on both new uploads and extraction retries. Focused extraction suite passed (16/16) with a synthetic OM Caterers bill matching the visible row layout; backend build passed. The original bill photo was not uploaded to an external service from this workspace. No deployment performed.

## Catering bill partial-structure follow-up (October 16, 2026)

The vendor screenshot for invoice `6ad24a9723281d426cdac3f2` showed `ocr_space+gemini_text`, vendor `OM CATERERS`, a printed date in OCR text (`17 September 2026`), and a list of catering menu descriptions. Invoice-number and pricing evidence was not visible in the captured OCR excerpt. This means Gemini returned successfully, so the transient-error fallback correctly did not run. Two strictness bugs were identified: the item prompt discarded menu descriptions without row-level prices, and ISO-normalized dates were rejected because the verifier expected the normalized date string itself to appear verbatim in OCR.

Gemini and Groq now retain an evidence-backed item description even when its quantity, unit price, and amount are unknown; those numeric fields remain null. The invoice-level `1000 Persons` quantity is not copied onto each menu item. Date verification now accepts an exact OCR quote containing an equivalent month-name date and normalizes it to ISO without local-timezone shifts. If Gemini returns without a supported total or item descriptions, Groq receives the same OCR text and is selected only when its evidence-backed result is more complete. Procurement displays null prices/amounts as unavailable instead of ₹0.

Regression tests cover a month-name date, item descriptions with null numeric fields, and Groq fallback on a successful-but-incomplete Gemini result. Focused extraction tests passed (12/12), the full backend test suite passed (exit code 0, MongoDB association cases skipped without the dedicated URL), backend build and frontend typecheck passed, and frontend production build passed. The existing uploaded invoice was not reprocessed from this workspace; restart the backend and use its retry action to apply the changes to that record. No deployment performed.
