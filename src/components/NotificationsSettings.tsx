import { useState } from 'react'
import { ChevronRight, Mail, MessageSquare, Monitor, Smartphone } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useStoreShallow } from '@/lib/store'
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_EVENT_GROUPS,
} from '@/lib/constants'
import { cn } from '@/lib/utils'
import type {
  ChannelSettings,
  NotificationChannel,
  NotificationSettings,
} from '@/lib/types'

// ── Settings → Notifications (mirrors Linear's account Notifications page) ────

const CHANNEL_ICON: Record<NotificationChannel, LucideIcon> = {
  desktop: Monitor,
  mobile: Smartphone,
  email: Mail,
  slack: MessageSquare,
}

const EVENT_COUNT = NOTIFICATION_EVENT_GROUPS.reduce(
  (n, g) => n + g.events.length,
  0,
)

/** The grey status line under a channel name on the overview, e.g. Linear's
 *  "Disabled" / "Enabled for all notifications". */
function channelStatus(ch: ChannelSettings): { label: string; on: boolean } {
  if (!ch.enabled) return { label: 'Disabled', on: false }
  const onCount = Object.values(ch.events).filter(Boolean).length
  if (onCount === EVENT_COUNT)
    return { label: 'Enabled for all notifications', on: true }
  return { label: `Enabled for ${onCount} of ${EVENT_COUNT} notifications`, on: true }
}

// ── primitives ───────────────────────────────────────────────────────────────
function Switch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-[18px] w-[30px] shrink-0 rounded-full transition-colors',
        checked ? 'bg-accent' : 'bg-bg-tertiary',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] h-3 w-3 rounded-full bg-white shadow transition-transform',
          checked ? 'translate-x-[15px]' : 'translate-x-[3px]',
        )}
      />
    </button>
  )
}

/** A label + helper-text row with a trailing switch — Linear's setting row. */
function ToggleRow({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-6 py-3',
        disabled && 'opacity-50',
      )}
    >
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-fg">{label}</div>
        <div className="text-[12px] text-muted">{hint}</div>
      </div>
      <Switch checked={checked} onChange={(v) => !disabled && onChange(v)} />
    </div>
  )
}

function GroupHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 mb-1 text-[12px] font-medium text-muted">{children}</div>
  )
}

