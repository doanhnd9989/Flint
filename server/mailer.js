// Outgoing mail (SMTP). Settings live in the `mail_config` row so an admin can
// fill them in the console; env vars are the fallback for file-configured
// deployments. When nothing is configured the message is written to the server
// log instead of being sent — that way a fresh (or locked-out) deployment can
// still complete a password reset by reading the link out of the log.
import nodemailer from 'nodemailer'
import { db } from './db.js'

const row = () => db.prepare('SELECT * FROM mail_config WHERE id = 1').get()

const bool = (v, fallback = false) =>
  v === undefined || v === null || v === '' ? fallback : !(v === 0 || v === '0' || v === 'false' || v === false)

/** Effective mail settings: DB row first, env second, defaults last. */
export function getMailConfig() {
  const r = row() || {}
  const host = r.host || process.env.SMTP_HOST || ''
  const port = Number(r.port || process.env.SMTP_PORT || 587)
  return {
    host,
    port,
    // Port 465 is implicit TLS; everything else upgrades with STARTTLS.
    secure: r.host ? bool(r.secure) : bool(process.env.SMTP_SECURE, port === 465),
    username: r.username || process.env.SMTP_USER || '',
    password: r.password || process.env.SMTP_PASS || '',
    fromEmail: r.from_email || process.env.MAIL_FROM || 'no-reply@flinttask.com',
    fromName: r.from_name || process.env.MAIL_FROM_NAME || 'Flint Task',
    appUrl: (r.app_url || process.env.APP_URL || 'https://flinttask.com').replace(/\/+$/, ''),
    enabled: r.host ? bool(r.enabled) : !!process.env.SMTP_HOST,
    updatedAt: r.updated_at || null,
  }
}

/** Config as the admin console shows it — never leaks the SMTP password. */
export function publicMailConfig() {
  const c = getMailConfig()
  return { ...c, password: undefined, hasPassword: !!c.password, configured: isConfigured(c) }
}

export function isConfigured(c = getMailConfig()) {
  return !!(c.enabled && c.host)
}

export function saveMailConfig(patch) {
  const cur = row()
  if (!cur) db.prepare('INSERT INTO mail_config (id) VALUES (1)').run()
  const cols = {
    host: 'host', port: 'port', secure: 'secure', username: 'username',
    password: 'password', fromEmail: 'from_email', fromName: 'from_name',
    appUrl: 'app_url', enabled: 'enabled',
  }
  for (const [key, col] of Object.entries(cols)) {
    if (patch[key] === undefined) continue
    // An empty password means "keep the stored one" — the UI never round-trips it.
    if (key === 'password' && patch.password === '') continue
    const v = key === 'secure' || key === 'enabled' ? (patch[key] ? 1 : 0)
      : key === 'port' ? Number(patch[key]) || 587
      : String(patch[key])
    db.prepare(`UPDATE mail_config SET ${col} = ? WHERE id = 1`).run(v)
  }
  db.prepare('UPDATE mail_config SET updated_at = ? WHERE id = 1').run(new Date().toISOString())
  return publicMailConfig()
}

function transport(c) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    ...(c.username ? { auth: { user: c.username, pass: c.password } } : {}),
  })
}

/**
 * Send a message. Returns {delivered, logged, error?} and never throws — a mail
 * outage must not turn into a 500 on the endpoint that triggered it.
 */
export async function sendMail({ to, subject, text, html }) {
  const c = getMailConfig()
  if (!isConfigured(c)) {
    console.log(
      `\n[mail] SMTP chưa cấu hình — không gửi đi, in ra log:\n`
      + `  to:      ${to}\n  subject: ${subject}\n${text.replace(/^/gm, '  ')}\n`,
    )
    return { delivered: false, logged: true }
  }
  try {
    await transport(c).sendMail({
      from: `"${c.fromName}" <${c.fromEmail}>`,
      to, subject, text, html,
    })
    return { delivered: true, logged: false }
  } catch (err) {
    console.error('[mail] gửi hỏng:', err?.message || err)
    return { delivered: false, logged: false, error: err?.message || 'send failed' }
  }
}

