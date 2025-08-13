import vine from '@vinejs/vine'

export const createMarketCodeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(255),
    code: vine.string().trim().minLength(1).maxLength(255),
    segment: vine.string().trim().minLength(1).maxLength(255),
    description: vine.string().trim().optional(),
  })
)

export const updateMarketCodeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    code: vine.string().trim().minLength(1).maxLength(255).optional(),
    segment: vine.string().trim().minLength(1).maxLength(255).optional(),
    description: vine.string().trim().optional(),
  })
)