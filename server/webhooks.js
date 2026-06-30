// Outgoing webhooks (Linear-style). On a workspace change we POST a signed JSON
// payload to every enabled endpoint. Delivery is fire-and-forget so it never
// blocks the API response.
import { createHmac } from 'node:crypto'
import { db } from './db.js'

export function listWebhooks() {
  return db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all()
}

function enabledFor(type) {
  return listWebhooks().filter((w) => {
    if (!w.enabled) return false
    if (!w.events || w.events === 'all') return true
    return w.events.split(',').map((s) => s.trim()).includes(type)
  })
}

/**
 * Deliver an event to matching webhooks. `type` is the resource (issue,
 * project, cycle, comment); `action` is create | update | remove.
 */
export function fireEvent(type, action, data) {
  const hooks = enabledFor(type)
  if (!hooks.length) return
  const payload = JSON.stringify({
    type,
    action,
    data,
    createdAt: new Date().toISOString(),
  })
  for (const w of hooks) {
    const signature = createHmac('sha256', w.secret).update(payload).digest('hex')
    // Node 20 global fetch; never await — don't block the request.
    fetch(w.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flint-Event': `${type}.${action}`,
        'X-Flint-Signature': `sha256=${signature}`,
      },
      body: payload,
    })
      .then((res) => {
        db.prepare('UPDATE webhooks SET last_status = ?, last_at = ? WHERE id = ?').run(
          String(res.status), new Date().toISOString(), w.id,
        )
      })
      .catch((e) => {
        db.prepare('UPDATE webhooks SET last_status = ?, last_at = ? WHERE id = ?').run(
          `error: ${e?.message || 'failed'}`.slice(0, 80), new Date().toISOString(), w.id,
        )
      })
  }
}
