import vine from '@vinejs/vine'

export const createBusinessSourceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    marketCodeId: vine.number().positive().optional(),
    color: vine.string().trim().optional(),
    registrationNumber: vine.string().trim().optional(),
  })
)

export const updateBusinessSourceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    marketCodeId: vine.number().positive().optional(),
    color: vine.string().trim().optional(),
    registrationNumber: vine.string().trim().optional(),
  })
)