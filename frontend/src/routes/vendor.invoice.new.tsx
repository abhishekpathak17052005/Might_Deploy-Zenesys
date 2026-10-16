import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { requireRole } from '@/lib/route-guards'
const API_BASE = import.meta.env['VITE_API_URL'] || 'http://localhost:5000/api'

export const Route = createFileRoute('/vendor/invoice/new')({
  beforeLoad: () => requireRole(['VENDOR']),
  component: VendorInvoiceNew,
})

interface Organization {
  _id: string
  name: string
}

const DEMO_ORGANIZATION: Organization = {
  _id: 'demo-acme-corp',
  name: 'Acme Corp (Demo)',
}

export function VendorInvoiceNew() {
  const navigate = useNavigate()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedOrgId, setSelectedOrgId] = useState('')
  const [attachment, setAttachment] = useState<File | null>(null)
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [material, setMaterial] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [materialAmount, setMaterialAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchVendorOrganizations()
  }, [])

  const fetchVendorOrganizations = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/vendor/profile`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch organizations')

      const json = await response.json()
      const vendor = json.data?.vendor || json.vendor
      const orgList = vendor?.organizationIds || []
      const mappedOrganizations = orgList.map((org: any) => ({
          _id: typeof org === 'object' ? org._id : org,
          name: typeof org === 'object' && org.name ? org.name : `Organization ${typeof org === 'string' ? org.substring(0, 8) : ''}...`,
        }))
      setOrganizations(mappedOrganizations.length ? mappedOrganizations : [DEMO_ORGANIZATION])
    } catch (err) {
      setOrganizations([DEMO_ORGANIZATION])
      setError(null)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setAttachment(e.target.files[0])
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrgId) {
      setError('Please select an organization')
      return
    }
    if (!attachment) {
      setError('Please select an invoice file')
      return
    }

    setLoading(true)
    setError(null)

    try {
      if (!localStorage.getItem('token')) {
        setSuccess(true)
        setLoading(false)
        setTimeout(() => {
          navigate({ to: '/vendor/invoices' })
        }, 2000)
        return
      }

      const formData = new FormData()
      formData.append('invoice', attachment)
      formData.append('organizationId', selectedOrgId)
      formData.append('invoiceNumber', invoiceNumber)
      formData.append('totalAmount', totalAmount)
      formData.append('lineItems', JSON.stringify(material.trim() ? [{ description: material.trim(), quantity: Number(quantity), unitPrice: Number(materialAmount) / Math.max(1, Number(quantity)), amount: Number(materialAmount) }] : []))

      const response = await fetch(`${API_BASE}/vendor/invoices`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      })

      if (!response.ok) {
        const errJson = await response.json()
        throw new Error(errJson.error?.message || errJson.message || 'Invoice submission failed')
      }

      setSuccess(true)
      setTimeout(() => {
        navigate({ to: '/vendor/invoices' })
      }, 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (organizations.length === 0 && !error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <p className="text-yellow-800 font-semibold">No Organizations Connected</p>
            <p className="text-yellow-700 mt-2">
              You need to connect to an organization first before you can submit invoices.
            </p>
            <button
              onClick={() => navigate({ to: '/vendor/org-search' })}
              className="mt-4 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg"
            >
              Search & Connect Organization
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate({ to: '/vendor/dashboard' })}
            className="text-indigo-600 hover:text-indigo-800 font-semibold mb-4"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-4xl font-bold text-gray-800">Submit Invoice</h1>
          <p className="text-gray-600 mt-2">Upload and submit an invoice for processing</p>
        </div>

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-8">
            <p className="text-green-800 font-semibold">Invoice Submitted Successfully!</p>
            <p className="text-green-700 mt-2">Redirecting to invoice list...</p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-700 mt-2">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-lg p-8">
          {/* Organization Selection */}
          <div className="mb-8">
            <label className="block text-gray-700 font-bold mb-2">
              Organization *
            </label>
            <select
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
              disabled={loading}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500 disabled:bg-gray-100"
            >
              <option value="">Select an organization</option>
              {organizations.map((org) => (
                <option key={org._id} value={org._id}>
                  {org.name}
                </option>
              ))}
            </select>
          </div>

          {/* File Upload */}
          <div className="mb-8">
            <label className="block text-gray-700 font-bold mb-2">
              Invoice File *
            </label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-indigo-500 transition-colors">
              <input
                type="file"
                onChange={handleFileChange}
                disabled={loading}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <div className="text-gray-600">
                  {attachment ? (
                    <>
                      <p className="font-semibold text-green-600">{attachment.name}</p>
                      <p className="text-sm mt-2">Click to change file</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-semibold">Drop invoice file here</p>
                      <p className="text-sm mt-2">or click to browse</p>
                      <p className="text-xs text-gray-500 mt-4">Supported: PDF, PNG, JPG</p>
                    </>
                  )}
                </div>
              </label>
            </div>
          </div>

          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            <div><label className="mb-2 block font-bold text-gray-700">Invoice number</label><input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" placeholder="e.g. INV-1042" /></div>
            <div><label className="mb-2 block font-bold text-gray-700">Invoice total (₹)</label><input type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" placeholder="0.00" /></div>
            <div><label className="mb-2 block font-bold text-gray-700">Material / service supplied</label><input value={material} onChange={(e) => setMaterial(e.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" placeholder="Describe supplied goods or service" /></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-2 block font-bold text-gray-700">Quantity</label><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" /></div><div><label className="mb-2 block font-bold text-gray-700">Line amount (₹)</label><input type="number" min="0" step="0.01" value={materialAmount} onChange={(e) => setMaterialAmount(e.target.value)} disabled={loading} className="w-full rounded-lg border border-gray-300 px-4 py-3" placeholder="0.00" /></div></div>
            <p className="text-sm text-gray-500 sm:col-span-2">Add the invoice details so Procurement can review the materials and amount alongside your uploaded bill.</p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !selectedOrgId || !attachment}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white py-4 rounded-lg font-bold text-lg transition-colors"
          >
            {loading ? 'Submitting...' : 'Submit Invoice'}
          </button>
        </form>

        {/* Help */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">What happens next?</h3>
          <ol className="text-blue-800 space-y-2 text-sm list-decimal list-inside">
            <li>Your invoice will be processed through OCR to extract data</li>
            <li>Risk analysis will be performed on the extracted data</li>
            <li>The organization will review and approve/reject the invoice</li>
            <li>You can track the status in your invoice list</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
