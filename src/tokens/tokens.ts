import { createHash, randomBytes } from 'node:crypto'

export type TokenRecord = {
  id: string
  hash: string
  prefix: string
  createdAt: Date
  revokedAt: Date | null
}

export type TokenPublic = {
  id: string
  prefix: string
  createdAt: Date
  revokedAt: Date | null
}

export type TokenStore = {
  insert(input: { hash: string; prefix: string }): Promise<TokenRecord>
  list(): Promise<TokenRecord[]>
  findByHash(hash: string): Promise<TokenRecord | null>
  findById(id: string): Promise<TokenRecord | null>
  revoke(id: string, at: Date): Promise<void>
}

export class TokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TokenError'
  }
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex')
}

export function createSecret(): string {
  return randomBytes(32).toString('base64url')
}

function toPublic(record: TokenRecord): TokenPublic {
  return {
    id: record.id,
    prefix: record.prefix,
    createdAt: record.createdAt,
    revokedAt: record.revokedAt,
  }
}

export class Tokens {
  constructor(
    private readonly store: TokenStore,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async create(): Promise<{ id: string; secret: string }> {
    const secret = createSecret()
    const record = await this.store.insert({
      hash: hashSecret(secret),
      prefix: secret.slice(0, 8),
    })
    return { id: record.id, secret }
  }

  async list(): Promise<TokenPublic[]> {
    const records = await this.store.list()
    return records.map(toPublic)
  }

  async revoke(id: string): Promise<void> {
    const record = await this.store.findById(id)
    if (!record) throw new TokenError('token not found')
    if (record.revokedAt) throw new TokenError('token already revoked')
    await this.store.revoke(id, this.clock())
  }

  async isActive(secret: string): Promise<boolean> {
    const record = await this.store.findByHash(hashSecret(secret))
    return record !== null && record.revokedAt === null
  }
}
