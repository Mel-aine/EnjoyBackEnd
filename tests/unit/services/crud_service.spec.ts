import { test } from '@japa/runner'
import CrudService from '#services/crud_service'
import * as LoggerSvc from '#services/logger_service'

class FakeRecord {
  id: number
  name?: string
  hotelId?: number
  deleted = false
  private data: any
  constructor(data: any) {
    this.data = { ...data }
    this.id = data.id
    this.name = data.name
    this.hotelId = data.hotelId ?? data.hotel_id
  }
  toJSON() {
    return { id: this.id, name: this.name, hotelId: this.hotelId, ...this.data }
  }
  merge(update: any) {
    Object.assign(this, update)
    Object.assign(this.data, update)
  }
  async save() {
    return this
  }
  async delete() {
    this.deleted = true
    return this
  }
}

class FakeQueryBuilder {
  private conditions: Array<{ key: string; value: any }> = []
  private selected: string[] = []
  where(key: any, value?: any) {
    if (typeof key === 'object') {
      Object.entries(key).forEach(([k, v]) => this.conditions.push({ key: k, value: v }))
    } else {
      this.conditions.push({ key, value })
    }
    return this
  }
  select(...fields: string[]) {
    this.selected = fields
    return this
  }
  first() {
    const match = FakeModel.store.find((r: FakeRecord) =>
      this.conditions.every((c) => (r as any)[c.key] === c.value)
    )
    if (!match) return null
    if (this.selected.length === 0) return match
    const obj: any = {}
    for (const f of this.selected) obj[f] = (match as any)[f]
    return obj
  }
  preload() { return this }
  whereIn() { return this }
  limit() { return this }
}

class FakeModel {
  static name = 'FakeModel'
  static store: FakeRecord[] = []
  static nextId = 1
  static reset() {
    this.store = []
    this.nextId = 1
  }
  static async create(data: any) {
    const record = new FakeRecord({ ...data, id: this.nextId++ })
    this.store.push(record)
    return record
  }
  static async find(id: number) {
    return this.store.find((r) => r.id === id) || null
  }
  static query() {
    return new FakeQueryBuilder()
  }
}

test.group('CrudService', (group) => {
  group.each.setup(() => {
    FakeModel.reset()
  })

  test('getModelName and getModel return expected values', ({ assert }) => {
    const svc = new (CrudService as any)(FakeModel)
    assert.equal(svc.getModelName(), 'FakeModel')
    assert.strictEqual(svc.getModel(), FakeModel)
  })

  test('create logs when actorId provided', async ({ assert }) => {
    const svc = new (CrudService as any)(FakeModel)
    const logs: any[] = []
    const originalLog = LoggerSvc.default.log
    const originalExtract = LoggerSvc.default.extractChanges
    try {
      LoggerSvc.default.log = async (payload: any) => { logs.push(payload) }
      LoggerSvc.default.extractChanges = () => ({ name: { old: null, new: 'Alpha' } })

      const item = await svc.create({ name: 'Alpha', hotelId: 7 }, 42, 7)
      assert.exists(item)
      assert.equal(item.name, 'Alpha')
      assert.isAbove(item.id, 0)

      assert.lengthOf(logs, 1)
      const log = logs[0]
      assert.equal(log.actorId, 42)
      assert.equal(log.action, 'CREATE')
      assert.equal(log.entityType, 'FakeModel')
      assert.equal(log.entityId, item.id)
      assert.equal(log.hotelId, 7)
      assert.match(log.description, /FakeModel #\d+ created\./)
      assert.deepEqual(log.changes, { name: { old: null, new: 'Alpha' } })
    } finally {
      LoggerSvc.default.log = originalLog
      LoggerSvc.default.extractChanges = originalExtract
    }
  })

  test('update logs when there are changes and skips when none', async ({ assert }) => {
    const svc = new (CrudService as any)(FakeModel)
    const item = await FakeModel.create({ name: 'Alpha', hotelId: 7 })
    const logs: any[] = []
    const originalLog = LoggerSvc.default.log
    const originalExtract = LoggerSvc.default.extractChanges
    try {
      LoggerSvc.default.log = async (payload: any) => { logs.push(payload) }
      // First, simulate changes
      LoggerSvc.default.extractChanges = (oldData: any, newData: any) => {
        return oldData.name !== newData.name ? { name: { old: oldData.name, new: newData.name } } : {}
      }

      const updated = await svc.update(item.id, { name: 'Beta' }, 3, 7)
      assert.exists(updated)
      assert.equal(updated.name, 'Beta')

      assert.lengthOf(logs, 1)
      assert.equal(logs[0].action, 'UPDATE')

      // Now, simulate no changes
      const beforeCount = logs.length
      const again = await svc.update(item.id, { name: 'Beta' }, 3, 7)
      assert.exists(again)
      assert.equal(again.name, 'Beta')
      assert.lengthOf(logs, beforeCount) // no new log
    } finally {
      LoggerSvc.default.log = originalLog
      LoggerSvc.default.extractChanges = originalExtract
    }
  })

  test('delete logs and marks record deleted', async ({ assert }) => {
    const svc = new (CrudService as any)(FakeModel)
    const item = await FakeModel.create({ name: 'Gamma', hotelId: 9 })
    const logs: any[] = []
    const originalLog = LoggerSvc.default.log
    try {
      LoggerSvc.default.log = async (payload: any) => { logs.push(payload) }
      const deleted = await svc.delete(item.id, 99, 9)
      assert.exists(deleted)
      assert.equal((deleted as any).deleted, true)
      assert.lengthOf(logs, 1)
      assert.equal(logs[0].action, 'DELETE')
      assert.equal(logs[0].entityId, item.id)
      assert.equal(logs[0].hotelId, 9)
    } finally {
      LoggerSvc.default.log = originalLog
    }
  })
})