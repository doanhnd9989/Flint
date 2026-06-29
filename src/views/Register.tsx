import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/** Public self-service sign-up at `/register`. Creates a member account and
 *  signs in immediately on success. */
export function Register() {
  const navigate = useNavigate()
  const register = useAuth((s) => s.register)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const workspace = useAuth((s) => s.workspace)
  const accent = workspace.accentColor || '#5e6ad2'
  const name = workspace.name || 'Flint Task'

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await register(fullName, email, password)
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
          <h1 className="text-center text-lg font-semibold">Create your account</h1>
          <p className="mt-1 text-center text-sm text-muted">Get started in seconds — it's free.</p>

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="name">
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                autoFocus
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
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
                autoComplete="new-password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
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
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-faint">
          Already have an account?{' '}
          <Link to="/login" className="text-muted hover:text-fg">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
