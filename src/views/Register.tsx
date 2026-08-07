import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { AuthShell } from '@/components/AuthShell'
import { OtpVerify } from '@/components/OtpVerify'
import { useAuth } from '@/lib/auth'

/**
 * Public self-service sign-up at `/register`. Passwordless: enter a name and
 * email, confirm the one-time code, and the account is created and signed in.
 */
export function Register() {
  const navigate = useNavigate()
  const requestOtp = useAuth((s) => s.requestOtp)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const accent = useAuth((s) => s.workspace.accentColor) || '#5e6ad2'

  const [stage, setStage] = useState<'form' | 'code'>('form')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')

  async function sendCode(e: FormEvent) {
    e.preventDefault()
    const ok = await requestOtp(email, fullName)
    if (ok) setStage('code')
  }

  if (stage === 'code') {
    return (
      <AuthShell
        title="Xác nhận email"
        subtitle="Nhập mã 6 số chúng tôi vừa gửi để hoàn tất."
        footer={
          <Link to="/login" className="text-muted hover:text-fg">
            Đã có tài khoản? Đăng nhập
          </Link>
        }
      >
        <OtpVerify
          email={email}
          name={fullName}
          onVerified={() => navigate('/', { replace: true })}
          onBack={() => setStage('form')}
        />
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Tạo tài khoản"
      subtitle="Chỉ cần email — không cần mật khẩu."
      footer={
        <>
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-muted hover:text-fg">
            Đăng nhập
          </Link>
        </>
      }
    >
      <form onSubmit={sendCode} className="mt-6 space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted" htmlFor="name">
            Họ tên
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            autoFocus
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Nguyễn Văn A"
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

        {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Đang gửi mã…' : 'Gửi mã xác nhận'}
        </button>
      </form>
    </AuthShell>
  )
}
