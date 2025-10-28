import vine from '@vinejs/vine'

export const addFolioAdjustmentValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    reservationId: vine.number().positive().optional(),
    hotelId: vine.number().positive(),
    type: vine.string().trim().minLength(1).maxLength(500),
    amount: vine.number(),
    comment: vine.string().trim().minLength(1).maxLength(500).optional(),
    date: vine.date(),
  })
)

export const updateFolioAdjustmentValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    reservationId: vine.number().positive().optional(),
    hotelId: vine.number().positive(),
    type: vine.string().trim().minLength(1).maxLength(500),
    amount: vine.number(),
    comment: vine.string().trim().minLength(1).maxLength(500),
    date: vine.string(),
  })
)
