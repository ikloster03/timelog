import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { Journal, JournalError, toLogJson, type CreateLogInput, type UpdateLogInput } from '../journal/journal.js'
import { authorizeBearer } from '../tokens/auth.js'
import type { Tokens } from '../tokens/tokens.js'
import { mcpHandler } from '../mcp/http.js'

const ErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('Error')

const LogSchema = z
  .object({
    id: z.uuid(),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }).nullable(),
    name: z.string(),
    tags: z.array(z.string()),
    comment: z.string().nullable(),
  })
  .openapi('Log')

const CreateLogBody = z
  .object({
    name: z.string(),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).nullable().optional(),
    tags: z.array(z.string()).optional(),
    comment: z.string().nullable().optional(),
  })
  .openapi('CreateLog')

const UpdateLogBody = z
  .object({
    name: z.string().optional(),
    start: z.iso.datetime({ offset: true }).optional(),
    end: z.iso.datetime({ offset: true }).nullable().optional(),
    tags: z.array(z.string()).optional(),
    comment: z.string().nullable().optional(),
  })
  .openapi('UpdateLog')

const IdParams = z.object({
  id: z.uuid(),
})

const ListLogsQuery = z.object({
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  open: z.enum(['true', 'false']).optional(),
  tag: z.preprocess((value) => {
    if (value === undefined) return undefined
    return Array.isArray(value) ? value : [value]
  }, z.array(z.string()).optional()),
})

const errorResponses = {
  400: {
    description: 'The body breaks a journal rule',
    content: { 'application/json': { schema: ErrorSchema } },
  },
  401: {
    description: 'Missing, unknown, or revoked bearer token',
    content: { 'application/json': { schema: ErrorSchema } },
  },
  404: {
    description: 'Unknown log id',
    content: { 'application/json': { schema: ErrorSchema } },
  },
} as const

const bearer = [{ bearerAuth: [] }]

const createLogRoute = createRoute({
  method: 'post',
  path: '/logs',
  operationId: 'createLog',
  tags: ['logs'],
  security: bearer,
  request: {
    body: {
      content: { 'application/json': { schema: CreateLogBody } },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Created log',
      content: { 'application/json': { schema: LogSchema } },
    },
    ...errorResponses,
  },
})

const listLogsRoute = createRoute({
  method: 'get',
  path: '/logs',
  operationId: 'listLogs',
  tags: ['logs'],
  security: bearer,
  request: { query: ListLogsQuery },
  responses: {
    200: {
      description: 'Logs sorted by start, then id',
      content: { 'application/json': { schema: z.array(LogSchema) } },
    },
    ...errorResponses,
  },
})

const getLogRoute = createRoute({
  method: 'get',
  path: '/logs/{id}',
  operationId: 'getLog',
  tags: ['logs'],
  security: bearer,
  request: { params: IdParams },
  responses: {
    200: {
      description: 'Log',
      content: { 'application/json': { schema: LogSchema } },
    },
    ...errorResponses,
  },
})

const updateLogRoute = createRoute({
  method: 'patch',
  path: '/logs/{id}',
  operationId: 'updateLog',
  tags: ['logs'],
  security: bearer,
  request: {
    params: IdParams,
    body: {
      content: { 'application/json': { schema: UpdateLogBody } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Updated log',
      content: { 'application/json': { schema: LogSchema } },
    },
    ...errorResponses,
  },
})

const deleteLogRoute = createRoute({
  method: 'delete',
  path: '/logs/{id}',
  operationId: 'deleteLog',
  tags: ['logs'],
  security: bearer,
  request: { params: IdParams },
  responses: {
    204: { description: 'Deleted' },
    ...errorResponses,
  },
})

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  operationId: 'health',
  tags: ['health'],
  responses: {
    200: {
      description: 'The process is listening',
      content: {
        'application/json': {
          schema: z.object({ ok: z.literal(true) }).openapi('Health'),
        },
      },
    },
  },
})

const openApiInfo = {
  openapi: '3.1.0',
  info: {
    title: 'timelog',
    version: '1.0.0',
  },
} as const

function parseInstant(value: string): Date {
  return new Date(value)
}

function toCreateInput(body: z.infer<typeof CreateLogBody>): CreateLogInput {
  return {
    name: body.name,
    start: body.start === undefined ? undefined : parseInstant(body.start),
    end: body.end === undefined || body.end === null ? body.end : parseInstant(body.end),
    tags: body.tags,
    comment: body.comment,
  }
}

function toUpdateInput(body: z.infer<typeof UpdateLogBody>): UpdateLogInput {
  const input: UpdateLogInput = {}
  if (body.name !== undefined) input.name = body.name
  if (body.start !== undefined) input.start = parseInstant(body.start)
  if (body.end !== undefined) input.end = body.end === null ? null : parseInstant(body.end)
  if (body.tags !== undefined) input.tags = body.tags
  if (body.comment !== undefined) input.comment = body.comment
  return input
}

export type AppDeps = {
  journal: Journal
  tokens: Tokens
}

export function createApp(deps: AppDeps) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (result.success) return
      const message = result.error.issues.map((issue) => issue.message).join('; ')
      return c.json({ error: message || 'invalid request' }, 400)
    },
  })

  app.openAPIRegistry.registerComponent('securitySchemes', 'bearerAuth', {
    type: 'http',
    scheme: 'bearer',
  })

  app.use('/logs', async (c, next) => {
    if (!(await authorizeBearer(c.req.header('Authorization'), deps.tokens))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    await next()
  })
  app.use('/logs/*', async (c, next) => {
    if (!(await authorizeBearer(c.req.header('Authorization'), deps.tokens))) {
      return c.json({ error: 'unauthorized' }, 401)
    }
    await next()
  })

  app.openapi(createLogRoute, async (c) => {
    const entry = await deps.journal.create(toCreateInput(c.req.valid('json')))
    return c.json(toLogJson(entry), 201)
  })

  app.openapi(listLogsRoute, async (c) => {
    const query = c.req.valid('query')
    const entries = await deps.journal.list({
      from: query.from === undefined ? undefined : parseInstant(query.from),
      to: query.to === undefined ? undefined : parseInstant(query.to),
      open: query.open === 'true' ? true : undefined,
      tags: query.tag,
    })
    return c.json(entries.map(toLogJson), 200)
  })

  app.openapi(getLogRoute, async (c) => {
    const entry = await deps.journal.get(c.req.valid('param').id)
    return c.json(toLogJson(entry), 200)
  })

  app.openapi(updateLogRoute, async (c) => {
    const entry = await deps.journal.update(c.req.valid('param').id, toUpdateInput(c.req.valid('json')))
    return c.json(toLogJson(entry), 200)
  })

  app.openapi(deleteLogRoute, async (c) => {
    await deps.journal.delete(c.req.valid('param').id)
    return c.body(null, 204)
  })

  app.openapi(healthRoute, (c) => c.json({ ok: true as const }, 200))

  app.route(
    '/scalar',
    Scalar.serve({
      pageTitle: 'timelog',
      document: () => app.getOpenAPI31Document(openApiInfo),
    }),
  )

  app.all('/mcp', mcpHandler(deps))

  app.onError((error, c) => {
    if (error instanceof JournalError) {
      return c.json({ error: error.message }, error.status)
    }
    console.error(error)
    return c.json({ error: 'internal error' }, 500)
  })

  return app
}
