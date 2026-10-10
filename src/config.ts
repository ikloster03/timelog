export type AppConfig = {
  databaseUrl: string
  port: number
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required')
  }

  const rawPort = env.PORT
  const port = rawPort === undefined || rawPort === '' ? 3000 : Number(rawPort)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }

  return { databaseUrl, port }
}
