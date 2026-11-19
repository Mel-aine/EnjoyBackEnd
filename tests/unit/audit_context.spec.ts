import { test } from '@japa/runner'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  auditChanges,
  annotateAuditQuery,
  getAuditContext,
  redactAuditValue,
  withAuditContext,
} from '../../app/services/audit_context.js'
import { installAuditQueryContext } from '../../app/services/audit_query_context.js'

test('audit isolates concurrent users and resolves authentication lazily', async () => {
  const operations = [23, 57, 21].map(async (actorId) => {
    let authenticated = false
    return withAuditContext(
      () => ({
        operationId: String(actorId),
        source: 'http',
        actorId: authenticated ? actorId : null,
      }),
      async () => {
        assert.equal(getAuditContext()?.actorId, null)
        authenticated = true
        await new Promise((resolve) => setTimeout(resolve, 2))
        assert.equal(getAuditContext()?.actorId, actorId)
      }
    )
  })
  await Promise.all(operations)
  assert.equal(getAuditContext(), undefined)
})

test('audit masks nested credentials and identity documents without modifying input', () => {
  const original = {
    amount: 250000,
    rooms: [{ room_rate: 125000, password: 'secret' }],
    authorization: 'Bearer secret',
    passportNumber: 'private',
    config: { service_key: 'secret', hash: 'secret' },
  }
  const masked = redactAuditValue(original)
  assert.equal(masked.amount, 250000)
  assert.equal(masked.rooms[0].room_rate, 125000)
  assert.equal(masked.rooms[0].password, '[REDACTED]')
  assert.equal(masked.passportNumber, '[REDACTED]')
  assert.equal(masked.config.service_key, '[REDACTED]')
  assert.equal(masked.config.hash, '[REDACTED]')
  assert.equal(original.rooms[0].password, 'secret')
})

test('audit change comparison includes removed fields and ignores equal nested data', () => {
  assert.deepEqual(
    auditChanges({ amount: 125000, removed: true, nested: [1] }, { amount: 80000, nested: [1] }),
    {
      amount: { old: 125000, new: 80000 },
      removed: { old: true, new: null },
    }
  )
})

test('audit SQL context cannot escape its comment or leak URL query parameters', () => {
  const sql = 'update reservations set total_amount=$1 where id=$2'
  const annotated = annotateAuditQuery(sql, {
    operationId: 'test',
    source: 'http',
    actorName: '*/ DELETE FROM reservations; --',
    path: '/reservations?token=private',
  })
  const encoded = annotated.match(/^\/\*enjoy_audit:([A-Za-z0-9+/=]+)\*\/ /)![1]
  const context = JSON.parse(Buffer.from(encoded, 'base64').toString())
  assert.equal(context.path, '/reservations')
  assert.equal(annotated.slice(annotated.indexOf('*/ ') + 3), sql)
  assert.equal(annotateAuditQuery(sql), sql)
})

test('existing Knex PostgreSQL adapter preserves bindings, results and transaction clones', async () => {
  installAuditQueryContext()
  installAuditQueryContext()
  const require = createRequire(import.meta.url)
  const Client = require('knex/lib/dialects/postgres/index.js')
  const client = new Client({ client: 'pg' })
  const transactionClient = Object.create(client.constructor.prototype)
  const submitted: any[] = []
  const connection = {
    query(query: any, callback: any) {
      submitted.push(query)
      callback(null, { command: 'UPDATE', rowCount: 1, rows: [{ id: 2831 }] })
    },
  }
  await withAuditContext({ operationId: 'operation-23', source: 'http', actorId: 23 }, async () => {
    const result = await transactionClient._query(connection, {
      sql: 'UPDATE reservations SET total_amount=$1 WHERE id=$2 RETURNING id',
      bindings: [80000, 2831],
    })
    assert.equal(result.response.rows[0].id, 2831)
    assert.deepEqual(submitted[0].values, [80000, 2831])
    assert.ok(submitted[0].text.startsWith('/*enjoy_audit:'))
  })
  await client._query(connection, { sql: 'SELECT 1', bindings: [] })
  assert.equal(submitted[1].text, 'SELECT 1')
  await client.destroy()
})

test('failed SQL remains observable outside the rolled-back transaction without leaking bindings', async () => {
  installAuditQueryContext()
  const require = createRequire(import.meta.url)
  const Client = require('knex/lib/dialects/postgres/index.js')
  const client = new Client({ client: 'pg' })
  const failure = Object.assign(new Error('private SQL or password'), { code: '23505' })
  const records: string[] = []
  const original = console.error
  console.error = (value) => {
    records.push(String(value))
  }
  try {
    await withAuditContext(
      { operationId: 'failed-operation', source: 'http', actorId: 23 },
      async () => {
        await assert.rejects(
          () =>
            client._query(
              {
                query(_query: any, callback: any) {
                  callback(failure)
                },
              },
              { sql: 'UPDATE users SET password=$1', bindings: ['private'] }
            ),
          (error) => error === failure
        )
      }
    )
    assert.equal(records.length, 1)
    assert.equal(JSON.parse(records[0]).operationId, 'failed-operation')
    assert.equal(JSON.parse(records[0]).errorCode, '23505')
    assert.equal(records[0].includes('private'), false)
  } finally {
    console.error = original
    await client.destroy()
  }
})
