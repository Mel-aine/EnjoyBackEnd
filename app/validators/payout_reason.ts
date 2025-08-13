import vine from '@vinejs/vine'

export const createPayoutReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    reason: vine.string().trim().minLength(1).maxLength(255),
    category: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
  })
)

export const updatePayoutReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    reason: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
  })
)