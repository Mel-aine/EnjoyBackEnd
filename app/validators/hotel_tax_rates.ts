import vine from '@vinejs/vine'

export const updateHotelTaxRatesValidator = vine.compile(
  vine.object({
    roomChargesTaxRateIds: vine.array(vine.number()).optional(),
    cancellationRevenueTaxRateIds: vine.array(vine.number()).optional(),
    noShowRevenueTaxRateIds: vine.array(vine.number()).optional(),
  })
)