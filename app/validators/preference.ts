import vine from '@vinejs/vine'

export const createPreferenceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(255),
    preferenceTypeId: vine.number().positive(),
  })
)

export const updatePreferenceValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    preferenceTypeId: vine.number().positive().optional(),
  })
)