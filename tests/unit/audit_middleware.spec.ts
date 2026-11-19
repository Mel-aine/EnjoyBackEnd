import { test } from '@japa/runner'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import ts from 'typescript'
import {
  getAuditContext,
  redactAuditValue,
  withAuditContext,
} from '../../app/services/audit_context.js'

async function isolatedMiddleware(failAt = 0, enabled = true) {
  const records: any[] = []
  const diagnostics: any[] = []
  let writes = 0
  const db = {
    table() {
      return {
        async insert(record: any) {
          writes++
          if (writes === failAt) throw new Error('audit storage unavailable')
          records.push(record)
        },
      }
    },
  }
  const key = `http_test_${randomUUID()}`
  ;(globalThis as any)[key] = {
    randomUUID,
    db,
    getAuditContext,
    redactAuditValue,
    withAuditContext,
    auditEnabled: () => enabled,
    reportAuditFailure: (event: string, _error: unknown, details: any) =>
      diagnostics.push({ event, details }),
  }
  const source = await readFile(
    new URL('../../app/middleware/audit_context_middleware.ts', import.meta.url),
    'utf8'
  )
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const bindings = `const {randomUUID,db,getAuditContext,redactAuditValue,withAuditContext,auditEnabled,reportAuditFailure}=globalThis[${JSON.stringify(key)}];\n`
  try {
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(bindings + js.replace(/^import .+ from .+;\r?\n/gm, '')).toString('base64')}`
    )
    return { middleware: new module.default(), records, diagnostics, writes: () => writes }
  } finally {
    delete (globalThis as any)[key]
  }
}

function context(): any {
  return {
    auth: { user: null },
    params: { hotelId: 2 },
    route: { pattern: '/reservations/:id' },
    request: {
      method: () => 'POST',
      url: () => '/reservations/2831',
      ip: () => '127.0.0.1',
      header: () => 'test',
      input: (key: string) => (key === 'hotelId' ? 2 : undefined),
      body: () => ({ amount: 250000, password: 'private' }),
      qs: () => ({ token: 'private' }),
    },
    response: { header() {}, getStatus: () => 200 },
  }
}

test('HTTP audit links start and completion and retains the actor after logout', async () => {
  const { middleware, records } = await isolatedMiddleware()
  const ctx = context()
  const response = await middleware.handle(ctx, async () => {
    ctx.auth.user = { id: 23, fullName: 'Test User', hotelId: 2 }
    assert.equal(getAuditContext()?.actorId, 23)
    ctx.auth.user = null
    return 'completed'
  })
  assert.equal(response, 'completed')
  assert.equal(records[0].action, 'HTTP_ACTION_STARTED')
  assert.equal(records[1].action, 'HTTP_ACTION_COMPLETED')
  assert.equal(records[1].user_id, 23)
  assert.equal(records[1].hotel_id, 2)
  const start = JSON.parse(records[0].meta)
  const end = JSON.parse(records[1].meta)
  assert.equal(start.operationId, end.operationId)
  assert.equal(start.payload.password, '[REDACTED]')
  assert.equal(end.query.token, '[REDACTED]')
  assert.equal(end.path, '/reservations/:id')
})

test('HTTP audit completion failure does not hide the original validation error', async () => {
  const { middleware, diagnostics } = await isolatedMiddleware(2)
  const failure = Object.assign(new Error('validation failed'), { status: 422 })
  await assert.rejects(
    () =>
      middleware.handle(context(), async () => {
        throw failure
      }),
    (error) => error === failure
  )
  assert.equal(diagnostics[0].event, 'HTTP_AUDIT_COMPLETION_FAILED')
  assert.equal(diagnostics[0].details.status, 422)
})

test('HTTP action is not started when its initial audit cannot be persisted', async () => {
  const { middleware, diagnostics } = await isolatedMiddleware(1)
  let called = false
  await assert.rejects(
    () =>
      middleware.handle(context(), async () => {
        called = true
      }),
    /audit storage unavailable/
  )
  assert.equal(called, false)
  assert.equal(diagnostics[0].event, 'HTTP_AUDIT_START_FAILED')
})

test('disabled HTTP audit performs no database writes', async () => {
  const { middleware, writes } = await isolatedMiddleware(0, false)
  assert.equal(await middleware.handle(context(), async () => 'completed'), 'completed')
  assert.equal(writes(), 0)
})
