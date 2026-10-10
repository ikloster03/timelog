import { migrate } from 'drizzle-orm/node-postgres/migrator'
import type { Database } from './client.js'

export async function applyMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: 'drizzle' })
}
