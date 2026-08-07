#!/usr/bin/env node
// seed-bulk.mjs — the "pour data in" half of the /linear-audit routine.
//
// Everything goes through the real API the app itself uses (login → GraphQL →
// Linear's pre-signed fileUpload flow), so whatever this creates exercises the
// same code path a user would. Nothing is written to the DB directly.
//
//   node scripts/audit/seed-bulk.mjs            # default volume
//   node scripts/audit/seed-bulk.mjs --issues 40 --attachments 12
//   node scripts/audit/seed-bulk.mjs --dry      # show the plan, create nothing
//
// Credentials are the published local dev seed account; this only ever talks to
// localhost. Re-runnable: every run appends a fresh batch tagged in the title.
import { deflateSync } from 'node:zlib'

const API = process.env.API_URL || 'http://localhost:3001'
const EMAIL = process.env.SEED_EMAIL || 'avery@workspace.dev'
const PASSWORD = process.env.SEED_PASSWORD || 'demo1234'

const argv = process.argv.slice(2)
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 ? dflt : Number(argv[i + 1])
}
const DRY = argv.includes('--dry')
const N_ISSUES = flag('issues', 24)
const N_COMMENTS = flag('comments', 18)
const N_ATTACH = flag('attachments', 8)
const N_SUB = flag('subissues', 6)

// Deterministic PRNG so a failing run can be reproduced from its printed seed.
let seed = flag('seed', 1337)
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
const pick = (a) => a[Math.floor(rnd() * a.length)]
const some = (a, n) => a.slice().sort(() => rnd() - 0.5).slice(0, n)

// ─────────────────────────────────────────────────────────────── transport

