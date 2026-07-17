import vine from '@vinejs/vine'

export const syncPushValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().minLength(1).maxLength(64),
    lastSyncVersion: vine.number().min(0).optional(),
    operations: vine.array(
      vine.object({
        operationId: vine.string().minLength(1).maxLength(64),
        operationType: vine.enum(['create', 'update', 'delete'] as const),
        resourceType: vine.enum([
          'reservation', 'guest', 'room', 'folio', 'folio_transaction',
          'room_type', 'rate_type', 'room_rate', 'extra_charge', 'booking_source', 'payment_method', 'tax_rate', 'discount', 'work_order', 'room_block', 'vip_status', 'black_list_reason', 'notification', 'announcement', 'business_source', 'market_code', 'reservation_type',
        ] as const),
        resourceId: vine.number().positive().optional(),
        payload: vine.object({}).allowUnknownProperties(),
        clientTimestamp: vine.string().regex(/^\d{4}-\d{2}-\d{2}T/),
        priority: vine.number().min(0).max(10).optional(),
      })
    ).maxLength(100),
  })
)

export const syncPullValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    deviceId: vine.string().minLength(1).maxLength(64),
    lastSyncVersion: vine.number().min(0).optional(),
    resourceTypes: vine.array(vine.string()).minLength(1).maxLength(30).optional(),
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