/** Fire the SMTP handshake without sending anything — used by the "Test" button. */
export async function verifyMail() {
  const c = getMailConfig()
  if (!isConfigured(c)) return { ok: false, error: 'SMTP chưa được bật hoặc thiếu host' }
  try {
    await transport(c).verify()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err?.message || 'verify failed' }
  }
}

const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]
))

/**
 * The one-time sign-in code. Wording is neutral so the same message works
 * whether the address is signing in or creating a new account. `code` is the
 * 6-digit value, `minutes` its TTL.
 */
export function otpEmail({ name, code, minutes, workspace = 'Flint Task' }) {
  const spaced = String(code).split('').join(' ')
  const subject = `Mã đăng nhập ${workspace}: ${code}`
  const text = [
    `Chào ${name},`,
    ``,
    `Mã xác thực để đăng nhập ${workspace} của bạn là:`,
    ``,
    `  ${code}`,
    ``,
    `Mã có hiệu lực trong ${minutes} phút và chỉ dùng được một lần.`,
    `Nếu không phải bạn yêu cầu thì bỏ qua email này.`,
  ].join('\n')
  const html = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2023">
  <p style="font-size:15px;margin:0 0 16px">Chào ${esc(name)},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Mã xác thực để đăng nhập <strong>${esc(workspace)}</strong> của bạn là:
  </p>
  <p style="margin:0 0 20px">
    <span style="display:inline-block;background:#f4f5f8;border:1px solid #e6e6e8;border-radius:8px;padding:14px 22px;font-size:28px;font-weight:700;letter-spacing:8px;color:#1f2023">${esc(spaced)}</span>
  </p>
  <p style="font-size:13px;color:#6b6f76;line-height:1.6;margin:0">
    Mã có hiệu lực trong <strong>${minutes} phút</strong> và chỉ dùng được một lần.
  </p>
  <hr style="border:none;border-top:1px solid #e6e6e8;margin:24px 0">
  <p style="font-size:12px;color:#8b8f96;margin:0">
    Nếu không phải bạn yêu cầu thì bỏ qua email này.
  </p>
</div>`.trim()
  return { subject, text, html }
}

/** The password-reset message. `url` is the one-time link, `minutes` its TTL. */
export function resetPasswordEmail({ name, url, minutes, workspace = 'Flint Task' }) {
  const subject = `Đặt lại mật khẩu ${workspace}`
  const text = [
    `Chào ${name},`,
    ``,
    `Có yêu cầu đặt lại mật khẩu cho tài khoản ${workspace} của bạn.`,
    `Mở link dưới đây để đặt mật khẩu mới (hết hạn sau ${minutes} phút):`,
    ``,
    url,
    ``,
    `Nếu không phải bạn yêu cầu thì bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.`,
  ].join('\n')
  const html = `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#1f2023">
  <p style="font-size:15px;margin:0 0 16px">Chào ${esc(name)},</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Có yêu cầu đặt lại mật khẩu cho tài khoản <strong>${esc(workspace)}</strong> của bạn.
    Bấm nút dưới đây để đặt mật khẩu mới — link hết hạn sau <strong>${minutes} phút</strong>.
  </p>
  <p style="margin:0 0 24px">
    <a href="${esc(url)}" style="display:inline-block;background:#5e6ad2;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:500">Đặt lại mật khẩu</a>
  </p>
  <p style="font-size:13px;color:#6b6f76;line-height:1.6;margin:0 0 8px">
    Nút không bấm được thì copy link này vào trình duyệt:<br>
    <span style="word-break:break-all;color:#5e6ad2">${esc(url)}</span>
  </p>
  <hr style="border:none;border-top:1px solid #e6e6e8;margin:24px 0">
  <p style="font-size:12px;color:#8b8f96;margin:0">
    Nếu không phải bạn yêu cầu thì bỏ qua email này — mật khẩu hiện tại vẫn giữ nguyên.
  </p>
</div>`.trim()
  return { subject, text, html }
}
