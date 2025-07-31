import vine from '@vinejs/vine'

// Ce validateur est utilisé pour chaque article dans le tableau "items"
export const amenityBookingItemValidator = vine.object({
  amenity_product_id: vine.number().positive(),
  quantity: vine.number().positive(),
})

// Validateur pour la création d'une nouvelle réservation d'aménités
export const createAmenityBookingValidator = vine.compile(
  vine.object({
    reservation_id: vine.number().positive(),
    status: vine.enum(['pending', 'completed', 'cancelled']),
    // La réservation doit contenir au moins un article
    items: vine.array(amenityBookingItemValidator).minLength(1),
  })
)

// Validateur pour la mise à jour d'une réservation
export const updateAmenityBookingValidator = vine.compile(
  vine.object({
    status: vine.enum(['pending', 'completed', 'cancelled']).optional(),
    // Les articles sont facultatifs lors de la mise à jour, mais s'ils sont fournis, ils doivent être valides
    items: vine.array(amenityBookingItemValidator).minLength(1).optional(),
  })
)

