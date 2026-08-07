// Set a user's password directly against the database.
//
// The escape hatch for when nobody can log in: no server, no session, no
// knowledge of the current password. Everything else (Settings → Security,
// Admin → Users) needs an admin already inside the app.
//
//   node scripts/set-password.mjs admin@flinttask.com
//   node scripts/set-password.mjs admin@flinttask.com 'new-password'
//
// With no password argument it prompts, and the input is not echoed — prefer
// that on a shared box so the password never lands in your shell history.
import bcrypt from 'bcryptjs'
import { createInterface } from 'node:readline'
import { db } from '../db.js'

const [email, passwordArg] = process.argv.slice(2)

if (!email) {
  console.error('Usage: node scripts/set-password.mjs <email> [password]')
  process.exit(1)
}

/** Read a line with the terminal echo off, so the password stays off screen. */
function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    process.stdout.write(question)
    rl.input.on('data', (chunk) => {
      // Re-print the prompt without the typed characters.
      if (!String(chunk).includes('\n')) process.stdout.write(`\r${question}`)
    })
    rl.question('', (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
  })
}

const user = db
  .prepare('SELECT id, email, name, role FROM users WHERE lower(email) = ?')
  .get(email.toLowerCase())

if (!user) {
  console.error(`No account with email ${email}.`)
  const all = db.prepare('SELECT email, role FROM users ORDER BY created_at').all()
  if (all.length) {
    console.error('Accounts in this database:')
    for (const u of all) console.error(`  ${u.email} (${u.role})`)
  }
  process.exit(1)
}

const password = passwordArg ?? (await promptHidden(`New password for ${user.email}: `))

if (password.length < 6) {
  console.error('Password must be at least 6 characters.')
  process.exit(1)
}

db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
  bcrypt.hashSync(password, 10),
  user.id,
)

console.log(`Password updated for ${user.email} (${user.role}).`)
console.log('Existing sessions are unaffected — rotate JWT_SECRET if you need them cut off.')
