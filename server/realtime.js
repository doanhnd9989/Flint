// Realtime push over WebSocket. Clients connect to /api/ws?token=<jwt|apikey>;
// whenever the workspace is saved we broadcast the new version so every other
// client refreshes instantly (the HTTP polling in the client remains as a
// fallback when the socket is unavailable).
import { WebSocketServer } from 'ws'
import { verifyToken } from './auth.js'
import { onWorkspaceSave } from './workspace.js'
import { resolveMembership } from './tenancy.js'

export function setupWebsocket(server) {
  const wss = new WebSocketServer({ server, path: '/api/ws' })

  wss.on('connection', (ws, req) => {
    let token = null
    let requested = null
    try {
      const params = new URL(req.url, 'http://localhost').searchParams
      token = params.get('token')
      requested = params.get('workspaceId')
    } catch {
      /* ignore */
    }
    const user = verifyToken(token)
    if (!user) {
      ws.close(4001, 'unauthorized')
      return
    }
    // A socket only ever hears about the workspace it subscribed to, so a
    // version bump can't tell one tenant that another tenant changed.
    const member = resolveMembership(user, requested)
    if (!member) {
      ws.close(4003, 'forbidden')
      return
    }
    ws.workspaceId = member.workspace_id
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    ws.send(JSON.stringify({ type: 'hello', workspaceId: ws.workspaceId }))
  })

  // Heartbeat: drop sockets that stop responding.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate()
      ws.isAlive = false
      try { ws.ping() } catch { /* ignore */ }
    })
  }, 30000)
  wss.on('close', () => clearInterval(heartbeat))

  onWorkspaceSave(({ workspaceId, version, writer }) => {
    const msg = JSON.stringify({ type: 'workspace', workspaceId, version, lastWriter: writer })
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN && ws.workspaceId === workspaceId) {
        try { ws.send(msg) } catch { /* ignore */ }
      }
    })
  })

  return wss
}
