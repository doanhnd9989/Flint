import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { OtpVerify } from '@/components/OtpVerify'
import { useAuth } from '@/lib/auth'

/**
 * Sign-in at `/login`. The default path is passwordless: enter an email, get a
 * one-time code, done. A password form is still reachable for accounts that
 * have one (the system admin, older members).
 */
export function Login() {
  const navigate = useNavigate()
  const login = useAuth((s) => s.login)
  const requestOtp = useAuth((s) => s.requestOtp)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const accent = useAuth((s) => s.workspace.accentColor) || '#5e6ad2'

  // 'email' asks for the address, 'code' enters the OTP, 'password' is the
  // classic email+password fallback.
  const [stage, setStage] = useState<'email' | 'code' | 'password'>('email')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const ok = await requestOtp(email)
    if (ok) setStage('code')
  }

  async function signInWithPassword(e: FormEvent) {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/', { replace: true })
  }

  if (stage === 'code') {
    return (
      <AuthShell
        title="Nhập mã đăng nhập"
        subtitle="Kiểm tra hộp thư để lấy mã gồm 6 chữ số."
        footer={
          <Link to="/register" className="text-muted hover:text-fg">
            Chưa có tài khoản? Tạo mới
          </Link>
        }
      >
        <OtpVerify
          email={email}
          onVerified={() => navigate('/', { replace: true })}
          onBack={() => setStage('email')}
        />
      </AuthShell>
    )
  }

  if (stage === 'password') {
    return (
      <AuthShell
        title="Đăng nhập bằng mật khẩu"
        subtitle="Nhập email và mật khẩu của bạn."
        footer={
          <button type="button" onClick={() => setStage('email')} className="text-muted hover:text-fg">
            Dùng mã qua email
          </button>
        }
      >
        <form onSubmit={signInWithPassword} className="mt-6 space-y-3">
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
            <div className="mb-1 flex items-baseline justify-between">
              <label className="block text-xs font-medium text-muted" htmlFor="password">
                Mật khẩu
              </label>
              <Link to="/forgot-password" className="text-xs text-muted hover:text-fg">
                Quên mật khẩu?
              </Link>
            </div>
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
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Đăng nhập"
      subtitle="Nhập email, chúng tôi gửi mã đăng nhập cho bạn."
      footer={
        <>
          Chưa có tài khoản?{' '}
          <Link to="/register" className="text-muted hover:text-fg">
            Tạo mới
          </Link>
        </>
      }
    >
      <form onSubmit={sendCode} className="mt-6 space-y-3">
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
          {loading ? 'Đang gửi mã…' : 'Gửi mã đăng nhập'}
        </button>

        <button
          type="button"
          onClick={() => setStage('password')}
          className="w-full pt-1 text-center text-xs text-muted hover:text-fg"
        >
          Đăng nhập bằng mật khẩu
        </button>
      </form>
    </AuthShell>
  )
}
