import { McpServer, WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server'
import type { Context } from 'hono'
import type { Journal } from '../journal/journal.js'
import { authorizeBearer } from '../tokens/auth.js'
import type { Tokens } from '../tokens/tokens.js'
import { registerJournalTools } from './tools.js'

export function mcpHandler(deps: { journal: Journal; tokens: Tokens }) {
  return async (c: Context) => {
    if (!(await authorizeBearer(c.req.header('Authorization'), deps.tokens))) {
      return c.json({ error: 'unauthorized' }, 401)
    }

    const server = new McpServer({ name: 'timelog', version: '1.0.0' })
    registerJournalTools(server, deps.journal)
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    await server.connect(transport)
    try {
      return await transport.handleRequest(c.req.raw)
    } finally {
      await transport.close().catch(() => {})
      await server.close().catch(() => {})
    }
  }
}
