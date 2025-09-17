import vine from '@vinejs/vine'

/**
 * Validator pour créer un Room Block
 */
export const createRoomBlockValidator = vine.compile(
  vine.object({
    room_id: vine.number().positive(),
    room_type_id: vine.number().positive().optional(),
    status: vine.enum(['pending', 'inProgress', 'completed']).optional(),
    hotel_id: vine.number().positive(),
    block_from_date: vine.date(),
    block_to_date: vine.date(),
    reason: vine.string().trim().optional(),
    description: vine.string().trim().optional()
  })
)

/**
 * Validator pour mettre à jour un Room Block
 */
export const updateRoomBlockValidator = vine.compile(
  vine.object({
    room_id: vine.number().positive().optional(),
    room_type_id: vine.number().positive().optional(),
    hotel_id: vine.number().positive().optional(),
    status: vine.enum(['pending', 'inProgress', 'completed']).optional(),
    block_from_date: vine.date().optional(),
    block_to_date: vine.date().optional(),
    reason: vine.string().trim().optional(),
    description: vine.string().trim().optional()
  })
)
