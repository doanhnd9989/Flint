import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ShieldAlert } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

/**
 * `/reset-password?token=…` — set a new password from the emailed link. The
 * token is checked before the form renders so an expired link fails up front
 * instead of after the user has typed a password twice.
 */
export function ResetPassword() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const accent = useAuth((s) => s.workspace.accentColor) || '#5e6ad2'

  // A link with no token at all is dead on arrival — decide that up front
  // rather than from inside the effect.
  const [checking, setChecking] = useState(!!token)
  const [account, setAccount] = useState<string | null>(null)
  const [dead, setDead] = useState<string | null>(token ? null : 'Link thiếu mã xác thực.')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api<{ valid: boolean; email: string }>(`/auth/reset-password/${token}`, { auth: false })
      .then((d) => setAccount(d.email))
      .catch((e) => setDead(e instanceof Error ? e.message : 'Link không dùng được'))
      .finally(() => setChecking(false))
  }, [token])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password !== confirm) return setError('Hai ô mật khẩu chưa khớp')
    if (password.length < 6) return setError('Mật khẩu tối thiểu 6 ký tự')
    setLoading(true)
    setError(null)
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, password }, auth: false })
      // Deliberately not auto-signing-in: the user proves the new password works.
      navigate('/login', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đặt lại không thành công')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <AuthShell title="Đặt lại mật khẩu" subtitle="Đang kiểm tra link…">
        <div className="mt-8 flex justify-center text-muted">
          <Loader2 className="animate-spin" />
        </div>
      </AuthShell>
    )
  }

  if (dead) {
    return (
      <AuthShell
        title="Link không dùng được"
        subtitle={dead}
        footer={
          <Link to="/forgot-password" className="text-muted hover:text-fg">
            Xin link mới
          </Link>
        }
      >
        <div className="mt-6 flex justify-center text-amber-500">
          <ShieldAlert size={32} />
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Đặt mật khẩu mới"
      subtitle={account ? `Cho tài khoản ${account}` : 'Nhập mật khẩu mới của bạn.'}
      footer={
        <Link to="/login" className="text-muted hover:text-fg">
          Quay lại đăng nhập
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="password">
            Mật khẩu mới
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="confirm">
            Nhập lại
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>

        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Đang lưu…' : 'Đặt mật khẩu mới'}
        </button>
      </form>
    </AuthShell>
  )
}