let token = ''
async function gql(query, variables) {
  const res = await fetch(`${API}/graphql`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '))
  return json.data
}

async function login() {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login ${res.status} — is the API up and seeded?`)
  token = (await res.json()).token
}

// ────────────────────────────────────────────────────────── file synthesis

const CRC = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c
})
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/**
 * A real (not stubbed) RGB PNG of `w`×`h`, so the image lightbox, thumbnails
 * and the server's size/content-type derivation all get genuine bytes to work
 * with. Larger dimensions are how we produce attachments in the hundreds of KB.
 */
function png(w, h, hue) {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  let p = 0
  for (let y = 0; y < h; y++) {
    raw[p++] = 0 // filter: none
    for (let x = 0; x < w; x++) {
      raw[p++] = (hue + x * 255 / w) & 0xff
      raw[p++] = (y * 255 / h) & 0xff
      raw[p++] = ((x ^ y) + hue) & 0xff
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const textFile = (rows) =>
  Buffer.from(
    'id,area,severity,note\n' +
      Array.from({ length: rows }, (_, i) =>
        `${i + 1},${pick(['filters', 'board', 'inbox', 'cycles'])},${pick(['low', 'med', 'high'])},row ${i + 1}\n`,
      ).join(''),
  )

/** Linear's flow: fileUpload → PUT the raw bytes to uploadUrl → use assetUrl. */
async function upload(filename, contentType, bytes) {
  const { fileUpload } = await gql(
    `mutation($c:String!,$f:String!,$s:Int!){
       fileUpload(contentType:$c,filename:$f,size:$s){
         success uploadFile{ uploadUrl assetUrl headers{ key value } } } }`,
    { c: contentType, f: filename, s: bytes.length },
  )
  const uf = fileUpload.uploadFile
  // The payload asks for Content-Type; our upload endpoint also wants the bearer
  // token (Linear's pre-signed S3 URL carries its own credentials instead).
  const headers = Object.fromEntries(uf.headers.map((h) => [h.key, h.value]))
  headers.authorization = `Bearer ${token}`
  const put = await fetch(new URL(uf.uploadUrl, API), { method: 'PUT', headers, body: bytes })
  if (!put.ok) throw new Error(`PUT ${uf.uploadUrl} → ${put.status}`)
  return uf.assetUrl
}

// ──────────────────────────────────────────────────────────────── content

const TITLES = [
  'Filter menu should show faceted counts per option',
  'Board column header loses its count after a drag',
  'Inbox unread dot lingers after marking all read',
  'Cycle burndown flattens when scope changes mid-cycle',
  'Sub-issue progress ring rounds to the wrong bucket',
  'Command menu forgets the last-used action',
  'Attachment preview is blurry on retina displays',
  'Triage keyboard shortcuts collide with the editor',
  'Project milestone dates drift by a day in UTC-negative zones',
  'Saved view crashes when a filter dimension is missing',
  'Label picker does not scroll to the highlighted row',
  'Estimate distribution chart omits unestimated issues',
  'Notification schedule ignores the weekend toggle',
  'Roadmap timeline mis-aligns quarters after a resize',
  'Document outline skips headings inside code blocks',
  'Search highlights match on identifier but not on title',
  'Bulk edit clears the assignee instead of leaving it',
  'Relations panel duplicates a blocked-by row after undo',
  'Customer request count is stale until a hard reload',
  'Release burndown counts archived issues',
]
const BODIES = [
  'Steps:\n1. Open the view\n2. Apply two filters\n3. Reload\n\n**Expected:** state survives the reload.\n**Actual:** it resets.',
  'Noticed while comparing against Linear. The chrome is close but the ordering differs — Linear puts the control on the right of the header.',
  'Repro is flaky, roughly one in three attempts. Attaching a screen capture and the console output.',
  '- [ ] Confirm on a fresh workspace\n- [ ] Check the dark theme\n- [ ] Verify keyboard-only path',
  'Low priority, but it looks wrong next to the real product. Worth a pass when we touch this area next.',
]
const COMMENTS = [
  'Reproduced on the seed workspace — happens with any saved view older than the newest filter dimension.',
  'This matches Linear once the count moves into the footer. Pushing a fix.',
  'Can we confirm the keyboard path too? The pointer path is fine.',
  'Blocked on the attachment size work landing first.',
  'Nice catch. Adding it to the parity map so the next sweep checks it.',
]

// ───────────────────────────────────────────────────────────────── the run

const created = { issues: [], comments: 0, attachments: 0, bytes: 0, subIssues: 0 }

async function main() {
  await login()
  const w = await gql(`{
    teams(first:20){ nodes{ id key name } }
    workflowStates(first:100){ nodes{ id name type team{ id } } }
    users(first:50){ nodes{ id name } }
    issueLabels(first:100){ nodes{ id name } }
    projects(first:50){ nodes{ id name } }
    cycles(first:50){ nodes{ id number team{ id } } }
    issues(first:1){ nodes{ id } }
  }`)

  const teams = w.teams.nodes
  const users = w.users.nodes
  const labels = w.issueLabels.nodes
  const projects = w.projects.nodes
  if (!teams.length) throw new Error('no teams — seed the workspace first')

  const batch = new Date().toISOString().slice(5, 16).replace('T', ' ')
  console.log(
    `plan: ${N_ISSUES} issues · ${N_SUB} sub-issues · ${N_COMMENTS} comments · ` +
      `${N_ATTACH} attachments (seed ${flag('seed', 1337)}) into ${teams.length} team(s)`,
  )
  if (DRY) return

  // ── issues ───────────────────────────────────────────────────────────
  for (let i = 0; i < N_ISSUES; i++) {
    const team = pick(teams)
    const states = w.workflowStates.nodes.filter((s) => s.team?.id === team.id)
    const cycles = w.cycles.nodes.filter((c) => c.team?.id === team.id)
    const input = {
      title: `${pick(TITLES)} (${batch} #${i + 1})`,
      description: pick(BODIES),
      teamId: team.id,
      priority: Math.floor(rnd() * 5),
      estimate: pick([0, 1, 2, 3, 5, 8]),
      ...(states.length ? { stateId: pick(states).id } : {}),
      // Leave some unassigned/unlabelled/backlogged so the empty states and the
      // "No assignee" grouping have real rows to render.
      ...(rnd() > 0.25 ? { assigneeId: pick(users).id } : {}),
      ...(rnd() > 0.4 && labels.length ? { labelIds: some(labels, 1 + Math.floor(rnd() * 3)).map((l) => l.id) } : {}),
      ...(rnd() > 0.5 && projects.length ? { projectId: pick(projects).id } : {}),
      ...(rnd() > 0.6 && cycles.length ? { cycleId: pick(cycles).id } : {}),
      ...(rnd() > 0.7 ? { subscriberIds: some(users, 2).map((u) => u.id) } : {}),
      ...(rnd() > 0.6
        ? { dueDate: new Date(Date.now() + (rnd() * 40 - 10) * 864e5).toISOString().slice(0, 10) }
        : {}),
    }
    const { issueCreate } = await gql(
      `mutation($i:IssueCreateInput!){ issueCreate(input:$i){ success issue{ id identifier title } } }`,
      { i: input },
    )
    created.issues.push(issueCreate.issue)
  }

  // ── sub-issues (parented to the batch we just made) ──────────────────
  for (let i = 0; i < N_SUB && created.issues.length; i++) {
    const parent = pick(created.issues)
    const team = pick(teams)
    const { issueCreate } = await gql(
      `mutation($i:IssueCreateInput!){ issueCreate(input:$i){ issue{ id } } }`,
      {
        i: {
          title: `Sub-task ${i + 1} of ${parent.identifier} (${batch})`,
          teamId: team.id,
          parentId: parent.id,
          priority: Math.floor(rnd() * 5),
        },
      },
    )
    if (issueCreate.issue) created.subIssues++
  }

  // ── comments ─────────────────────────────────────────────────────────
  for (let i = 0; i < N_COMMENTS && created.issues.length; i++) {
    await gql(`mutation($i:CommentCreateInput!){ commentCreate(input:$i){ success } }`, {
      i: { issueId: pick(created.issues).id, body: pick(COMMENTS) },
    })
    created.comments++
  }

  // ── attachments: real uploaded bytes, images and files ───────────────
  for (let i = 0; i < N_ATTACH && created.issues.length; i++) {
    const issue = pick(created.issues)
    const asImage = i % 3 !== 2
    const [name, type, bytes] = asImage
      ? [
          `screenshot-${batch.replace(/[ :]/g, '')}-${i + 1}.png`,
          'image/png',
          png(pick([320, 640, 900]), pick([200, 400, 560]), Math.floor(rnd() * 255)),
        ]
      : [`audit-notes-${i + 1}.csv`, 'text/csv', textFile(40 + Math.floor(rnd() * 400))]

    const assetUrl = await upload(name, type, bytes)
    await gql(
      `mutation($i:AttachmentCreateInput!){ attachmentCreate(input:$i){ success attachment{ id subtitle } } }`,
      // No `subtitle`: the server derives the size from the stored bytes, and
      // that is exactly the path we want under test.
      { i: { issueId: issue.id, title: name, url: assetUrl, metadata: { contentType: type } } },
    )
    created.attachments++
    created.bytes += bytes.length
  }

  const kb = (created.bytes / 1024).toFixed(0)
  console.log(
    `done: ${created.issues.length} issues (+${created.subIssues} sub) · ` +
      `${created.comments} comments · ${created.attachments} attachments (${kb} KB of real bytes)`,
  )
  console.log(`spot-check: ${created.issues.slice(0, 3).map((i) => i.identifier).join(', ')}`)
}

main().catch((e) => {
  console.error(`seed-bulk failed: ${e.message}`)
  process.exit(1)
})
