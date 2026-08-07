import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Zap } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/** The centred card the signed-out screens share (login, register, reset). */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer?: ReactNode
}) {
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint'

  return (
    <div
      className="flex h-screen w-screen items-center justify-center bg-bg-secondary px-6 text-fg"
      style={{ ['--accent' as string]: accent }}
    >
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2 font-semibold">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-md text-white"
            style={{ background: accent }}
          >
            <Zap size={18} />
          </span>
          <span className="text-lg">{name}</span>
        </Link>

        <div className="rounded-xl border border-border bg-bg p-6 shadow-sm">
          <h1 className="text-center text-lg font-semibold">{title}</h1>
          <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>
          {children}
        </div>

        {footer && <p className="mt-4 text-center text-xs text-faint">{footer}</p>}
      </div>
    </div>
  )
}
