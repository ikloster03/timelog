export type LogEntry = {
  id: string
  start: Date
  end: Date | null
  name: string
  tags: string[]
  comment: string | null
}

export type CreateLogInput = {
  name: string
  start?: Date
  end?: Date | null
  tags?: string[]
  comment?: string | null
}

export type UpdateLogInput = {
  name?: string
  start?: Date
  end?: Date | null
  tags?: string[]
  comment?: string | null
}

export type ListLogsQuery = {
  from?: Date
  to?: Date
  open?: boolean
  tags?: string[]
}

export type JournalStore = {
  insert(entry: Omit<LogEntry, 'id'>): Promise<LogEntry>
  get(id: string): Promise<LogEntry | null>
  list(): Promise<LogEntry[]>
  save(entry: LogEntry): Promise<boolean>
  remove(id: string): Promise<boolean>
}

export class JournalError extends Error {
  readonly status: 400 | 404

  constructor(message: string, status: 400 | 404) {
    super(message)
    this.name = 'JournalError'
    this.status = status
  }
}

export type LogJson = {
  id: string
  start: string
  end: string | null
  name: string
  tags: string[]
  comment: string | null
}

export function toLogJson(entry: LogEntry): LogJson {
  return {
    id: entry.id,
    start: entry.start.toISOString(),
    end: entry.end ? entry.end.toISOString() : null,
    name: entry.name,
    tags: [...entry.tags],
    comment: entry.comment,
  }
}

function assertName(name: string): void {
  if (name.trim().length === 0) {
    throw new JournalError('name must not be blank', 400)
  }
}

function assertOrder(start: Date, end: Date | null): void {
  if (end && end < start) {
    throw new JournalError('end must not be before start', 400)
  }
}

function matches(entry: LogEntry, query: ListLogsQuery): boolean {
  if (query.to && !(entry.start < query.to)) return false
  if (query.from && !(entry.end === null || entry.end > query.from)) return false
  if (query.open === true && entry.end !== null) return false
  if (query.tags && query.tags.length > 0) {
    if (!query.tags.every((tag) => entry.tags.includes(tag))) return false
  }
  return true
}

function compareEntries(left: LogEntry, right: LogEntry): number {
  const byStart = left.start.getTime() - right.start.getTime()
  if (byStart !== 0) return byStart
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

export class Journal {
  constructor(
    private readonly store: JournalStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(input: CreateLogInput): Promise<LogEntry> {
    assertName(input.name)
    const start = input.start ?? this.clock()
    const end = input.end === undefined || input.end === null ? null : input.end
    assertOrder(start, end)
    return this.store.insert({
      start,
      end,
      name: input.name,
      tags: [...(input.tags ?? [])],
      comment: input.comment === undefined ? null : input.comment,
    })
  }

  async start(input: Omit<CreateLogInput, 'end'>): Promise<LogEntry> {
    return this.create(input)
  }

  async stop(id: string, end?: Date): Promise<LogEntry> {
    return this.update(id, { end: end ?? this.clock() })
  }

  async get(id: string): Promise<LogEntry> {
    const entry = await this.store.get(id)
    if (!entry) throw new JournalError('log not found', 404)
    return entry
  }

  async list(query: ListLogsQuery = {}): Promise<LogEntry[]> {
    const rows = await this.store.list()
    return rows.filter((entry) => matches(entry, query)).sort(compareEntries)
  }

  async update(id: string, input: UpdateLogInput): Promise<LogEntry> {
    const current = await this.get(id)
    const next: LogEntry = {
      ...current,
      tags: [...current.tags],
    }
    if (input.name !== undefined) {
      assertName(input.name)
      next.name = input.name
    }
    if (input.start !== undefined) next.start = input.start
    if (input.end !== undefined) next.end = input.end
    if (input.tags !== undefined) next.tags = [...input.tags]
    if (input.comment !== undefined) next.comment = input.comment
    assertOrder(next.start, next.end)
    const saved = await this.store.save(next)
    if (!saved) throw new JournalError('log not found', 404)
    return next
  }

  async delete(id: string): Promise<void> {
    const removed = await this.store.remove(id)
    if (!removed) throw new JournalError('log not found', 404)
  }
}
