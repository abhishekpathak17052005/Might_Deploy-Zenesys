import { createFileRoute, useNavigate, useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/vendor/invoices/$id')({
  component: VendorInvoiceDetails,
})

interface OCRResult {
  vendorName?: string
  gstin?: string
  invoiceNumber?: string
  invoiceDate?: string
  poNumber?: string
  totalAmount?: number
  lineItems?: Array<{
    description?: string
    quantity?: number
    unitPrice?: number
    amount?: number
  }>
}

interface Anomaly {
  type: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
}

interface InvoiceDetails {
  _id: string
  invoiceNumber?: string
  vendorId: string
  organizationId: string
  totalAmount?: number
  status: string
  createdAt: string
  updatedAt: string
  attachmentUrl?: string
  ocrResult?: OCRResult
  category?: string
  categoryConfidence?: number
  riskScore?: number
  riskLevel?: string
  anomalies?: Anomaly[]
}

export function VendorInvoiceDetails() {
  const navigate = useNavigate()
  const { id } = useParams({ from: '/vendor/invoices/$id' })
  const [invoice, setInvoice] = useState<InvoiceDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoiceDetails()
  }, [id])

  const fetchInvoiceDetails = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/v1/invoices/${id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch invoice details')

      const data = await response.json()
      setInvoice(data.invoice)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return 'bg-blue-100 text-blue-800'
      case 'OCR_PROCESSING':
        return 'bg-yellow-100 text-yellow-800'
      case 'OCR_COMPLETED':
        return 'bg-purple-100 text-purple-800'
      case 'PROCUREMENT_REVIEW':
        return 'bg-orange-100 text-orange-800'
      case 'APPROVED':
        return 'bg-green-100 text-green-800'
      case 'REJECTED':
        return 'bg-red-100 text-red-800'
      case 'ON_HOLD':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRiskLevelColor = (level?: string) => {
    switch (level) {
      case 'LOW':
        return 'text-green-600'
      case 'MEDIUM':
        return 'text-yellow-600'
      case 'HIGH':
        return 'text-orange-600'
      case 'CRITICAL':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const getAnomalySeverityColor = (severity: string) => {
    switch (severity) {
      case 'LOW':
        return 'bg-green-100 text-green-800'
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800'
      case 'HIGH':
        return 'bg-orange-100 text-orange-800'
      case 'CRITICAL':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading invoice details...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate({ to: '/vendor/invoices' })}
            className="text-indigo-600 hover:text-indigo-800 font-semibold mb-4"
          >
            ← Back to Invoices
          </button>
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-700 mt-2">{error || 'Invoice not found'}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button
          onClick={() => navigate({ to: '/vendor/invoices' })}
          className="text-indigo-600 hover:text-indigo-800 font-semibold mb-4"
        >
          ← Back to Invoices
        </button>

        {/* Invoice Header Card */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">
                {invoice.invoiceNumber || `Invoice ${invoice._id.substring(0, 8)}`}
              </h1>
              <p className="text-gray-600 mt-2">ID: {invoice._id}</p>
            </div>
            <span
              className={`inline-block px-4 py-2 rounded-lg font-bold text-lg ${getStatusColor(invoice.status)}`}
            >
              {invoice.status.replace(/_/g, ' ')}
            </span>
          </div>

          {/* Key Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Amount</p>
              <p className="text-2xl font-bold text-gray-800">
                ${(invoice.totalAmount || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Submitted</p>
              <p className="font-semibold text-gray-800">{formatDate(invoice.createdAt)}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Category</p>
              <p className="font-semibold text-gray-800">{invoice.category || 'Not categorized'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Category Confidence</p>
              <p className="font-semibold text-gray-800">
                {invoice.categoryConfidence ? `${(invoice.categoryConfidence * 100).toFixed(0)}%` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {/* OCR Results */}
        {invoice.ocrResult && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">OCR Extraction Results</h2>
            <div className="grid grid-cols-2 gap-6">
              {invoice.ocrResult.vendorName && (
                <div>
                  <p className="text-gray-600 text-sm">Vendor Name</p>
                  <p className="font-semibold text-gray-800">{invoice.ocrResult.vendorName}</p>
                </div>
              )}
              {invoice.ocrResult.gstin && (
                <div>
                  <p className="text-gray-600 text-sm">GSTIN</p>
                  <p className="font-semibold text-gray-800">{invoice.ocrResult.gstin}</p>
                </div>
              )}
              {invoice.ocrResult.invoiceNumber && (
                <div>
                  <p className="text-gray-600 text-sm">Invoice Number</p>
                  <p className="font-semibold text-gray-800">{invoice.ocrResult.invoiceNumber}</p>
                </div>
              )}
              {invoice.ocrResult.invoiceDate && (
                <div>
                  <p className="text-gray-600 text-sm">Invoice Date</p>
                  <p className="font-semibold text-gray-800">
                    {new Date(invoice.ocrResult.invoiceDate).toLocaleDateString()}
                  </p>
                </div>
              )}
              {invoice.ocrResult.poNumber && (
                <div>
                  <p className="text-gray-600 text-sm">PO Number</p>
                  <p className="font-semibold text-gray-800">{invoice.ocrResult.poNumber}</p>
                </div>
              )}
              {invoice.ocrResult.totalAmount && (
                <div>
                  <p className="text-gray-600 text-sm">Total Amount (OCR)</p>
                  <p className="font-semibold text-gray-800">
                    ${invoice.ocrResult.totalAmount.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {/* Line Items */}
            {invoice.ocrResult.lineItems && invoice.ocrResult.lineItems.length > 0 && (
              <div className="mt-6">
                <h3 className="font-bold text-gray-800 mb-3">Line Items</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Description</th>
                      <th className="text-right py-2">Qty</th>
                      <th className="text-right py-2">Unit Price</th>
                      <th className="text-right py-2">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.ocrResult.lineItems.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td className="py-2">{item.description || 'N/A'}</td>
                        <td className="text-right">{item.quantity || 'N/A'}</td>
                        <td className="text-right">${(item.unitPrice || 0).toFixed(2)}</td>
                        <td className="text-right">${(item.amount || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Risk Analysis */}
        {(invoice.riskScore !== undefined || invoice.anomalies) && (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Risk Analysis</h2>

            {invoice.riskScore !== undefined && (
              <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-gray-600 text-sm">Risk Score</p>
                    <p className="text-4xl font-bold text-gray-800">{invoice.riskScore}/100</p>
                  </div>
                  <div>
                    <p className={`text-2xl font-bold ${getRiskLevelColor(invoice.riskLevel)}`}>
                      {invoice.riskLevel || 'UNKNOWN'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Anomalies */}
            {invoice.anomalies && invoice.anomalies.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-800 mb-4">Detected Anomalies</h3>
                <div className="space-y-2">
                  {invoice.anomalies.map((anomaly, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-lg ${getAnomalySeverityColor(anomaly.severity)}`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold">{anomaly.type}</p>
                          <p className="text-sm mt-1">{anomaly.message}</p>
                        </div>
                        <span className="text-xs font-bold">{anomaly.severity}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Invoice File */}
        {invoice.attachmentUrl && (
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Invoice File</h2>
            <a
              href={invoice.attachmentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold"
            >
              View/Download Invoice
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