// ── channel detail page (Desktop / Mobile / Email / Slack) ────────────────────
function ChannelDetail({
  channel,
  settings,
  onBack,
}: {
  channel: NotificationChannel
  settings: NotificationSettings
  onBack: () => void
}) {
  const {
    setNotificationChannelEnabled,
    setNotificationEvent,
    updateNotificationSettings,
    me,
  } = useStoreShallow((s) => ({
    setNotificationChannelEnabled: s.setNotificationChannelEnabled,
    setNotificationEvent: s.setNotificationEvent,
    updateNotificationSettings: s.updateNotificationSettings,
    me: s.users.find((u) => u.id === s.currentUserId),
  }))
  const meta = NOTIFICATION_CHANNELS.find((c) => c.id === channel)!
  const ch = settings.channels[channel]
  const on = ch.enabled

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <button
        onClick={onBack}
        className="text-[13px] text-muted hover:text-fg"
      >
        Notifications
      </button>
      <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-fg">
        {meta.label}
      </h1>

      {/* Master enable */}
      <div className="mt-7 border-b border-border">
        <ToggleRow
          label={`Enable ${meta.label.toLowerCase()} notifications`}
          hint={
            channel === 'email' && me
              ? `${meta.label} notifications to ${me.email}`
              : `Receive ${meta.label.toLowerCase()} notifications for workspace activity`
          }
          checked={on}
          onChange={(v) => setNotificationChannelEnabled(channel, v)}
        />
      </div>

      {/* Email-only digest options, matching Linear's Email page */}
      {channel === 'email' && (
        <>
          <GroupHeader>Notification format</GroupHeader>
          <div className="border-b border-border">
            <ToggleRow
              label="Digest"
              hint="Choose whether to group email notifications"
              checked={settings.emailDigest}
              onChange={(v) => updateNotificationSettings({ emailDigest: v })}
              disabled={!on}
            />
          </div>
          <GroupHeader>Email digest settings</GroupHeader>
          <div className="border-b border-border">
            <ToggleRow
              label="Delay low priority emails outside of work hours until next work day"
              hint="Batch non-urgent emails so they arrive during your work hours"
              checked={settings.emailDelayLowPriority}
              onChange={(v) =>
                updateNotificationSettings({ emailDelayLowPriority: v })
              }
              disabled={!on}
            />
            <div className="border-t border-border" />
            <ToggleRow
              label="Immediately notify if an issue assigned to you is marked urgent or breaches SLA"
              hint="Override the digest delay for urgent assigned issues"
              checked={settings.emailUrgentImmediate}
              onChange={(v) =>
                updateNotificationSettings({ emailUrgentImmediate: v })
              }
              disabled={!on}
            />
          </div>
        </>
      )}

      {/* Per-event matrix */}
      {NOTIFICATION_EVENT_GROUPS.map((group) => (
        <div key={group.header}>
          <GroupHeader>{group.header}</GroupHeader>
          <div className="border-b border-border">
            {group.events.map((ev, i) => (
              <div key={ev.id}>
                {i > 0 && <div className="border-t border-border" />}
                <ToggleRow
                  label={ev.label}
                  hint={ev.hint}
                  checked={ch.events[ev.id]}
                  onChange={(v) => setNotificationEvent(channel, ev.id, v)}
                  disabled={!on}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── overview (channels + "Updates from Linear") ───────────────────────────────
function Overview({
  settings,
  onOpenChannel,
}: {
  settings: NotificationSettings
  onOpenChannel: (c: NotificationChannel) => void
}) {
  const { updateNotificationSettings } = useStoreShallow((s) => ({
    updateNotificationSettings: s.updateNotificationSettings,
  }))

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-[22px] font-semibold tracking-tight text-fg">
        Notifications
      </h1>

      {/* Notification channels */}
      <section className="mt-7">
        <h2 className="text-[13px] font-semibold text-fg">Notification channels</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Choose how to be notified for workspace activity. Notifications will
          always go to your Linear inbox.
        </p>
        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          {NOTIFICATION_CHANNELS.map((c, i) => {
            const Icon = CHANNEL_ICON[c.id]
            const status = channelStatus(settings.channels[c.id])
            return (
              <button
                key={c.id}
                onClick={() => onOpenChannel(c.id)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-bg-hover',
                  i > 0 && 'border-t border-border',
                )}
              >
                <Icon size={18} className="shrink-0 text-muted" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-fg">{c.label}</div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px] text-muted">
                    <span
                      className="h-[7px] w-[7px] rounded-full"
                      style={{
                        background: status.on
                          ? 'var(--c-green)'
                          : 'var(--c-red)',
                      }}
                    />
                    {status.label}
                  </div>
                </div>
                <ChevronRight size={16} className="shrink-0 text-faint" />
              </button>
            )
          })}
        </div>
      </section>

      {/* Updates from Linear */}
      <section className="mt-10">
        <h2 className="text-[13px] font-semibold text-fg">Updates from Linear</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Subscribe to product announcements and important changes from the
          Linear team
        </p>

        <GroupHeader>Changelog</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Show updates in sidebar"
            hint="Highlight new features and improvements in the app sidebar"
            checked={settings.showUpdatesInSidebar}
            onChange={(v) => updateNotificationSettings({ showUpdatesInSidebar: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Changelog newsletter"
            hint="Receive an email twice a month highlighting new features and improvements"
            checked={settings.changelogNewsletter}
            onChange={(v) => updateNotificationSettings({ changelogNewsletter: v })}
          />
        </div>

        <GroupHeader>Marketing</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Marketing and onboarding"
            hint="Occasional updates to help you get the most of out of Linear"
            checked={settings.marketingOnboarding}
            onChange={(v) => updateNotificationSettings({ marketingOnboarding: v })}
          />
        </div>

        <GroupHeader>Other updates</GroupHeader>
        <div className="border-b border-border">
          <ToggleRow
            label="Invite accepted"
            hint="Email when invitees accept an invite"
            checked={settings.inviteAccepted}
            onChange={(v) => updateNotificationSettings({ inviteAccepted: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Privacy and legal updates"
            hint="Email when privacy policies or terms of service change"
            checked={settings.privacyLegal}
            onChange={(v) => updateNotificationSettings({ privacyLegal: v })}
          />
          <div className="border-t border-border" />
          <ToggleRow
            label="Data processing agreement (DPA)"
            hint="Email when our DPA changes"
            checked={settings.dpa}
            onChange={(v) => updateNotificationSettings({ dpa: v })}
          />
        </div>
      </section>
    </div>
  )
}

export function NotificationsSettings() {
  const settings = useStoreShallow((s) => s.notificationSettings)
  const [channel, setChannel] = useState<NotificationChannel | null>(null)

  return channel ? (
    <ChannelDetail
      channel={channel}
      settings={settings}
      onBack={() => setChannel(null)}
    />
  ) : (
    <Overview settings={settings} onOpenChannel={setChannel} />
  )
}
