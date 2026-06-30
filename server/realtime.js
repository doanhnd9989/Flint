// Realtime push over WebSocket. Clients connect to /api/ws?token=<jwt|apikey>;
// whenever the workspace is saved we broadcast the new version so every other
// client refreshes instantly (the HTTP polling in the client remains as a
// fallback when the socket is unavailable).
import { WebSocketServer } from 'ws'
import { verifyToken } from './auth.js'
import { onWorkspaceSave } from './workspace.js'

export function setupWebsocket(server) {
  const wss = new WebSocketServer({ server, path: '/api/ws' })

  wss.on('connection', (ws, req) => {
    let token = null
    try {
      token = new URL(req.url, 'http://localhost').searchParams.get('token')
    } catch {
      /* ignore */
    }
    if (!verifyToken(token)) {
      ws.close(4001, 'unauthorized')
      return
    }
    ws.isAlive = true
    ws.on('pong', () => { ws.isAlive = true })
    ws.send(JSON.stringify({ type: 'hello' }))
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

  onWorkspaceSave(({ version, writer }) => {
    const msg = JSON.stringify({ type: 'workspace', version, lastWriter: writer })
    wss.clients.forEach((ws) => {
      if (ws.readyState === ws.OPEN) {
        try { ws.send(msg) } catch { /* ignore */ }
      }
    })
  })

  return wss
}
