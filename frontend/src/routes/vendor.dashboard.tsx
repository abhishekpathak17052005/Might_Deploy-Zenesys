import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { requireRole } from '@/lib/route-guards'
const API_BASE = import.meta.env['VITE_API_URL'] || 'http://localhost:5000/api'
import { Building2, FileText, LogOut, Search, Upload } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Card, CardHead, StatCard } from '@/components/kit'

export const Route = createFileRoute('/vendor/dashboard')({
  beforeLoad: () => requireRole(['VENDOR']),
  component: VendorDashboard,
})

interface VendorProfile {
  _id: string
  name: string
  email: string
  gstin: string
  organizationIds: Array<string | { _id?: string; name?: string }>
  status: string
}

export function VendorDashboard() {
  const navigate = useNavigate()
  const [vendor, setVendor] = useState<VendorProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [removingOrganizationId, setRemovingOrganizationId] = useState<string | null>(null)
  const [organizationMessage, setOrganizationMessage] = useState<string | null>(null)

  const removeOrganization = async (orgId: string, organizationName: string) => {
    if (!window.confirm(`Remove your connection to ${organizationName}? Previously submitted invoices will remain available.`)) return
    setRemovingOrganizationId(orgId)
    setOrganizationMessage(null)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_BASE}/vendor/organizations/${encodeURIComponent(orgId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token || ''}` },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error?.message || 'Could not remove this organization connection.')
      setVendor((current) => current ? {
        ...current,
        organizationIds: current.organizationIds.filter((item) => (typeof item === 'string' ? item : item._id) !== orgId),
      } : current)
      setOrganizationMessage(`Connection to ${organizationName} removed. Previously submitted invoices are unchanged.`)
    } catch (err) {
      setOrganizationMessage(err instanceof Error ? err.message : 'Could not remove this organization connection.')
    } finally {
      setRemovingOrganizationId(null)
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token')
        if (token) {
          const res = await fetch(`${API_BASE}/vendor/profile`, {
            headers: { Authorization: `Bearer ${token}` }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.data?.vendor) {
              setVendor(data.data.vendor)
              setLoading(false)
              return
            }
          }
        }
      } catch (err) {
        console.error('Failed to load vendor profile', err)
      }
      setVendor({
        _id: 'demo-vendor',
        name: 'Demo Vendor',
        email: 'vendor@demo.com',
        gstin: '29ABCDE1234F1Z5',
        organizationIds: [],
        status: 'ACTIVE',
      })
      setLoading(false)
    }
    fetchProfile()
  }, [])

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

  return (
    <AppShell
      role="Vendor"
      title={`Welcome, ${vendor?.name ?? 'Vendor'}`}
      subtitle="Vendor workspace · Invoice submissions and organization connections"
      actions={
        <Link
          to="/vendor/invoice/new"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
        >
          <Upload className="size-4" />
          Submit Invoice
        </Link>
      }
    >
      {loading ? (
        <Card>
          <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground">
            <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Loading vendor profile...
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr_1fr]">
            <StatCard
              icon={<Building2 className="size-4.5" />}
              label="Connected Organizations"
              value={String(vendor?.organizationIds.length ?? 0)}
              hint="Active relationships"
              delta="0%"
              tone="deep"
            />
            <StatCard
              icon={<FileText className="size-4.5" />}
              label="Invoices Submitted"
              value="0"
              hint="This cycle"
              delta="0%"
            />
            <StatCard
              icon={<Search className="size-4.5" />}
              label="Vendor Status"
              value={vendor?.status ?? "ACTIVE"}
              hint="Account standing"
              delta="Ready"
            />
          </div>

          <div className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_1fr]">
            <Card>
              <CardHead
                icon={<Building2 className="size-4.5" />}
                title="Vendor Information"
                sub="Your profile details"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <InfoItem label="Vendor Name" value={vendor?.name ?? "Demo Vendor"} />
                <InfoItem label="Email" value={vendor?.email ?? "vendor@demo.com"} />
                <InfoItem label="GSTIN" value={vendor?.gstin || "Not set"} />
                <InfoItem label="Status" value={vendor?.status ?? "ACTIVE"} />
              </div>
            </Card>

            <Card>
              <CardHead
                icon={<Search className="size-4.5" />}
                title="Connected Organizations"
                sub="Organizations you can invoice"
              />
              {organizationMessage && <p role="status" className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{organizationMessage}</p>}
              {vendor?.organizationIds.length ? (
                <div className="flex flex-col gap-2">
                  {vendor.organizationIds.map((orgId, index) => {
                    const organizationLabel =
                      typeof orgId === 'string' ? orgId : orgId.name || orgId._id || 'Organization'
                    return (
                    <div key={organizationLabel} className="flex items-center justify-between gap-3 rounded-xl bg-muted p-3">
                      <div>
                        <p className="text-sm font-bold">Organization {index + 1}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{organizationLabel}</p>
                      </div>
                      {typeof orgId !== 'string' && orgId._id && <button
                        type="button"
                        onClick={() => removeOrganization(orgId._id!, organizationLabel)}
                        disabled={removingOrganizationId === orgId._id}
                        className="shrink-0 rounded-full border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {removingOrganizationId === orgId._id ? 'Removing…' : 'Remove connection'}
                      </button>}
                    </div>
                    )
                  })}
                </div>
              ) : (
                <div className="py-4">
                  <p className="text-sm text-muted-foreground">No organizations connected yet.</p>
                  <Link
                    to="/vendor/org-search"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground"
                  >
                    <Search className="size-4" />
                    Search Organizations
                  </Link>
                </div>
              )}
            </Card>
          </div>

          <Card className="mt-5">
            <CardHead icon={<FileText className="size-4.5" />} title="Quick Actions" sub="Common vendor workflows" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Link to="/vendor/invoices" className="inline-flex items-center justify-center gap-2 rounded-xl bg-muted px-4 py-3 text-sm font-bold hover:bg-primary-soft">
                <FileText className="size-4" /> View Invoices
              </Link>
              <Link to="/vendor/invoice/new" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90">
                <Upload className="size-4" /> Submit Invoice
              </Link>
              <button
                onClick={() => {
                  localStorage.removeItem('token')
                  navigate({ to: '/' })
                }}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <LogOut className="size-4" /> Exit Workspace
              </button>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  )
}
