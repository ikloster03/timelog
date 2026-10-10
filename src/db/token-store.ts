import { asc, eq } from 'drizzle-orm'
import type { TokenRecord, TokenStore } from '../tokens/tokens.js'
import type { Database } from './client.js'
import { accessTokens } from './schema.js'

function toRecord(row: typeof accessTokens.$inferSelect): TokenRecord {
  return {
    id: row.id,
    hash: row.hash,
    prefix: row.prefix,
    createdAt: row.createdAt,
    revokedAt: row.revokedAt,
  }
}

export class DrizzleTokenStore implements TokenStore {
  constructor(private readonly db: Database) {}

  async insert(input: { hash: string; prefix: string }): Promise<TokenRecord> {
    const [row] = await this.db.insert(accessTokens).values(input).returning()
    if (!row) throw new Error('insert did not return a token')
    return toRecord(row)
  }

  async list(): Promise<TokenRecord[]> {
    const rows = await this.db
      .select()
      .from(accessTokens)
      .orderBy(asc(accessTokens.createdAt), asc(accessTokens.id))
    return rows.map(toRecord)
  }

  async findByHash(hash: string): Promise<TokenRecord | null> {
    const [row] = await this.db.select().from(accessTokens).where(eq(accessTokens.hash, hash)).limit(1)
    return row ? toRecord(row) : null
  }

  async findById(id: string): Promise<TokenRecord | null> {
    const [row] = await this.db.select().from(accessTokens).where(eq(accessTokens.id, id)).limit(1)
    return row ? toRecord(row) : null
  }

  async revoke(id: string, at: Date): Promise<void> {
    await this.db.update(accessTokens).set({ revokedAt: at }).where(eq(accessTokens.id, id))
  }
}
