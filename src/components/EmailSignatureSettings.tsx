import { Mail } from 'lucide-react'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { toast } from '@/lib/toast'

// ── Settings → Email signature (mirrors Linear's outgoing-email signature) ──
//
// A short block of text appended to the email notifications Flint sends on your
// behalf (mentions, assignments, replies). Stored on the User as
// `emailSignature`; cleared back to undefined when the textarea is emptied.

export function EmailSignatureSettings() {
  const currentUserId = useStore((s) => s.currentUserId)
  const user = useStore((s) => s.users.find((u) => u.id === s.currentUserId))
  const updateUser = useStore((s) => s.updateUser)

  const saved = user?.emailSignature ?? ''
  const [value, setValue] = useState(saved)

  // The persisted signature is the source of truth — "dirty" means the textarea
  // diverges from what's stored (compared on trimmed value, like Save writes it).
  const next = value.trim()
  const dirty = next !== saved.trim()

  const save = () => {
    if (!dirty) return
    // Runtime updateUser spreads any User patch; the typed signature predates
    // `emailSignature`, so narrow the cast to just this field.
    updateUser(currentUserId, {
      emailSignature: next || undefined,
    } as Parameters<typeof updateUser>[1])
    setValue(next)
    toast('Email signature saved')
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Email signature
      </h1>
      <p className="mt-1 text-[13px] text-muted">
        Appended to the bottom of email notifications Flint sends on your behalf.
      </p>

      <div className="mt-7 space-y-9">
        {/* ── Signature ── */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Mail size={13} className="text-muted" />
            Signature
          </h2>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder={'e.g.\nJane Doe\nProduct, Flint'}
            className="min-h-[120px] w-full resize-y rounded-xl border border-border bg-bg p-3 text-[13px] leading-relaxed text-fg outline-none focus:border-accent placeholder:text-faint"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[12px] text-muted">
              Plain text only. Leave empty to send notifications without a
              signature.
            </span>
            <button
              type="button"
              onClick={save}
              disabled={!dirty}
              className="rounded-md bg-accent px-3 py-1.5 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </section>

        {/* ── Live preview ── */}
        <section>
          <h2 className="mb-2 text-[13px] font-semibold text-fg">Preview</h2>
          <div className="overflow-hidden rounded-lg border border-border bg-bg-secondary p-4 text-[13px] leading-relaxed">
            <p className="text-muted">
              You were mentioned in <span className="text-fg">ENG-128</span> by
              a teammate.
            </p>
            {next ? (
              <div className="mt-4 whitespace-pre-wrap border-t border-border pt-3 text-muted">
                {next}
              </div>
            ) : (
              <div className="mt-4 border-t border-border pt-3 text-faint">
                No signature — notifications end after the message.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
