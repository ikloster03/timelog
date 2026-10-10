import { serve } from '@hono/node-server'
import { readConfig } from './config.js'
import { createDb } from './db/client.js'
import { DrizzleJournalStore } from './db/journal-store.js'
import { applyMigrations } from './db/migrate.js'
import { DrizzleTokenStore } from './db/token-store.js'
import { createApp } from './http/app.js'
import { Journal } from './journal/journal.js'
import { Tokens } from './tokens/tokens.js'

let config
try {
  config = readConfig()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const db = createDb(config.databaseUrl)

try {
  await applyMigrations(db)
} catch (error) {
  console.error(error)
  process.exit(1)
}

const app = createApp({
  journal: new Journal(new DrizzleJournalStore(db)),
  tokens: new Tokens(new DrizzleTokenStore(db)),
})

serve({ fetch: app.fetch, port: config.port })
