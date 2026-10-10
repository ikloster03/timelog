import { eq } from 'drizzle-orm'
import type { JournalStore, LogEntry } from '../journal/journal.js'
import type { Database } from './client.js'
import { logEntries } from './schema.js'

function toEntry(row: typeof logEntries.$inferSelect): LogEntry {
  return {
    id: row.id,
    start: row.start,
    end: row.end,
    name: row.name,
    tags: [...row.tags],
    comment: row.comment,
  }
}

export class DrizzleJournalStore implements JournalStore {
  constructor(private readonly db: Database) {}

  async insert(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const [row] = await this.db.insert(logEntries).values(entry).returning()
    if (!row) throw new Error('insert did not return a log entry')
    return toEntry(row)
  }

  async get(id: string): Promise<LogEntry | null> {
    const [row] = await this.db.select().from(logEntries).where(eq(logEntries.id, id)).limit(1)
    return row ? toEntry(row) : null
  }

  async list(): Promise<LogEntry[]> {
    const rows = await this.db.select().from(logEntries)
    return rows.map(toEntry)
  }

  async save(entry: LogEntry): Promise<boolean> {
    const rows = await this.db
      .update(logEntries)
      .set({
        start: entry.start,
        end: entry.end,
        name: entry.name,
        tags: entry.tags,
        comment: entry.comment,
      })
      .where(eq(logEntries.id, entry.id))
      .returning({ id: logEntries.id })
    return rows.length > 0
  }

  async remove(id: string): Promise<boolean> {
    const rows = await this.db
      .delete(logEntries)
      .where(eq(logEntries.id, id))
      .returning({ id: logEntries.id })
    return rows.length > 0
  }
}
