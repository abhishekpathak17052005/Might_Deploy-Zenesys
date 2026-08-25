import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/vendor/invoices/')({
  component: VendorInvoicesList,
})

interface Invoice {
  _id: string
  invoiceNumber?: string
  totalAmount?: number
  status: string
  createdAt: string
  organizationId: string
}

type InvoiceStatus = 'SUBMITTED' | 'OCR_PROCESSING' | 'OCR_COMPLETED' | 'PROCUREMENT_REVIEW' | 'APPROVED' | 'REJECTED' | 'ON_HOLD'

export function VendorInvoicesList() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'ALL'>('ALL')

  useEffect(() => {
    fetchInvoices()
  }, [statusFilter])

  const fetchInvoices = async () => {
    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      let url = '/api/v1/invoices'
      if (statusFilter !== 'ALL') {
        url += `?status=${statusFilter}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch invoices')

      const data = await response.json()
      setInvoices(data.invoices || [])
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <button
              onClick={() => navigate({ to: '/vendor/dashboard' })}
              className="text-indigo-600 hover:text-indigo-800 font-semibold mb-4"
            >
              ← Back to Dashboard
            </button>
            <h1 className="text-4xl font-bold text-gray-800">My Invoices</h1>
            <p className="text-gray-600 mt-2">Track and manage your submitted invoices</p>
          </div>
          <button
            onClick={() => navigate({ to: '/vendor/invoice/new' })}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + Submit Invoice
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Status Filter */}
        <div className="bg-white rounded-lg shadow-lg p-4 mb-8">
          <div className="flex flex-wrap gap-2">
            {(['ALL', 'SUBMITTED', 'OCR_PROCESSING', 'OCR_COMPLETED', 'APPROVED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                  statusFilter === status
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {status === 'ALL' ? 'All' : status.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <p className="mt-4 text-gray-600">Loading invoices...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && invoices.length === 0 && (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <p className="text-gray-600 font-semibold mb-4">No invoices found</p>
            <button
              onClick={() => navigate({ to: '/vendor/invoice/new' })}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-semibold"
            >
              Submit Your First Invoice
            </button>
          </div>
        )}

        {/* Invoices List */}
        {!loading && invoices.length > 0 && (
          <div className="space-y-4">
            {invoices.map((invoice) => (
              <div
                key={invoice._id}
                onClick={() => navigate({ to: `/vendor/invoices/${invoice._id}` })}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow cursor-pointer"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">
                      {invoice.invoiceNumber || `Invoice ${invoice._id.substring(0, 8)}`}
                    </h3>
                    <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-gray-600">
                      <div>
                        <p className="text-xs text-gray-500">Amount</p>
                        <p className="font-semibold text-gray-800">
                          ${(invoice.totalAmount || 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Submitted</p>
                        <p className="font-semibold text-gray-800">
                          {formatDate(invoice.createdAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Organization</p>
                        <p className="font-semibold text-gray-800">
                          {invoice.organizationId.substring(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="ml-4">
                    <span
                      className={`inline-block px-3 py-1 rounded-full font-semibold text-sm ${getStatusColor(
                        invoice.status
                      )}`}
                    >
                      {invoice.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {!loading && invoices.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Summary</h2>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-gray-600 text-sm">Total Invoices</p>
                <p className="text-2xl font-bold text-gray-800">{invoices.length}</p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Total Amount</p>
                <p className="text-2xl font-bold text-gray-800">
                  ${invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {invoices.filter((inv) => inv.status === 'APPROVED').length}
                </p>
              </div>
              <div>
                <p className="text-gray-600 text-sm">Pending Review</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {invoices.filter((inv) =>
                    ['SUBMITTED', 'OCR_PROCESSING', 'OCR_COMPLETED', 'PROCUREMENT_REVIEW'].includes(inv.status)
                  ).length}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
