import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle } from 'lucide-react'

export interface ReconciliationStatusProps {
  totalAmount?: number | null
  subtotal?: number | null
  taxAmount?: number | null
  extractionStatus?: string
  extractionError?: string
  ocrResult?: {
    totalAmount?: number | null
    subtotal?: number | null
    taxAmount?: number | null
    reconciliationStatus?: string
    reconciliationMessage?: string
  }
}

export function getReconciliationDetails(props: ReconciliationStatusProps) {
  const ocr = props.ocrResult
  const status = ocr?.reconciliationStatus
  const total = props.totalAmount ?? ocr?.totalAmount
  const subtotal = props.subtotal ?? ocr?.subtotal
  const tax = props.taxAmount ?? ocr?.taxAmount
  const err = props.extractionError || ''

  // 1. Verified arithmetic mismatch
  if (status === 'MISMATCH' || err.toLowerCase().includes('total does not equal')) {
    return {
      type: 'ARITHMETIC_MISMATCH' as const,
      title: 'Arithmetic Mismatch Detected',
      message: ocr?.reconciliationMessage || 'The extracted grand total does not equal subtotal plus tax and adjustments. Procurement review is required to verify calculations.',
      variant: 'destructive' as const,
      borderClass: 'border-red-300 bg-red-50 text-red-900',
      iconClass: 'text-red-600',
      icon: AlertCircle,
    }
  }

  // 2. Missing or unverified total
  if (
    status === 'REVIEW_REQUIRED' ||
    total == null ||
    total <= 0 ||
    err.toLowerCase().includes('total could not be extracted') ||
    err.toLowerCase().includes('missing total') ||
    err.toLowerCase().includes('supported invoice total')
  ) {
    return {
      type: 'MISSING_TOTAL' as const,
      title: 'Missing or Unverified Grand Total',
      message: 'A printed numeric grand total was not established from source evidence on this bill. The original attachment is saved, and procurement review is required to confirm the payable total.',
      variant: 'warning' as const,
      borderClass: 'border-amber-300 bg-amber-50 text-amber-900',
      iconClass: 'text-amber-600',
      icon: AlertTriangle,
    }
  }

  // 3. Missing tax or subtotal
  if (
    status === 'INCOMPLETE' ||
    (subtotal == null && tax == null) ||
    err.toLowerCase().includes('missing tax') ||
    err.toLowerCase().includes('missing subtotal')
  ) {
    return {
      type: 'MISSING_TAX_OR_SUBTOTAL' as const,
      title: 'Missing Tax or Subtotal Breakdown',
      message: 'Tax breakdown or subtotal is not fully established from document evidence. Reconciliation is incomplete pending procurement verification.',
      variant: 'info' as const,
      borderClass: 'border-blue-300 bg-blue-50 text-blue-900',
      iconClass: 'text-blue-600',
      icon: HelpCircle,
    }
  }

  // 4. Successful reconciliation
  if (
    status === 'RECONCILED' ||
    (total != null && total > 0 && subtotal != null && tax != null && Math.abs(total - (subtotal + tax)) <= 0.05) ||
    props.extractionStatus === 'SUCCEEDED'
  ) {
    return {
      type: 'RECONCILED' as const,
      title: 'Reconciliation Verified',
      message: ocr?.reconciliationMessage || 'Invoice amounts reconciled successfully: grand total matches subtotal, tax, and line items within tolerance.',
      variant: 'success' as const,
      borderClass: 'border-emerald-300 bg-emerald-50 text-emerald-900',
      iconClass: 'text-emerald-600',
      icon: CheckCircle2,
    }
  }

  return {
    type: 'INCOMPLETE' as const,
    title: 'Reconciliation Incomplete',
    message: 'Reconciliation could not be confirmed. Manual review required.',
    variant: 'warning' as const,
    borderClass: 'border-amber-300 bg-amber-50 text-amber-900',
    iconClass: 'text-amber-600',
    icon: AlertTriangle,
  }
}

export function ReconciliationStatusAlert(props: ReconciliationStatusProps) {
  const details = getReconciliationDetails(props)
  const Icon = details.icon

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${details.borderClass}`} role="status">
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 size-5 shrink-0 ${details.iconClass}`} />
        <div className="flex-1">
          <h4 className="font-bold text-sm">{details.title}</h4>
          <p className="mt-1 text-xs leading-relaxed opacity-95">{details.message}</p>
          {props.extractionError && details.type !== 'RECONCILED' && (
            <div className="mt-2.5 rounded bg-black/5 p-2 text-xs font-mono">
              <span className="font-semibold text-gray-700">OCR Extraction Details:</span>{' '}
              <span className="text-gray-800">{props.extractionError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
