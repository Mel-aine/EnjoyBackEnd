import vine from '@vinejs/vine'

export const applyRoomChargeDiscountValidator = vine.compile(
  vine.object({
    discountId: vine.number().positive(),
    discountRule: vine.enum(['allNights', 'firstNight', 'lastNight', 'selectNights'] as const),
    selectedTransactions: vine.array(vine.number().positive()).optional(),
    date: vine.date().optional(),
    notes: vine.string().optional(),
  })
)