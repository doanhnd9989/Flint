import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MailCheck } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'

/**
 * `/forgot-password` — ask for the reset link. The server answers the same way
 * whether or not the address has an account, so this screen never reveals
 * which emails are registered.
 */
export function ForgotPassword() {
  const accent = useAuth((s) => s.workspace.accentColor) || '#5e6ad2'
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email }, auth: false })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được, thử lại sau')
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Kiểm tra hộp thư"
        subtitle="Nếu địa chỉ đó có tài khoản, link đặt lại mật khẩu đã được gửi đi."
        footer={
          <Link to="/login" className="text-muted hover:text-fg">
            Quay lại đăng nhập
          </Link>
        }
      >
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <MailCheck size={32} style={{ color: accent }} />
          <p className="text-sm text-muted">
            Đã gửi tới <span className="text-fg">{email}</span>. Link sống 60 phút và chỉ dùng được
            một lần.
          </p>
          <p className="text-xs text-faint">Không thấy thư thì ngó cả mục spam.</p>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Quên mật khẩu"
      subtitle="Nhập email của bạn, chúng tôi gửi link đặt lại."
      footer={
        <Link to="/login" className="text-muted hover:text-fg">
          Quay lại đăng nhập
        </Link>
      }
    >
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

        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Đang gửi…' : 'Gửi link đặt lại'}
        </button>
      </form>
    </AuthShell>
  )
}
