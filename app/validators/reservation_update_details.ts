import vine from '@vinejs/vine'

export const updateReservationDetailsValidator = vine.compile(
  vine.object({
    rateType: vine.number().positive().optional(),
    adults: vine.number().min(0).optional(),
    children: vine.number().min(0).optional(),
    isComplementary: vine.boolean().optional(),
    amount: vine.number().min(0).optional(),
    taxInclude: vine.boolean().optional(),
    applyOn: vine.enum(['stay', 'date']),
    date: vine.date().optional(),
    notes: vine.string().maxLength(1000).optional(),
    transactionIds: vine.array(vine.number().positive()).optional(),
  })
)