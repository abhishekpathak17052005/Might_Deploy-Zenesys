import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/vendor/org-search')({
  component: VendorOrgSearch,
})

interface Organization {
  _id: string
  name: string
  gstin: string
  address?: string
  city?: string
  state?: string
}

export function VendorOrgSearch() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [results, setResults] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setError('Please enter a search query')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/v1/vendors/organizations/search?q=${encodeURIComponent(searchQuery)}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Search failed')

      const data = await response.json()
      setResults(data.organizations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectOrganization = async (orgId: string) => {
    setLinking(true)
    setError(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/v1/vendors/organizations/select', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId: orgId }),
      })

      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.message || 'Failed to link organization')
      }

      // Success
      navigate({ to: '/vendor/dashboard' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLinking(false)
      setSelectedOrgId(null)
    }
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
          <h1 className="text-4xl font-bold text-gray-800">Search Organizations</h1>
          <p className="text-gray-600 mt-2">Find and connect to organizations you want to work with</p>
        </div>

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by GSTIN or Organization Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </form>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <p className="text-red-800 font-semibold">Error</p>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        )}

        {/* Search Results */}
        <div className="space-y-4">
          {results.length === 0 && searchQuery ? (
            <div className="bg-white rounded-lg shadow p-6 text-center">
              <p className="text-gray-600">
                {loading ? 'Searching...' : 'No organizations found'}
              </p>
            </div>
          ) : (
            results.map((org) => (
              <div key={org._id} className="bg-white rounded-lg shadow-lg p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800">{org.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p><span className="font-semibold">GSTIN:</span> {org.gstin}</p>
                      {org.address && (
                        <p><span className="font-semibold">Address:</span> {org.address}</p>
                      )}
                      {org.city && org.state && (
                        <p><span className="font-semibold">Location:</span> {org.city}, {org.state}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSelectOrganization(org._id)}
                    disabled={linking || selectedOrgId === org._id}
                    className="ml-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-lg font-semibold transition-colors"
                  >
                    {selectedOrgId === org._id && linking ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Help Text */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-bold text-blue-900 mb-2">How it works</h3>
          <ol className="text-blue-800 space-y-2 text-sm list-decimal list-inside">
            <li>Search for organizations by GSTIN or name</li>
            <li>Click "Connect" on the organization you want to work with</li>
            <li>Once connected, you can submit invoices to that organization</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
