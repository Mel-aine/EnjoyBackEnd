import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'
import { installAuditQueryContext } from '#services/audit_query_context'
import { auditEnabled } from '#services/audit_enabled'

if (auditEnabled()) installAuditQueryContext()

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD'),
        database: env.get('DB_DATABASE'),
      },
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
      pool: {
        min: 2,
        max: 20, // Increase this value (e.g., from 10 to 20, 30, or more)
      },
    },
  },
})

export default dbConfig
