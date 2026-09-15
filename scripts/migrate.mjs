import pg from 'pg'
import { spawn } from 'node:child_process'

const { Client } = pg
const lockId = 731_942_611

function fatal(message) {
  console.error(message)
  process.exit(1)
}

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) fatal('DATABASE_URL is required')

const client = new Client({ connectionString: DATABASE_URL })

let child
// Forward termination signals to the migration child so the DB session lock is
// released only after the child actually exits.
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (child && child.exitCode === null && !child.signalCode) {
      try { child.kill(signal) } catch { /* ignore */ }
    }
  })
}

await client.connect().catch((e) => fatal(`failed to connect: ${e.message}`))

try {
  await client.query("SET lock_timeout = '120s'")
  await client.query('SELECT pg_advisory_lock($1)', [lockId])
} catch (e) {
  fatal(`migration failed: could not acquire session lock within 120s: ${e.message}`)
}

let exitCode = 0
let termSignal
try {
  exitCode = await new Promise((resolve, reject) => {
    child = spawn('corepack', ['pnpm', 'run', 'payload', '--', 'migrate'], { stdio: 'inherit', env: process.env })
    child.once('error', (e) => reject(e))
    child.once('exit', (code, signal) => {
      if (signal) { termSignal = signal; resolve(128) } else resolve(code ?? 1)
    })
  })
} catch (e) {
  fatal(`migration failed: could not start: ${e.message}`)
} finally {
  // The advisory lock is session-scoped; ending the client releases it.
  await client.query('SELECT pg_advisory_unlock($1)', [lockId]).catch(() => undefined)
  await client.end().catch(() => undefined)
}

if (termSignal) fatal(`migration terminated by signal ${termSignal}`)
if (exitCode !== 0) fatal(`migration exited with code ${exitCode}`)