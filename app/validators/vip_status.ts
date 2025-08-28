import vine from '@vinejs/vine'

// Validator for creating VIP status
export const createVipStatusValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(100),
    color: vine.string().minLength(4).maxLength(7).regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/),
    icon: vine.string().minLength(1).maxLength(100),
    hotelId: vine.number().positive()
  })
)

// Validator for updating VIP status
export const updateVipStatusValidator = vine.compile(
  vine.object({
    name: vine.string().minLength(1).maxLength(100).optional(),
    color: vine.string().minLength(4).maxLength(7).regex(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).optional(),
    icon: vine.string().minLength(1).maxLength(100).optional(),
    hotelId: vine.number().positive().optional()
  })
)