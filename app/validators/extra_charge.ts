import vine from '@vinejs/vine'

export const createExtraChargeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    shortCode: vine.string().trim().minLength(1).maxLength(50),
    name: vine.string().trim().minLength(1).maxLength(255),
    rate: vine.number().min(0),
    rateInclusiveTax: vine.number().min(0).optional(),
    fixedPrice: vine.boolean().optional(),
    frontDeskSortKey: vine.number().positive().optional(),
    publishOnWeb: vine.boolean().optional(),
    voucherNo: vine.string().trim().maxLength(100).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    webResSortKey: vine.number().min(0).optional(),
    validFrom: vine.date().optional().requiredWhen('applyChargeAlways', '=', false),
    validTo: vine.date().optional().requiredWhen('applyChargeAlways', '=', false),
    chargeAppliesOn: vine.string().trim().maxLength(50).optional(),
    applyChargeOn: vine.string().trim().maxLength(50).optional(),
    applyChargeAlways: vine.boolean().optional(),
    taxRateIds: vine.array(vine.number().positive()).optional(),
  })
)

export const updateExtraChargeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    shortCode: vine.string().trim().minLength(1).maxLength(50).optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    rate: vine.number().min(0).optional(),
    rateInclusiveTax: vine.number().min(0).optional(),
    fixedPrice: vine.boolean().optional(),
    frontDeskSortKey: vine.number().positive().optional(),
    publishOnWeb: vine.boolean().optional(),
    voucherNo: vine.string().trim().maxLength(100).optional(),
    description: vine.string().trim().maxLength(1000).optional(),
    webResSortKey: vine.number().min(0).optional(),
    validFrom: vine.date().optional().requiredWhen('applyChargeAlways', '=', false),
    validTo: vine.date().optional().requiredWhen('applyChargeAlways', '=', false),
    chargeAppliesOn: vine.string().trim().maxLength(50).optional(),
    applyChargeOn: vine.string().trim().maxLength(50).optional(),
    applyChargeAlways: vine.boolean().optional(),
    taxRateIds: vine.array(vine.number().positive()).optional(),
  })
)