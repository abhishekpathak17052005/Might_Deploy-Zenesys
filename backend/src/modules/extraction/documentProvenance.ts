import type { ExtractionResult } from "./extraction.types";

export function extractionMatchesSourceDocument(
  extracted: Pick<ExtractionResult, "sourceDocumentId" | "sourceDocumentVersion" | "sourceDocumentSha256">,
  source: { documentId?: string; version?: number; sha256?: string },
): boolean {
  return Boolean(source.documentId && source.version && source.sha256 &&
    extracted.sourceDocumentId === source.documentId &&
    extracted.sourceDocumentVersion === source.version &&
    extracted.sourceDocumentSha256 === source.sha256);
}
