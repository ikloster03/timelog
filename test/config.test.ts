import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { readConfig } from '../src/config.ts'

describe('config', () => {
  it('requires DATABASE_URL and defaults PORT to 3000', () => {
    assert.throws(() => readConfig({}), /DATABASE_URL is required/)
    assert.deepEqual(readConfig({ DATABASE_URL: 'postgres://localhost/timelog' }), {
      databaseUrl: 'postgres://localhost/timelog',
      port: 3000,
    })
    assert.equal(readConfig({ DATABASE_URL: 'postgres://localhost/timelog', PORT: '4000' }).port, 4000)
    assert.throws(() => readConfig({ DATABASE_URL: 'postgres://localhost/timelog', PORT: 'nope' }), /PORT/)
  })
})
