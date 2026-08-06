// Asset storage for uploads (images pasted into a description, files attached
// to an issue or a comment). Bytes live on disk under data/uploads/<id>; the
// row in `files` keeps the metadata we need to serve them back.
//
// Two ways in, both ending at the same place:
//   • POST /api/files      — one shot: raw body + x-filename header (web app)
//   • GraphQL fileUpload   — hands back an uploadUrl the client PUTs to, which
//                            is how Linear's API does it (pre-signed upload)
//
// The id is 32 random hex chars and the asset URL contains it, so the URL is
// itself the capability: an <img src> can't carry an Authorization header, and
// signing every render would buy nothing an unguessable path doesn't.
import express, { Router } from 'express'
import { randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './db.js'
import { requireAuth } from './auth.js'

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'uploads')
fs.mkdirSync(DIR, { recursive: true })

/** Hard ceiling per file. Anything larger is rejected before a byte is written. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id           TEXT PRIMARY KEY,
    filename     TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size         INTEGER NOT NULL,
    user_id      TEXT,
    uploaded     INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL
  );
`)

const newId = () => randomBytes(16).toString('hex')

/**
 * Strip anything that could escape the directory or confuse a download.
 * Names arrive percent-encoded (an HTTP header can only carry latin-1, and
 * filenames are routinely not), so decode first.
 */
function safeName(name) {
  let raw = String(name || 'file')
  try {
    raw = decodeURIComponent(raw)
  } catch {
    /* not percent-encoded — use as-is */
  }
  const base = raw.split(/[\\/]/).pop().trim()
  // Unicode letters survive (filenames are routinely not ASCII); only control
  // characters and the ones that would break a path or a Content-Disposition
  // header get replaced.
  // eslint-disable-next-line no-control-regex
  const cleaned = base.replace(/[\u0000-\u001f\\/:*?"<>|]+/g, '_')
  return cleaned.slice(0, 120).trim() || 'file'
}

const diskPath = (id) => path.join(DIR, id)

/**
 * Register an upload and return the URLs for it. `assetUrl` is where the file
 * will be readable; `uploadUrl` is where the bytes go (a no-op for the one-shot
 * POST, which writes them itself).
 */
export function createFileRecord({ filename, contentType, size, userId }) {
  const id = newId()
  const name = safeName(filename)
  db.prepare(
    'INSERT INTO files (id, filename, content_type, size, user_id, uploaded, created_at) VALUES (?,?,?,?,?,0,?)',
  ).run(id, name, String(contentType || 'application/octet-stream'), Number(size) || 0, userId || null, new Date().toISOString())
  return {
    id,
    filename: name,
    contentType: String(contentType || 'application/octet-stream'),
    size: Number(size) || 0,
    assetUrl: `/api/files/${id}/${encodeURIComponent(name)}`,
    uploadUrl: `/api/files/${id}`,
  }
}

/**
 * The stored record for an uploaded asset, or null. Lets other modules resolve
 * an `/api/files/<id>/...` URL back to its real byte size and content type.
 */
export function getFileRecord(id) {
  return db.prepare('SELECT * FROM files WHERE id = ?').get(id) ?? null
}

/** The file id embedded in an `/api/files/<id>[/name]` URL, or null. */
export function fileIdFromUrl(url) {
  const m = String(url || '').match(/^\/api\/files\/([0-9a-f]{32})(?:\/|$)/)
  return m ? m[1] : null
}

export function writeFileBytes(id, buf) {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(id)
  if (!row) return null
  fs.writeFileSync(diskPath(id), buf)
  db.prepare('UPDATE files SET size = ?, uploaded = 1 WHERE id = ?').run(buf.length, id)
  return { ...row, size: buf.length, uploaded: 1 }
}

export const filesRouter = Router()

// Raw-body parser for the two upload routes. `type: () => true` because the
// client sends the file's own Content-Type, not a fixed one.
const rawBody = express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES })

// One-shot upload: the whole file as the request body, its name in a header.
// Returns the same shape as the GraphQL fileUpload payload's uploadFile.
filesRouter.post('/', requireAuth, rawBody, (req, res) => {
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  if (!buf.length) return res.status(400).json({ error: 'Empty upload' })
  if (buf.length > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: `File exceeds the ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)}MB limit` })
  }
  const rec = createFileRecord({
    filename: req.get('x-filename') || 'file',
    contentType: req.get('content-type') || 'application/octet-stream',
    size: buf.length,
    userId: req.user?.id,
  })
  writeFileBytes(rec.id, buf)
  res.status(201).json({ file: { ...rec, size: buf.length } })
})

// Pre-registered upload (Linear's flow): PUT the bytes to the returned uploadUrl.
filesRouter.put('/:id', requireAuth, rawBody, (req, res) => {
  const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  if (!buf.length) return res.status(400).json({ error: 'Empty upload' })
  if (buf.length > MAX_UPLOAD_BYTES) {
    return res.status(413).json({ error: 'File too large' })
  }
  const row = writeFileBytes(req.params.id, buf)
  if (!row) return res.status(404).json({ error: 'Unknown upload id' })
  res.json({ ok: true, size: buf.length })
})

// Serving. The id is the capability, so no auth header is required — an <img>
// tag can't send one. Images render inline; everything else downloads.
filesRouter.get('/:id/:filename?', (req, res) => {
  const row = db.prepare('SELECT * FROM files WHERE id = ?').get(req.params.id)
  if (!row || !row.uploaded || !fs.existsSync(diskPath(row.id))) {
    return res.status(404).json({ error: 'File not found' })
  }
  const inline = row.content_type.startsWith('image/') || row.content_type.startsWith('video/')
  res.setHeader('Content-Type', row.content_type)
  res.setHeader('Content-Length', String(row.size))
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
  res.setHeader(
    'Content-Disposition',
    `${inline ? 'inline' : 'attachment'}; filename="${row.filename.replace(/"/g, '')}"`,
  )
  fs.createReadStream(diskPath(row.id)).pipe(res)
})
