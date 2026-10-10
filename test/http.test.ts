import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { createApp } from '../src/http/app.ts'
import { Journal } from '../src/journal/journal.ts'
import { Tokens } from '../src/tokens/tokens.ts'
import { createMemoryJournalStore, createMemoryTokenStore } from './memory.ts'

const start = '2024-01-02T00:00:00.000Z'
const earlier = '2024-01-01T00:00:00.000Z'

async function setup() {
  const access = new Tokens(createMemoryTokenStore())
  const created = await access.create()
  const logs = new Journal(createMemoryJournalStore(), () => new Date('2024-06-01T12:00:00.000Z'))
  const app = createApp({ journal: logs, tokens: access })
  const headers = {
    authorization: `Bearer ${created.secret}`,
    'content-type': 'application/json',
  }
  return { app, logs, access, headers, secret: created.secret }
}

describe('http', () => {
  it('requires a bearer token and rejects unknown and revoked tokens the same way', async () => {
    const { app, access, secret } = await setup()
    const missing = await app.request('/logs')
    assert.equal(missing.status, 401)
    const missingBody = (await missing.json()) as { error: string }
    assert.equal(typeof missingBody.error, 'string')

    const unknown = await app.request('/logs', { headers: { authorization: 'Bearer not-a-token' } })
    assert.equal(unknown.status, 401)
    assert.deepEqual(await unknown.json(), missingBody)

    await access.revoke((await access.list())[0]!.id)
    const revoked = await app.request('/logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'nope' }),
    })
    assert.equal(revoked.status, 401)
    assert.deepEqual(await revoked.json(), { error: 'unauthorized' })
    assert.equal((await app.request('/health')).status, 200)
  })

  it('creates an open log, distinguishes a missing end from null, and returns 404', async () => {
    const { app, headers } = await setup()
    const created = await app.request('/logs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'work', start, end: '2024-01-03T00:00:00.000Z', tags: ['a'] }),
    })
    assert.equal(created.status, 201)
    const entry = (await created.json()) as { id: string; end: string | null; name: string; tags: string[] }
    assert.equal(entry.end, '2024-01-03T00:00:00.000Z')

    const renamed = await app.request(`/logs/${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ name: 'renamed' }),
    })
    assert.equal(renamed.status, 200)
    const afterRename = (await renamed.json()) as { name: string; end: string | null; tags: string[] }
    assert.equal(afterRename.name, 'renamed')
    assert.equal(afterRename.end, '2024-01-03T00:00:00.000Z')
    assert.deepEqual(afterRename.tags, ['a'])

    const reopened = await app.request(`/logs/${entry.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ end: null }),
    })
    assert.equal(reopened.status, 200)
    assert.equal(((await reopened.json()) as { end: string | null }).end, null)

    const missing = await app.request(`/logs/${randomUUID()}`, { headers })
    assert.equal(missing.status, 404)
    assert.equal(typeof ((await missing.json()) as { error: string }).error, 'string')
  })

  it('rejects an end before the start and does not create a log', async () => {
    const { app, headers, logs } = await setup()
    const response = await app.request('/logs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'bad', start, end: earlier }),
    })
    assert.equal(response.status, 400)
    assert.equal(typeof ((await response.json()) as { error: string }).error, 'string')
    assert.equal((await logs.list()).length, 0)
  })

  it('serves health and the OpenAPI document without a token', async () => {
    const { app } = await setup()
    const health = await app.request('/health')
    assert.equal(health.status, 200)
    assert.deepEqual(await health.json(), { ok: true })

    const page = await app.request('/scalar')
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type') ?? '', /html/)

    const spec = await app.request('/scalar/openapi.json')
    assert.equal(spec.status, 200)
    const document = (await spec.json()) as {
      paths: Record<string, { post?: { security?: unknown } }>
      components?: { securitySchemes?: Record<string, { type?: string; scheme?: string }> }
    }
    assert.ok(document.paths['/logs']?.post)
    assert.deepEqual(document.paths['/logs']?.post?.security, [{ bearerAuth: [] }])
    assert.equal(document.components?.securitySchemes?.bearerAuth?.type, 'http')
    assert.equal(document.components?.securitySchemes?.bearerAuth?.scheme, 'bearer')
    assert.ok(Object.keys(document.paths).every((path) => !path.includes('token')))
  })

  it('filters a period and repeated tags', async () => {
    const { app, headers } = await setup()
    await app.request('/logs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'both', start: earlier, tags: ['a', 'b'] }),
    })
    await app.request('/logs', {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'one', start: earlier, tags: ['a'] }),
    })
    const response = await app.request('/logs?from=2024-06-01T00:00:00.000Z&to=2024-06-02T00:00:00.000Z&tag=a&tag=b', {
      headers,
    })
    assert.equal(response.status, 200)
    const body = (await response.json()) as Array<{ name: string }>
    assert.deepEqual(body.map((entry) => entry.name), ['both'])
  })
})
