import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const logEntries = pgTable('log_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  start: timestamp('start', { withTimezone: true, mode: 'date' }).notNull(),
  end: timestamp('end', { withTimezone: true, mode: 'date' }),
  name: text('name').notNull(),
  tags: text('tags').array().notNull().default([]),
  comment: text('comment'),
})

export const accessTokens = pgTable('access_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  hash: text('hash').notNull().unique(),
  prefix: text('prefix').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
})
