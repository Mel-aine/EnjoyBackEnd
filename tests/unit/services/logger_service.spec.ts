import { test } from '@japa/runner'

import LoggerService from '#services/logger_service'
import * as UserMod from '#models/user'
import * as ActivityLogMod from '#models/activity_log'

// Helper: create a minimal HttpContext-like request object
const fakeCtx: any = {
  request: {
    ip: () => '127.0.0.1',
    header: (name: string) => (name.toLowerCase() === 'user-agent' ? 'UnitTest' : undefined),
  },
}

test.group('LoggerService', () => {
  test('extractChanges returns diffs for changed fields', ({ assert }) => {
    const oldData = { a: 1, b: 'x', c: true }
    const newData = { a: 2, b: 'x', c: false }
    const changes = LoggerService.extractChanges(oldData, newData)
    assert.deepEqual(changes, {
      a: { old: 1, new: 2 },
      c: { old: true, new: false },
    })
  })

  test('log() writes a single activity with ctx metadata', async ({ assert }) => {
    const created: any[] = []
    // Patch User.find and ActivityLog.create on actual exports
    const originalUserFind = (UserMod as any).default.find
    const originalCreate = (ActivityLogMod as any).default.create
    ;(UserMod as any).default.find = async (id: number) => ({ id, firstName: 'Alice' })
    ;(ActivityLogMod as any).default.create = async (payload: any) => {
      created.push(payload)
      return payload
    }

    await LoggerService.log({
      actorId: 1,
      action: 'CREATE',
      entityType: 'TestEntity',
      entityId: 123,
      description: 'Created entity',
      changes: { field: { old: 'a', new: 'b' } },
      hotelId: 99,
      ctx: fakeCtx,
    })

    assert.lengthOf(created, 1)
    assert.equal(created[0].username, 'Alice')
    assert.equal(created[0].ipAddress, '127.0.0.1')
    assert.equal(created[0].userAgent, 'UnitTest')
    assert.equal(created[0].hotelId, 99)
    // restore
    ;(UserMod as any).default.find = originalUserFind
    ;(ActivityLogMod as any).default.create = originalCreate
  })

  test('bulkLog() writes multiple activities with actor resolution', async ({ assert }) => {
    const createdMany: any[] = []
    const originalCreateMany = (ActivityLogMod as any).default.createMany
    const originalUserQuery = (UserMod as any).default.query
    ;(ActivityLogMod as any).default.createMany = async (rows: any[]) => {
      createdMany.push(rows)
      return rows
    }
    ;(UserMod as any).default.query = () => ({
      whereIn: (_field: string, ids: number[]) =>
        Promise.resolve(ids.map((id) => ({ id, firstName: `User${id}` }))),
    })

    const logs = [
      {
        actorId: 1,
        action: 'UPDATE',
        entityType: 'Foo',
        entityId: 7,
        description: 'Updated',
        changes: { x: { old: 1, new: 2 } },
        hotelId: 50,
        ctx: fakeCtx,
      },
      {
        actorId: 2,
        action: 'DELETE',
        entityType: 'Bar',
        entityId: 8,
        description: 'Deleted',
        ctx: fakeCtx,
      },
    ]

    await LoggerService.bulkLog(logs as any)

    assert.lengthOf(createdMany, 1)
    assert.lengthOf(createdMany[0], 2)
    assert.equal(createdMany[0][0].username, 'User1')
    assert.equal(createdMany[0][1].username, 'User2')
    assert.equal(createdMany[0][0].ipAddress, '127.0.0.1')
    // restore
    ;(ActivityLogMod as any).default.createMany = originalCreateMany
    ;(UserMod as any).default.query = originalUserQuery
  })

  test('logActivity() honors trx option when provided', async ({ assert }) => {
    let capturedOptions: any = null
    let capturedPayload: any = null
    const originalCreate = (ActivityLogMod as any).default.create
    const originalUserFind = (UserMod as any).default.find
    ;(ActivityLogMod as any).default.create = async (payload: any, options?: any) => {
      capturedPayload = payload
      capturedOptions = options || null
      return payload
    }
    ;(UserMod as any).default.find = async (id: number) => ({ id, firstName: 'Bob' })

    await LoggerService.logActivity(
      {
        userId: 3,
        action: 'LOGIN',
        resourceType: 'Auth',
        resourceId: 0,
        description: 'User login',
        ipAddress: '10.0.0.1',
        userAgent: 'UnitTest',
        hotelId: 10,
      },
      'trx'
    )

    assert.equal(capturedOptions?.client, 'trx')
    assert.equal(capturedPayload.username, 'Bob')
    assert.equal(capturedPayload.userAgent, 'UnitTest')
    assert.equal(capturedPayload.hotelId, 10)
    // restore
    ;(ActivityLogMod as any).default.create = originalCreate
    ;(UserMod as any).default.find = originalUserFind
  })
})