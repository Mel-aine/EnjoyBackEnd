import vine from '@vinejs/vine'

export const payForAmenitiesValidator = vine.compile(
  vine.object({
    amenity_booking_ids: vine.array(vine.number().positive()).minLength(1),
    payment_method: vine.string(),
    transaction_id: vine.string(),
    notes: vine.string().optional(),
  })
)
