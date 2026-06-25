import type { LucideIcon } from 'lucide-react'
import { GitBranch, Mail, MessageSquare, PenTool } from 'lucide-react'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Provider = {
  id: string
  name: string
  icon: LucideIcon
  color: string
  handle: string
  defaultConnected: boolean
}

export function ConnectedAccountsSettings() {
  const featureSettings = useStore((s) => s.featureSettings)
  const setFeatureSetting = useStore((s) => s.setFeatureSetting)
  const users = useStore((s) => s.users)

  const me = users.find((u) => u.isMe)
  const myEmail = me?.email ?? 'you@example.com'

  const providers: Provider[] = [
    { id: 'github', name: 'GitHub', icon: GitBranch, color: '#181717', handle: '@you', defaultConnected: true },
    { id: 'google', name: 'Google', icon: Mail, color: '#EA4335', handle: myEmail, defaultConnected: true },
    { id: 'slack', name: 'Slack', icon: MessageSquare, color: '#4A154B', handle: 'Acme workspace', defaultConnected: false },
    { id: 'figma', name: 'Figma', icon: PenTool, color: '#F24E1E', handle: 'you@figma', defaultConnected: false },
  ]

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">Connected accounts</h1>
      <p className="mt-1 text-[13px] text-muted">Link third-party accounts to sign in and sync your activity.</p>

      <div className="mt-7 space-y-9">
        <div className="divide-y divide-border rounded-xl border border-border">
          {providers.map((p) => {
            const connected = featureSettings[`account.${p.id}`] ?? p.defaultConnected
            const Icon = p.icon
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-bg-secondary">
                    <Icon size={15} color={p.color} />
                  </div>
                  <div className="leading-tight">
                    <div className="text-[13px] font-medium text-fg">{p.name}</div>
                    {connected && <div className="text-[12px] text-muted">{p.handle}</div>}
                  </div>
                </div>
                {connected ? (
                  <button
                    type="button"
                    onClick={() => setFeatureSetting(`account.${p.id}`, false)}
                    className="text-[13px] text-red-500 hover:underline"
                  >
                    Disconnect
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFeatureSetting(`account.${p.id}`, true)}
                    className={cn(
                      'rounded-md border border-border bg-bg-elevated px-2.5 py-1.5 text-[13px] font-medium text-fg hover:bg-bg-hover',
                    )}
                  >
                    Connect
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
