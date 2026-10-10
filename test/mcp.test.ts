import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createApp } from '../src/http/app.ts'
import { Journal } from '../src/journal/journal.ts'
import { journalToolNames } from '../src/mcp/tools.ts'
import { Tokens } from '../src/tokens/tokens.ts'
import { createMemoryJournalStore, createMemoryTokenStore } from './memory.ts'

async function setup() {
  const access = new Tokens(createMemoryTokenStore())
  const created = await access.create()
  const logs = new Journal(createMemoryJournalStore(), () => new Date('2024-06-01T12:00:00.000Z'))
  const app = createApp({ journal: logs, tokens: access })
  return { app, logs, access, secret: created.secret }
}

function mcp(app: ReturnType<typeof createApp>, secret: string | undefined, body: unknown) {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  }
  if (secret) headers.authorization = `Bearer ${secret}`
  return app.request('/mcp', { method: 'POST', headers, body: JSON.stringify(body) })
}

describe('mcp', () => {
  it('rejects a call without a token and a call with a revoked token before creating a log', async () => {
    const { app, logs, access, secret } = await setup()
    const missing = await mcp(app, undefined, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'start_log', arguments: { name: 'hidden' } },
    })
    assert.equal(missing.status, 401)
    assert.deepEqual(await missing.json(), { error: 'unauthorized' })
    assert.equal((await logs.list()).length, 0)

    await access.revoke((await access.list())[0]!.id)
    const revoked = await mcp(app, secret, {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'start_log', arguments: { name: 'hidden' } },
    })
    assert.equal(revoked.status, 401)
    assert.equal((await logs.list()).length, 0)
  })

  it('lists journal tools only and writes the same journal as HTTP', async () => {
    const { app, secret } = await setup()
    const listed = await mcp(app, secret, { jsonrpc: '2.0', id: 1, method: 'tools/list' })
    assert.equal(listed.status, 200)
    const payload = (await listed.json()) as { result?: { tools?: Array<{ name: string }> } }
    const names = (payload.result?.tools ?? []).map((tool) => tool.name).sort()
    assert.deepEqual(names, [...journalToolNames].sort())
    assert.equal(names.some((name) => name.includes('token')), false)

    const started = await mcp(app, secret, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'start_log', arguments: { name: 'from mcp' } },
    })
    assert.equal(started.status, 200)
    const call = (await started.json()) as { result?: { isError?: boolean; content?: Array<{ text: string }> } }
    assert.notEqual(call.result?.isError, true)
    const entry = JSON.parse(call.result?.content?.[0]?.text ?? '{}') as { id: string; end: null; name: string }
    assert.equal(entry.name, 'from mcp')
    assert.equal(entry.end, null)

    const viaHttp = await app.request('/logs?open=true', {
      headers: { authorization: `Bearer ${secret}` },
    })
    const body = (await viaHttp.json()) as Array<{ id: string }>
    assert.deepEqual(body.map((item) => item.id), [entry.id])

    const stopped = await mcp(app, secret, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'stop_log', arguments: { id: entry.id } },
    })
    const stoppedBody = (await stopped.json()) as { result?: { content?: Array<{ text: string }> } }
    const closed = JSON.parse(stoppedBody.result?.content?.[0]?.text ?? '{}') as { end: string | null }
    assert.equal(closed.end, '2024-06-01T12:00:00.000Z')
  })
})
