import { useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth'

/**
 * The code-entry step shared by the sign-in and sign-up screens. The parent
 * owns the surrounding {@link AuthShell}; this renders only the form body once a
 * code has been emailed to `email`. `name` is threaded through so a brand-new
 * account gets the right display name at verify time.
 */
export function OtpVerify({
  email,
  name,
  showRemember = true,
  onVerified,
  onBack,
}: {
  email: string
  name?: string
  showRemember?: boolean
  onVerified: () => void
  onBack: () => void
}) {
  const verifyOtp = useAuth((s) => s.verifyOtp)
  const requestOtp = useAuth((s) => s.requestOtp)
  const loading = useAuth((s) => s.loading)
  const error = useAuth((s) => s.error)
  const accent = useAuth((s) => s.workspace.accentColor) || '#5e6ad2'

  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [resent, setResent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const ok = await verifyOtp(email, code, showRemember && remember, name)
    if (ok) onVerified()
  }

  async function resend() {
    setResent(false)
    const ok = await requestOtp(email, name)
    if (ok) setResent(true)
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-3">
      <p className="text-center text-sm text-muted">
        Đã gửi mã 6 số tới <span className="text-fg">{email}</span>.
      </p>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted" htmlFor="code">
          Mã xác thực
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          required
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-center text-lg tracking-[0.5em] outline-none focus:border-accent"
        />
      </div>

      {showRemember && (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-accent"
            style={{ accentColor: accent }}
          />
          Ghi nhớ đăng nhập trong 90 ngày
        </label>
      )}

      {error && <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}

      <button
        type="submit"
        disabled={loading || code.length < 6}
        className="flex w-full items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
        style={{ background: accent }}
      >
        {loading && <Loader2 size={15} className="animate-spin" />}
        {loading ? 'Đang kiểm tra…' : 'Xác nhận'}
      </button>

      <div className="flex items-center justify-between pt-1 text-xs text-muted">
        <button type="button" onClick={onBack} className="hover:text-fg">
          Đổi email
        </button>
        <button type="button" onClick={resend} className="hover:text-fg">
          {resent ? 'Đã gửi lại mã' : 'Gửi lại mã'}
        </button>
      </div>
    </form>
  )
}
