import vine from '@vinejs/vine'

export const syncPushValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().minLength(1).maxLength(64),
    lastSyncVersion: vine.number().min(0).optional().default(0),
    operations: vine.array(
      vine.object({
        operationId: vine.string().minLength(1).maxLength(64),
        operationType: vine.enum(['create', 'update', 'delete'] as const),
        resourceType: vine.enum([
          'reservation', 'guest', 'room', 'folio', 'folio_transaction',
          'room_type', 'rate_type', 'room_rate', 'extra_charge',
        ] as const),
        resourceId: vine.number().positive().optional(),
        payload: vine.object({}).allowUnknownProperties(),
        clientTimestamp: vine.string().regex(/^\d{4}-\d{2}-\d{2}T/),
        priority: vine.number().min(0).max(10).optional().default(0),
      })
    ).maxLength(100),
  })
)

export const syncPullValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().minLength(1).maxLength(64),
    lastSyncVersion: vine.number().min(0).optional().default(0),
    resourceTypes: vine.array(vine.string()).minLength(1).maxLength(20).optional(),
  })
)

export const syncInitialLoadValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().minLength(1).maxLength(64),
    dateFrom: vine.string().regex(/^\d{4}-\d{2}-\d{2}(T|$)/).optional(),
  })
)

export const syncResolveConflictValidator = vine.compile(
  vine.object({
    resolution: vine.enum(['client_wins', 'server_wins', 'merged'] as const),
  })
)
