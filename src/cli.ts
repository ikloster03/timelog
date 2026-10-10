import { pathToFileURL } from 'node:url'
import { readConfig } from './config.js'
import { createDb } from './db/client.js'
import { applyMigrations } from './db/migrate.js'
import { DrizzleTokenStore } from './db/token-store.js'
import { runCli } from './tokens/cli.js'
import { Tokens } from './tokens/tokens.js'

async function main(): Promise<void> {
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

  const result = await runCli(process.argv.slice(2), new Tokens(new DrizzleTokenStore(db)))
  process.stdout.write(result.stdout)
  process.stderr.write(result.stderr)
  process.exit(result.code)
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  await main()
}
