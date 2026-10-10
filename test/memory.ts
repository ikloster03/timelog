import { randomUUID } from 'node:crypto'
import type { JournalStore, LogEntry } from '../src/journal/journal.ts'
import type { TokenRecord, TokenStore } from '../src/tokens/tokens.ts'

export function createMemoryJournalStore(): JournalStore {
  const rows = new Map<string, LogEntry>()
  return {
    async insert(entry) {
      const stored: LogEntry = { ...entry, id: randomUUID(), tags: [...entry.tags] }
      rows.set(stored.id, stored)
      return { ...stored, tags: [...stored.tags] }
    },
    async get(id) {
      const row = rows.get(id)
      return row ? { ...row, tags: [...row.tags] } : null
    },
    async list() {
      return [...rows.values()].map((row) => ({ ...row, tags: [...row.tags] }))
    },
    async save(entry) {
      if (!rows.has(entry.id)) return false
      rows.set(entry.id, { ...entry, tags: [...entry.tags] })
      return true
    },
    async remove(id) {
      return rows.delete(id)
    },
  }
}

export function createMemoryTokenStore(): TokenStore {
  const rows = new Map<string, TokenRecord>()
  return {
    async insert(input) {
      const record: TokenRecord = {
        id: randomUUID(),
        hash: input.hash,
        prefix: input.prefix,
        createdAt: new Date(),
        revokedAt: null,
      }
      rows.set(record.id, record)
      return { ...record }
    },
    async list() {
      return [...rows.values()].map((row) => ({ ...row }))
    },
    async findByHash(hash) {
      const row = [...rows.values()].find((item) => item.hash === hash)
      return row ? { ...row } : null
    },
    async findById(id) {
      const row = rows.get(id)
      return row ? { ...row } : null
    },
    async revoke(id, at) {
      const row = rows.get(id)
      if (!row || row.revokedAt) return
      row.revokedAt = at
    },
  }
}
