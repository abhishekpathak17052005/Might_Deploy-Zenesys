import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/vendor/dashboard')({
  component: VendorDashboard,
})

interface VendorProfile {
  _id: string
  name: string
  email: string
  gstin: string
  organizationIds: string[]
  status: string
}

export function VendorDashboard() {
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchVendorProfile()
  }, [])

  const fetchVendorProfile = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate({ to: '/login' })
        return
      }

      const response = await fetch('/api/v1/vendors/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch vendor profile')

      const data = await response.json()
      setVendor(data.vendor)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          <p className="mt-4 text-gray-600">Loading vendor profile...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md">
          <h1 className="text-red-800 font-bold">Error</h1>
          <p className="text-red-700 mt-2">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Vendor Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome, {vendor?.name}!</p>
        </div>

        {/* Vendor Info Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Vendor Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-gray-600 text-sm">Vendor Name</p>
              <p className="text-gray-800 font-semibold">{vendor?.name}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Email</p>
              <p className="text-gray-800 font-semibold">{vendor?.email}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">GSTIN</p>
              <p className="text-gray-800 font-semibold">{vendor?.gstin || 'Not set'}</p>
            </div>
            <div>
              <p className="text-gray-600 text-sm">Status</p>
              <p className={`font-semibold ${vendor?.status === 'ACTIVE' ? 'text-green-600' : 'text-yellow-600'}`}>
                {vendor?.status}
              </p>
            </div>
          </div>
        </div>

        {/* Connected Organizations */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Connected Organizations
          </h2>
          <p className="text-gray-600 mb-4">
            {vendor?.organizationIds.length || 0} organization(s) connected
          </p>
          {vendor?.organizationIds.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">No organizations connected yet</p>
              <button
                onClick={() => navigate({ to: '/vendor/org-search' })}
                className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
              >
                Search & Connect Organization
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {vendor?.organizationIds.map((orgId, idx) => (
                <div key={idx} className="bg-indigo-50 border border-indigo-200 rounded p-3">
                  <p className="text-gray-800 font-semibold">Organization {idx + 1}</p>
                  <p className="text-gray-600 text-sm">{orgId}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => navigate({ to: '/vendor/invoices' })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white py-4 rounded-lg font-semibold transition-colors"
          >
            View Invoices
          </button>
          <button
            onClick={() => navigate({ to: '/vendor/invoice/new' })}
            className="bg-green-600 hover:bg-green-700 text-white py-4 rounded-lg font-semibold transition-colors"
          >
            Submit Invoice
          </button>
          <button
            onClick={() => navigate({ to: '/vendor/org-search' })}
            className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-lg font-semibold transition-colors"
          >
            Search Organization
          </button>
          <button
            onClick={() => {
              localStorage.removeItem('token')
              navigate({ to: '/login' })
            }}
            className="bg-red-600 hover:bg-red-700 text-white py-4 rounded-lg font-semibold transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </div>
  )
}
