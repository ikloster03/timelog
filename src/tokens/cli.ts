import { TokenError, type TokenPublic, type Tokens } from './tokens.js'

export type CliResult = {
  code: number
  stdout: string
  stderr: string
}

const usage = 'usage: token list | token create | token revoke <id>\n'

function failUsage(): CliResult {
  return { code: 1, stdout: '', stderr: usage }
}

function formatCreate(created: { id: string; secret: string }): string {
  return `id: ${created.id}\nsecret: ${created.secret}\n`
}

function formatList(rows: TokenPublic[]): string {
  if (rows.length === 0) return ''
  return rows
    .map((row) =>
      [
        `id: ${row.id}`,
        `prefix: ${row.prefix}`,
        `createdAt: ${row.createdAt.toISOString()}`,
        `revokedAt: ${row.revokedAt ? row.revokedAt.toISOString() : 'null'}`,
      ].join('\n'),
    )
    .join('\n\n')
    .concat('\n')
}

export async function runCli(args: string[], tokens: Tokens): Promise<CliResult> {
  const [group, action, extra, overflow] = args
  if (group !== 'token' || overflow !== undefined) return failUsage()

  if (action === 'list') {
    if (extra !== undefined) return failUsage()
    return { code: 0, stdout: formatList(await tokens.list()), stderr: '' }
  }

  if (action === 'create') {
    if (extra !== undefined) return failUsage()
    return { code: 0, stdout: formatCreate(await tokens.create()), stderr: '' }
  }

  if (action === 'revoke') {
    if (!extra) return failUsage()
    try {
      await tokens.revoke(extra)
      return { code: 0, stdout: `revoked ${extra}\n`, stderr: '' }
    } catch (error) {
      if (error instanceof TokenError) {
        return { code: 1, stdout: '', stderr: `${error.message}\n` }
      }
      throw error
    }
  }

  return failUsage()
}
