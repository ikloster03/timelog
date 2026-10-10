import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Journal, JournalError } from '../src/journal/journal.ts'
import { createMemoryJournalStore } from './memory.ts'

const start = new Date('2024-01-01T00:00:00.000Z')
const later = new Date('2024-01-02T00:00:00.000Z')
const clock = () => new Date('2024-06-01T12:00:00.000Z')

function journal() {
  return new Journal(createMemoryJournalStore(), clock)
}

describe('journal', () => {
  it('keeps an empty end and allows two open logs with the same name', async () => {
    const logs = journal()
    const first = await logs.create({ name: 'work' })
    const second = await logs.create({ name: 'work' })
    assert.equal(first.end, null)
    assert.equal(second.end, null)
    assert.notEqual(first.id, second.id)
    assert.equal((await logs.list({ open: true })).length, 2)
  })

  it('does not reject overlapping logs', async () => {
    const logs = journal()
    await logs.create({ name: 'a', start, end: later })
    const overlapping = await logs.create({
      name: 'a',
      start: new Date('2024-01-01T12:00:00.000Z'),
      end: new Date('2024-01-03T00:00:00.000Z'),
    })
    assert.equal(overlapping.name, 'a')
  })

  it('stores tags, comment, and start, and defaults the rest', async () => {
    const logs = journal()
    const entry = await logs.create({
      name: 'api',
      tags: ['API', 'api', 'API'],
      comment: 'note',
      start,
    })
    assert.deepEqual(entry.tags, ['API', 'api', 'API'])
    assert.equal(entry.comment, 'note')
    assert.equal(entry.start.toISOString(), start.toISOString())

    const defaults = await logs.create({ name: 'bare', start })
    assert.deepEqual(defaults.tags, [])
    assert.equal(defaults.comment, null)
  })

  it('rejects a blank name and leaves the journal unchanged', async () => {
    const logs = journal()
    await logs.create({ name: 'kept', start })
    await assert.rejects(() => logs.create({ name: '   ' }), (error: unknown) => {
      assert.ok(error instanceof JournalError)
      assert.equal(error.status, 400)
      return true
    })
    assert.equal((await logs.list()).length, 1)
  })

  it('uses the server clock when start is omitted and when stop has no end', async () => {
    const logs = journal()
    const opened = await logs.start({ name: 'now' })
    assert.equal(opened.start.toISOString(), clock().toISOString())
    assert.equal(opened.end, null)

    const stopped = await logs.stop(opened.id)
    assert.equal(stopped.end?.toISOString(), clock().toISOString())
  })

  it('rejects an end before the start and does not save the log', async () => {
    const logs = journal()
    await assert.rejects(() => logs.create({ name: 'bad', start: later, end: start }), JournalError)
    assert.equal((await logs.list()).length, 0)

    const entry = await logs.create({ name: 'ok', start, end: later })
    await assert.rejects(() => logs.update(entry.id, { end: new Date('2023-12-31T00:00:00.000Z') }), JournalError)
    assert.equal((await logs.get(entry.id)).end?.toISOString(), later.toISOString())
  })

  it('includes an open log in a later period and excludes a closed log that ended before it', async () => {
    const logs = journal()
    const open = await logs.create({ name: 'open', start })
    await logs.create({ name: 'closed', start, end: later })
    const from = new Date('2024-06-01T00:00:00.000Z')
    const to = new Date('2024-06-02T00:00:00.000Z')
    const listed = await logs.list({ from, to })
    assert.deepEqual(listed.map((entry) => entry.id), [open.id])
  })

  it('returns only open logs and requires every tag', async () => {
    const logs = journal()
    await logs.create({ name: 'open', start, tags: ['a', 'b'] })
    await logs.create({ name: 'closed', start, end: later, tags: ['a', 'b'] })
    await logs.create({ name: 'partial', start, tags: ['a'] })
    const opened = await logs.list({ open: true })
    assert.deepEqual(opened.map((entry) => entry.name).sort(), ['open', 'partial'])
    const tagged = await logs.list({ tags: ['a', 'b'] })
    assert.deepEqual(tagged.map((entry) => entry.name).sort(), ['closed', 'open'])
    const caseSensitive = await logs.list({ tags: ['A'] })
    assert.equal(caseSensitive.length, 0)
  })

  it('sorts by start and then by id', async () => {
    const logs = journal()
    const second = await logs.create({ name: 'second', start: later })
    const first = await logs.create({ name: 'first', start })
    const same = await logs.create({ name: 'same', start })
    const listed = await logs.list()
    const expected = [first, same, second].sort((left, right) => {
      const byStart = left.start.getTime() - right.start.getTime()
      if (byStart !== 0) return byStart
      return left.id < right.id ? -1 : 1
    })
    assert.deepEqual(
      listed.map((entry) => entry.id),
      expected.map((entry) => entry.id),
    )
  })

  it('updates only the fields that were passed and can reopen a log', async () => {
    const logs = journal()
    const first = await logs.create({ name: 'one', start, tags: ['a'] })
    const second = await logs.create({ name: 'two', start })
    await logs.update(first.id, { end: later })
    assert.equal((await logs.get(second.id)).end, null)

    const renamed = await logs.update(first.id, { name: 'renamed' })
    assert.equal(renamed.name, 'renamed')
    assert.deepEqual(renamed.tags, ['a'])
    assert.equal(renamed.end?.toISOString(), later.toISOString())

    const reopened = await logs.update(first.id, { end: null })
    assert.equal(reopened.end, null)
  })

  it('reports a missing id on read, update, and a second delete', async () => {
    const logs = journal()
    const entry = await logs.create({ name: 'gone', start })
    await logs.delete(entry.id)
    await assert.rejects(() => logs.get(entry.id), (error: unknown) => {
      assert.ok(error instanceof JournalError)
      assert.equal(error.status, 404)
      return true
    })
    await assert.rejects(() => logs.delete(entry.id), JournalError)
    await assert.rejects(() => logs.update(entry.id, { name: 'nope' }), JournalError)
  })
})
