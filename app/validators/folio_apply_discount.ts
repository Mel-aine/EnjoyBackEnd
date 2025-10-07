import vine from '@vinejs/vine'

export const applyFolioDiscountValidator = vine.compile(
  vine.object({
    folioId: vine.number().positive(),
    discountId: vine.number().positive(),
    reservationId: vine.number().positive(),
    hotelId: vine.number().positive(),
    transactionDate: vine.date().optional(),
    notes: vine.string().trim().optional(),
  })
)