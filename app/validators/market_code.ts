import vine from '@vinejs/vine'

export const createMarketCodeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(255),
  })
)

export const updateMarketCodeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
  })
)