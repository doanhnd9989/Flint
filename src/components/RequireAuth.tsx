import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '@/lib/auth'

/** Gates the app shell: unauthenticated visitors go to the landing page. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user)
  const location = useLocation()
  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />
  }
  return <>{children}</>
}

/** Admin-only gate (use inside RequireAuth). Non-admins are bounced home. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const role = useAuth((s) => s.user?.role)
  if (role !== 'admin') return <Navigate to="/" replace />
  return <>{children}</>
}
