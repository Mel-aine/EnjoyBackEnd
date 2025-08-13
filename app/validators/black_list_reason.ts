import vine from '@vinejs/vine'

export const createBlackListReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    reason: vine.string().trim().minLength(1).maxLength(255),
    category: vine.string().trim().minLength(1).maxLength(255),
  })
)

export const updateBlackListReasonValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    reason: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.string().trim().minLength(1).maxLength(255).optional(),
  })
)