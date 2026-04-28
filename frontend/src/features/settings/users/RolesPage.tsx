import { useState } from 'react'
import { Shield, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthContext'

export function RolesPage() {
  const { hasPermission } = useAuth()
  
  // This is a placeholder for actual roles/permissions UI. 
  // In a full implementation, this would fetch roles and let admins assign permissions.
  
  return (
    <div className="animate-fade-in space-y-6">
      <div className="section-header">
        <div>
          <h1 className="section-title">Roles & Permissions</h1>
          <p className="section-subtitle">Manage system roles and their specific access permissions.</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-[#1E7A3A]/10 text-[#1E7A3A] rounded-xl">
              <Shield className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">Standard Roles</h2>
          </div>
          <p className="text-[var(--text-muted)] mb-6 text-sm">
            System roles are pre-configured based on standard farm operations.
          </p>
          
          <div className="space-y-3">
            {['admin', 'farm_manager', 'feed_manager', 'sales_manager', 'accountant'].map(role => (
              <div key={role} className="flex justify-between items-center p-3 border border-[var(--border-subtle)] rounded-xl bg-[var(--surface-soft)]">
                <span className="font-medium capitalize">{role.replace('_', ' ')}</span>
                <span className="badge badge-brand">System</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-info/10 text-info rounded-xl">
              <Users className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-semibold">Permission Matrix</h2>
          </div>
          <p className="text-[var(--text-muted)] mb-6 text-sm">
            Custom role configuration is available for Enterprise plans.
          </p>
          
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-[var(--border-subtle)] rounded-xl bg-[var(--surface-soft)] text-center">
            <Shield className="h-10 w-10 text-[var(--text-muted)] mb-3 opacity-50" />
            <h3 className="font-semibold text-[var(--text-strong)]">Custom Roles Locked</h3>
            <p className="text-sm text-[var(--text-muted)] max-w-[200px] mt-1">
              Contact Developer Admin to enable custom roles for your tenant.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
