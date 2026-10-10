import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { Journal } from '../src/journal/journal.ts'
import { hashSecret, Tokens } from '../src/tokens/tokens.ts'
import { runCli } from '../src/tokens/cli.ts'
import { createApp } from '../src/http/app.ts'
import { createMemoryJournalStore, createMemoryTokenStore } from './memory.ts'

function tokens() {
  return new Tokens(createMemoryTokenStore(), () => new Date('2024-06-01T12:00:00.000Z'))
}

describe('tokens', () => {
  it('prints the secret only from token create', async () => {
    const access = tokens()
    const created = await runCli(['token', 'create'], access)
    assert.equal(created.code, 0)
    const secret = created.stdout.match(/^secret: (.+)$/m)?.[1]
    const id = created.stdout.match(/^id: (.+)$/m)?.[1]
    assert.ok(secret)
    assert.ok(id)
    assert.equal(secret.slice(0, 8).length, 8)

    const listed = await runCli(['token', 'list'], access)
    assert.equal(listed.stdout.includes(secret), false)
    assert.equal(listed.stdout.includes(hashSecret(secret)), false)
    assert.equal(listed.stdout.includes(id), true)
    assert.equal(listed.stdout.includes(secret.slice(0, 8)), true)
    assert.equal(listed.stdout.includes('hash:'), false)

    const again = await runCli(['token', 'create'], access)
    const nextSecret = again.stdout.match(/^secret: (.+)$/m)?.[1]
    assert.ok(nextSecret)
    assert.notEqual(nextSecret, secret)
    assert.equal(again.stdout.includes(secret), false)
  })

  it('rejects an unknown id and a second revoke without changing the first revocation time', async () => {
    const access = tokens()
    const created = await runCli(['token', 'create'], access)
    const id = created.stdout.match(/^id: (.+)$/m)?.[1]
    assert.ok(id)

    const missing = await runCli(['token', 'revoke', randomUUID()], access)
    assert.equal(missing.code, 1)
    assert.match(missing.stderr, /token not found/)
    assert.equal((await access.list()).length, 1)
    assert.equal((await access.list())[0]?.revokedAt, null)

    const revoked = await runCli(['token', 'revoke', id], access)
    assert.equal(revoked.code, 0)
    const revokedAt = (await access.list())[0]?.revokedAt?.toISOString()
    const second = await runCli(['token', 'revoke', id], access)
    assert.equal(second.code, 1)
    assert.match(second.stderr, /token already revoked/)
    assert.equal((await access.list())[0]?.revokedAt?.toISOString(), revokedAt)
  })

  it('lets two tokens see one journal and keeps logs after revoke', async () => {
    const access = tokens()
    const first = await access.create()
    const second = await access.create()
    const logs = new Journal(createMemoryJournalStore())
    const app = createApp({ journal: logs, tokens: access })

    const created = await app.request('/logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${first.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'shared' }),
    })
    assert.equal(created.status, 201)

    const seen = await app.request('/logs', {
      headers: { authorization: `Bearer ${second.secret}` },
    })
    assert.equal(seen.status, 200)
    const body = (await seen.json()) as Array<{ name: string }>
    assert.equal(body[0]?.name, 'shared')

    await access.revoke(first.id)
    const rejected = await app.request('/logs', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${first.secret}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'nope' }),
    })
    assert.equal(rejected.status, 401)
    const after = (await (await app.request('/logs', {
      headers: { authorization: `Bearer ${second.secret}` },
    })).json()) as Array<{ name: string }>
    assert.deepEqual(after.map((entry) => entry.name), ['shared'])
    assert.equal(await access.isActive('missing-secret'), false)
    assert.equal(await access.isActive(first.secret), false)
  })
})
