import { test } from '@japa/runner'

import AuditTrailService from '#services/audit_trail_service'
import * as ActivityLogMod from '#models/activity_log'

class FakeBuilder {
  calls: Array<{ method: string; args: any[] }> = []
  where(...args: any[]) {
    this.calls.push({ method: 'where', args })
    return this
  }
  whereIn(...args: any[]) {
    this.calls.push({ method: 'whereIn', args })
    return this
  }
  whereBetween(...args: any[]) {
    this.calls.push({ method: 'whereBetween', args })
    return this
  }
  preload(...args: any[]) {
    this.calls.push({ method: 'preload', args })
    return this
  }
  orderBy(...args: any[]) {
    this.calls.push({ method: 'orderBy', args })
    return this
  }
  paginate(...args: any[]) {
    this.calls.push({ method: 'paginate', args })
    return Promise.resolve({ page: args[0], perPage: args[1] })
  }
}

test.group('AuditTrailService', () => {
  test('getAuditTrail throws when hotelId missing', async ({ assert }) => {
    await assert.rejects(
      () => AuditTrailService.getAuditTrail({} as any),
      /Hotel ID is required/
    )
  })

  test('getAuditTrail builds query with provided filters', async ({ assert }) => {
    const builder = new FakeBuilder()
    // Patch the query method on the actual ActivityLog export so the service uses our FakeBuilder
    const originalQuery = (ActivityLogMod as any).default.query
    ;(ActivityLogMod as any).default.query = () => builder

    const result = await AuditTrailService.getAuditTrail({
      hotelId: 1,
      entityIds: [2, 3],
      entityType: 'Reservation',
      startDate: '2020-01-01',
      endDate: '2020-02-01',
      userId: 5,
      action: 'create',
      sortBy: 'createdAt',
      order: 'asc',
      page: 2,
      perPage: 10,
    })

    // Result should be the paginate return
    assert.deepEqual(result, { page: 2, perPage: 10 })

    const methods = builder.calls.map((c) => c.method)
    assert.includeMembers(methods, [
      'whereIn',
      'where',
      'whereBetween',
      'preload',
      'orderBy',
      'paginate',
    ])

    // Check specific calls
    const whereInEntity = builder.calls.find((c) => c.method === 'whereIn' && c.args[0] === 'entity_id')
    assert.exists(whereInEntity)
    const whereEntityType = builder.calls.find((c) => c.method === 'where' && c.args[0] === 'entityType')
    assert.exists(whereEntityType)
    const whereBetweenDate = builder.calls.find((c) => c.method === 'whereBetween' && c.args[0] === 'createdAt')
    assert.exists(whereBetweenDate)
    const whereUserId = builder.calls.find((c) => c.method === 'where' && c.args[0] === 'userId')
    assert.exists(whereUserId)
    const whereAction = builder.calls.find((c) => c.method === 'where' && c.args[0] === 'action')
    assert.exists(whereAction)
    // Restore original method
    ;(ActivityLogMod as any).default.query = originalQuery
  })
})