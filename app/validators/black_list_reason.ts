import vine from '@vinejs/vine'

export const createBlackListReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    reason: vine.string().trim().minLength(1).maxLength(255),
    category: vine.string().trim().minLength(1).maxLength(255),
    severity: vine.enum(['High', 'Medium', 'Low']),
    description: vine.string().trim().optional(),
  })
)

export const updateBlackListReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    reason: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.string().trim().minLength(1).maxLength(255).optional(),
    severity: vine.enum(['High', 'Medium', 'Low']).optional(),
    description: vine.string().trim().optional(),
  })
)