import type { Tokens } from './tokens.js'

export function bearerSecret(header: string | undefined): string | undefined {
  if (!header) return undefined
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header)
  return match?.[1]
}

export async function authorizeBearer(header: string | undefined, tokens: Tokens): Promise<boolean> {
  const secret = bearerSecret(header)
  if (!secret) return false
  return tokens.isActive(secret)
}
