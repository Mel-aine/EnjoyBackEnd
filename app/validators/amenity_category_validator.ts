import vine from '@vinejs/vine'

export const createAmenityCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2),
    description: vine.string().trim().optional(),
    service_id: vine.number().positive(),
    status: vine.enum(['active', 'inactive', 'archived']).optional(),
    source_type: vine.enum(['External', 'Internal']),
    external_system_id: vine
      .string()
      .trim()
      .minLength(1).optional()
  })
)

export const updateAmenityCategoryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(2).optional(),
    description: vine.string().trim().optional(),
    service_id: vine.number().positive().optional(),
    status: vine.enum(['active', 'inactive', 'archived']).optional(),
    source_type: vine.enum(['External', 'Internal']).optional(),
    external_system_id: vine
      .string()
      .trim()
      .minLength(1).optional()
  })
)
