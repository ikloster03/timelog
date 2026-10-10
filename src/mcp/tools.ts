import type { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod'
import {
  Journal,
  JournalError,
  toLogJson,
  type CreateLogInput,
  type LogJson,
  type UpdateLogInput,
} from '../journal/journal.js'

export const journalToolNames = [
  'start_log',
  'stop_log',
  'create_log',
  'update_log',
  'delete_log',
  'list_open_logs',
  'list_logs',
] as const

const instant = z.iso.datetime({ offset: true })

const fields = {
  name: z.string().describe('Non-blank log name'),
  start: instant.optional().describe('Start instant. Omitted start uses the server clock'),
  end: instant.nullable().optional().describe('End instant. Null clears the end and reopens the log'),
  tags: z.array(z.string()).optional().describe('Tags. Order and duplicates are kept'),
  comment: z.string().nullable().optional().describe('Comment. Null clears it'),
}

function toolError(error: unknown) {
  const message = error instanceof JournalError ? error.message : 'internal error'
  if (!(error instanceof JournalError)) console.error(error)
  return {
    isError: true as const,
    content: [{ type: 'text' as const, text: message }],
  }
}

function entryResult(entry: LogJson) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(entry) }],
    structuredContent: entry,
  }
}

function listResult(entries: LogJson[]) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(entries) }],
    structuredContent: { logs: entries },
  }
}

function createInput(args: {
  name: string
  start?: string
  end?: string | null
  tags?: string[]
  comment?: string | null
}): CreateLogInput {
  return {
    name: args.name,
    start: args.start === undefined ? undefined : new Date(args.start),
    end: args.end === undefined || args.end === null ? args.end : new Date(args.end),
    tags: args.tags,
    comment: args.comment,
  }
}

function updateInput(args: {
  name?: string
  start?: string
  end?: string | null
  tags?: string[]
  comment?: string | null
}): UpdateLogInput {
  const input: UpdateLogInput = {}
  if (args.name !== undefined) input.name = args.name
  if (args.start !== undefined) input.start = new Date(args.start)
  if (args.end !== undefined) input.end = args.end === null ? null : new Date(args.end)
  if (args.tags !== undefined) input.tags = args.tags
  if (args.comment !== undefined) input.comment = args.comment
  return input
}

export function registerJournalTools(server: McpServer, journal: Journal): void {
  server.registerTool(
    'start_log',
    {
      description: 'Create an open log. Omitted start uses the server clock.',
      inputSchema: z.object({
        name: fields.name,
        start: fields.start,
        tags: fields.tags,
        comment: fields.comment,
      }),
    },
    async (args) => {
      try {
        const entry = await journal.start({
          name: args.name,
          start: args.start === undefined ? undefined : new Date(args.start),
          tags: args.tags,
          comment: args.comment,
        })
        return entryResult(toLogJson(entry))
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'stop_log',
    {
      description: 'Set the end of one log by id. Omitted end uses the server clock.',
      inputSchema: z.object({
        id: z.uuid(),
        end: instant.optional().describe('End instant. Omitted end uses the server clock'),
      }),
    },
    async (args) => {
      try {
        const entry = await journal.stop(args.id, args.end === undefined ? undefined : new Date(args.end))
        return entryResult(toLogJson(entry))
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'create_log',
    {
      description: 'Create a log, including one that is already closed.',
      inputSchema: z.object({
        name: fields.name,
        start: fields.start,
        end: instant.nullable().optional().describe('End instant. Omit or pass null to leave the log open'),
        tags: fields.tags,
        comment: fields.comment,
      }),
    },
    async (args) => {
      try {
        return entryResult(toLogJson(await journal.create(createInput(args))))
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'update_log',
    {
      description: 'Change the given fields of a log. Pass end null to reopen it. Omitted fields stay as they are.',
      inputSchema: z.object({
        id: z.uuid(),
        name: fields.name.optional(),
        start: fields.start,
        end: fields.end,
        tags: fields.tags,
        comment: fields.comment,
      }),
    },
    async (args) => {
      try {
        return entryResult(toLogJson(await journal.update(args.id, updateInput(args))))
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'delete_log',
    {
      description: 'Delete a log by id.',
      inputSchema: z.object({ id: z.uuid() }),
    },
    async (args) => {
      try {
        await journal.delete(args.id)
        const body = { id: args.id, deleted: true }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(body) }],
          structuredContent: body,
        }
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'list_open_logs',
    {
      description: 'List logs whose end is empty.',
      inputSchema: z.object({}),
    },
    async () => {
      try {
        return listResult((await journal.list({ open: true })).map(toLogJson))
      } catch (error) {
        return toolError(error)
      }
    },
  )

  server.registerTool(
    'list_logs',
    {
      description:
        'List logs. The period is [from, to). An open log is included when its start is before to. Every tag must be present.',
      inputSchema: z.object({
        from: instant.optional(),
        to: instant.optional(),
        open: z.boolean().optional().describe('When true, only logs with an empty end'),
        tags: z.array(z.string()).optional().describe('Every tag must be present on the log'),
      }),
    },
    async (args) => {
      try {
        const entries = await journal.list({
          from: args.from === undefined ? undefined : new Date(args.from),
          to: args.to === undefined ? undefined : new Date(args.to),
          open: args.open,
          tags: args.tags,
        })
        return listResult(entries.map(toLogJson))
      } catch (error) {
        return toolError(error)
      }
    },
  )
}
