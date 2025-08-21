import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import RoomBlock from '#models/room_block'
import { DateTime } from 'luxon'
import { createRoomBlockValidator, updateRoomBlockValidator } from '#validators/room_blocks'

export default class RoomBlocksController {
  /**
   * Create Room Block
   */





public async store({ request, response, auth }: HttpContext) {
  const payload = await createRoomBlockValidator.validate(request.all())

  // Convertir les dates en Luxon DateTime
  const fromDate = DateTime.fromISO(payload.block_from_date.toISOString())
  const toDate = DateTime.fromISO(payload.block_to_date.toISOString())

  if (!fromDate.isValid || !toDate.isValid) {
    return response.badRequest('Invalid date format')
  }

  if (fromDate > toDate) {
    return response.conflict('block_from_date cannot be after block_to_date')
  }

  // Vérifier les réservations existantes
  const overlappingReservations = await db
    .from('reservation_rooms')
    .where('room_id', payload.room_id)
    .where((query) => {
      query.whereBetween('check_in_date', [fromDate.toJSDate(), toDate.toJSDate()])
      query.orWhereBetween('check_out_date', [fromDate.toJSDate(), toDate.toJSDate()])
    })
    .count('* as total')

  if (Number(overlappingReservations[0].total) > 0) {
    return response.conflict('Cannot block a room with an active reservation for these dates.')
  }

  // Vérifier les blocks existants
  const overlappingBlocks = await RoomBlock.query()
    .where('room_id', payload.room_id)
    .where((query) => {
      query.whereBetween('block_from_date', [fromDate.toJSDate(), toDate.toJSDate()])
      query.orWhereBetween('block_to_date', [fromDate.toJSDate(), toDate.toJSDate()])
    })
    .count('* as total')

  if (Number(overlappingBlocks[0].$extras.total) > 0) {
    return response.conflict('Room is already blocked for the selected dates.')
  }

  // Création du block
  const roomBlock = await RoomBlock.create({
    ...payload,
    blockFromDate: fromDate,
    blockToDate: toDate,
    blockedByUserId: auth.user?.id,
  })

  return response.created(roomBlock)
}

  /**
   * Retrieve Room Blocks
   */

  public async index({ request, response }: HttpContext) {
    const { start_date, end_date, room_id } = request.qs()

    let query = RoomBlock.query().preload('room').preload('blockedBy')

    if (room_id) query = query.where('room_id', room_id)
    if (start_date && end_date) {
      query = query.where((q) => {
        q.where('block_from_date', '>=', start_date).andWhere('block_to_date', '<=', end_date)
      })
    }

    const blocks = await query
    return response.ok(blocks)
  }

  /**
   * get Room Block by hotel ID
   */

  public async getByHotelId({ params, response }: HttpContext) {
    const hotelId = params.hotelId

    const blocks = await RoomBlock.query()
      .where('hotel_id', hotelId)
      .preload('room')
      .preload('blockedBy')
      .preload('hotel')
      .preload('roomType')

    return response.ok(blocks)
  }

  /**
   * Update Room Block
   */

  public async update({ request, response, params }: HttpContext) {
    const id = params.id
    const payload = await updateRoomBlockValidator.validate(request.all())

    if (
      payload.block_from_date &&
      payload.block_to_date &&
      payload.block_from_date > payload.block_to_date
    ) {
      return response.conflict('block_from_date cannot be after block_to_date')
    }

    const roomBlock = await RoomBlock.findOrFail(id)

    // Vérifier les réservations existantes
    const overlappingReservations = await db
      .from('reservations')
      .where('room_id', payload.room_id ?? roomBlock.roomId)
      .whereBetween('reservation_date', [
        payload.block_from_date ?? roomBlock.blockFromDate.toJSDate(),
        payload.block_to_date ?? roomBlock.blockToDate.toJSDate(),
      ])
      .count('* as total')

    if (Number(overlappingReservations[0].total) > 0) {
      return response.conflict('Cannot block a room with an active reservation for these dates.')
    }

    // Vérifier les blocks existants (exclure le block actuel)
    const fromDate = payload.block_from_date ?? roomBlock.blockFromDate.toJSDate()
    const toDate = payload.block_to_date ?? roomBlock.blockToDate.toJSDate()

    const overlappingBlocks = await RoomBlock.query()
      .where('room_id', payload.room_id ?? roomBlock.roomId)
      .whereNot('id', id)
      .where((query) => {
        query.whereBetween('block_from_date', [fromDate, toDate])
        query.orWhereBetween('block_to_date', [fromDate, toDate])
      })
      .count('* as total')

    if (Number(overlappingBlocks[0].$extras.total) > 0) {
      return response.conflict('Room is already blocked for the selected dates.')
    }

    roomBlock.merge(payload)
    await roomBlock.save()
    await roomBlock.refresh()
    return response.ok(roomBlock)
  }

  /**
   * Delete Room Block
   */

  public async destroy({ response, params }: HttpContext) {
    const id = params.id
    const roomBlock = await RoomBlock.findOrFail(id)
    await roomBlock.delete()
    return response.noContent()
  }
}
