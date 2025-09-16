import vine from '@vinejs/vine'

export const createReservationTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive(),
    name: vine.string().trim().minLength(1).maxLength(255),
    isHold: vine.boolean().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
    reservationStatus: vine.enum(['confirmed', 'pending']).optional(),
  })
)

export const updateReservationTypeValidator = vine.compile(
  vine.object({
    hotelId: vine.number().positive().optional(),
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    isHold: vine.boolean().optional(),
    status: vine.enum(['active', 'inactive']).optional(),
    reservationStatus: vine.enum(['confirmed', 'pending']).optional(),
  })
)