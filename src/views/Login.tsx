import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/** Sign-in screen at `/login`. On success, routes into the app. */
export function Login() {
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/', { replace: true })
  }

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
          <h1 className="text-center text-lg font-semibold">Sign in to your workspace</h1>
          <p className="mt-1 text-center text-sm text-muted">Welcome back. Enter your details.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@workspace.dev"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
              style={{ background: accent }}
            >
              {loading && <Loader2 size={15} className="animate-spin" />}
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          Don't have an account?{' '}
          <Link to="/register" className="text-muted hover:text-fg">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
