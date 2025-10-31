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
    try {
      const payload = await createRoomBlockValidator.validate(request.all())
      console.log('Creating room block with payload:', payload)

      // Convertir les dates en Luxon DateTime
      const fromDate = DateTime.fromISO(payload.block_from_date.toISOString())
      const toDate = DateTime.fromISO(payload.block_to_date.toISOString())

      if (!fromDate.isValid || !toDate.isValid) {
        return response.badRequest({
          success: false,
          message: 'Format de date invalide',
          errorCode: 'INVALID_DATE_FORMAT',
          errors: { dates: ['Invalid date format'] },
        })
      }

      if (fromDate >= toDate) {
        return response.conflict({
          success: false,
          message: 'La date de début doit être antérieure à la date de fin',
          errorCode: 'INVALID_DATE_RANGE',
          errors: { dates: ['block_from_date cannot be after or equal to block_to_date'] },
        })
      }

      // Vérifier les réservations existantes
      const overlappingReservations = await db
        .from('reservation_rooms')
        .where('room_id', payload.room_id)
        .where((query) => {
          query.whereBetween('check_in_date', [fromDate.toJSDate(), toDate.toJSDate()])
          query.orWhereBetween('check_out_date', [fromDate.toJSDate(), toDate.toJSDate()])
          query.orWhere((subQuery) => {
            subQuery
              .where('check_in_date', '<=', fromDate.toJSDate())
              .andWhere('check_out_date', '>=', toDate.toJSDate())
          })
        })
        .count('* as total')

      if (Number(overlappingReservations[0].total) > 0) {
        return response.conflict({
          success: false,
          message: 'Impossible de bloquer une chambre avec une réservation active pour ces dates.',
          errorCode: 'ROOM_HAS_RESERVATION',
          errors: { reservations: ['Room has active reservations for these dates'] },
        })
      }

      // Vérifier les blocks existants
      const overlappingBlocks = await RoomBlock.query()
        .where('room_id', payload.room_id)
        .where((query) => {
          query.whereBetween('block_from_date', [fromDate.toJSDate(), toDate.toJSDate()])
          query.orWhereBetween('block_to_date', [fromDate.toJSDate(), toDate.toJSDate()])
          query.orWhere((subQuery) => {
            subQuery
              .where('block_from_date', '<=', fromDate.toJSDate())
              .andWhere('block_to_date', '>=', toDate.toJSDate())
          })
        })
        .count('* as total')

      if (Number(overlappingBlocks[0].$extras.total) > 0) {
        return response.conflict({
          success: false,
          message: 'La chambre est déjà bloquée pour les dates sélectionnées.',
          errorCode: 'ROOM_ALREADY_BLOCKED',
          errors: { blocks: ['Room is already blocked for the selected dates'] },
        })
      }

      // Création du block
      const roomBlock = await RoomBlock.create({
        ...payload,
        blockFromDate: fromDate,
        blockToDate: toDate,
        blockedByUserId: auth.user?.id,
      })

      // Preload les relations pour la réponse
      await roomBlock.load('room')
      await roomBlock.load('blockedBy')
      await roomBlock.load('hotel')
      await roomBlock.load('roomType')

      console.log('Room block created successfully:', roomBlock.toJSON())

      return response.created({
        success: true,
        message: 'Bloc de maintenance créé avec succès',
        data: roomBlock,
      })
    } catch (error) {
      console.error('Error creating room block:', error)

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.badRequest({
          success: false,
          message: 'Erreur de validation',
          errorCode: 'VALIDATION_ERROR',
          errors: error.messages,
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la création du bloc de maintenance',
        errorCode: 'INTERNAL_SERVER_ERROR',
        error: error.message,
      })
    }
  }

  /**
   * Retrieve Room Blocks
   */
  public async index({ request, response }: HttpContext) {
    try {
      const { start_date, end_date, room_id, status } = request.qs()

      let query = RoomBlock.query()
        .preload('room', (roomQuery) => {
          roomQuery.preload('roomType')
        })
        .preload('blockedBy')
        .preload('hotel')
        .preload('roomType')
        .orderBy('created_at', 'desc')

      if (room_id) {
        query = query.where('room_id', room_id)
      }

      if (status) {
        query = query.where('status', status)
      }

      if (start_date && end_date) {
        query = query.where((q) => {
          q.where('block_from_date', '>=', start_date).andWhere('block_to_date', '<=', end_date)
        })
      }

      const blocks = await query

      console.log(`Retrieved ${blocks.length} room blocks`)

      return response.ok({
        success: true,
        data: blocks,
        message: 'Blocs de maintenance récupérés avec succès',
      })
    } catch (error) {
      console.error('Error retrieving room blocks:', error)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des blocs de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Get Room Block by hotel ID
   */
  public async getByHotelId({ params,request, response }: HttpContext) {
    try {
      const hotelId = params.hotelId
      const page = request.input('page', 1)
      const perPage = request.input('perPage', 10)
      console.log('Fetching room blocks for hotel ID:', hotelId)

      const blocks = await RoomBlock.query()
        .where('hotel_id', hotelId)
        .preload('room', (roomQuery) => {
          roomQuery.preload('roomType')
        })
        .preload('blockedBy')
        .preload('hotel')
        .preload('roomType')
        .orderBy('created_at', 'desc').paginate(page, perPage)

      console.log(`Retrieved ${blocks.length} room blocks for hotel ${hotelId}`)

      return response.ok({
        success: true,
        data: blocks,
        message: 'Blocs de maintenance récupérés avec succès',
      })
    } catch (error) {
      console.error('Error retrieving room blocks by hotel ID:', error)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des blocs de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Show single Room Block
   */
  public async show({ params, response }: HttpContext) {
    try {
      const id = params.id

      const roomBlock = await RoomBlock.query()
        .where('id', id)
        .preload('room', (roomQuery) => {
          roomQuery.preload('roomType')
        })
        .preload('blockedBy')
        .preload('hotel')
        .preload('roomType')
        .firstOrFail()

      return response.ok({
        success: true,
        data: roomBlock,
        message: 'Bloc de maintenance récupéré avec succès',
      })
    } catch (error) {
      console.error('Error retrieving room block:', error)

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Bloc de maintenance non trouvé',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération du bloc de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Update Room Block
   */
  public async update({ request, response, params }: HttpContext) {
    try {
      const id = params.id
      const payload = await updateRoomBlockValidator.validate(request.all())

      console.log('Updating room block:', id, 'with payload:', payload)

      // Récupérer le bloc existant
      const roomBlock = await RoomBlock.findOrFail(id)

      // Validation des dates si fournies
      if (payload.block_from_date && payload.block_to_date) {
        const fromDate = DateTime.fromJSDate(payload.block_from_date)
        const toDate = DateTime.fromJSDate(payload.block_to_date)

        if (!fromDate.isValid || !toDate.isValid) {
          return response.badRequest({
            success: false,
            message: 'Format de date invalide',
            errors: { dates: ['Invalid date format'] },
          })
        }

        if (fromDate >= toDate) {
          return response.conflict({
            success: false,
            message: 'La date de début doit être antérieure à la date de fin',
            errors: { dates: ['block_from_date cannot be after or equal to block_to_date'] },
          })
        }
      }

      // Vérifier les réservations existantes si les dates ou la chambre changent
      const roomId = payload.room_id || roomBlock.roomId
      const fromDate = payload.block_from_date || roomBlock.blockFromDate.toJSDate()
      const toDate = payload.block_to_date || roomBlock.blockToDate.toJSDate()

      if (payload.room_id || payload.block_from_date || payload.block_to_date) {
        const overlappingReservations = await db
          .from('reservation_rooms')
          .where('room_id', roomId)
          .where((query) => {
            query.whereBetween('check_in_date', [fromDate, toDate])
            query.orWhereBetween('check_out_date', [fromDate, toDate])
            query.orWhere((subQuery) => {
              subQuery
                .where('check_in_date', '<=', fromDate)
                .andWhere('check_out_date', '>=', toDate)
            })
          })
          .count('* as total')

        if (Number(overlappingReservations[0].total) > 0) {
          return response.conflict({
            success: false,
            message:
              'Impossible de modifier le bloc: la chambre a une réservation active pour ces dates.',
            errors: { reservations: ['Room has active reservations for these dates'] },
          })
        }

        // Vérifier les blocks existants (exclure le block actuel)
        const overlappingBlocks = await RoomBlock.query()
          .where('room_id', roomId)
          .whereNot('id', id)
          .where((query) => {
            query.whereBetween('block_from_date', [fromDate, toDate])
            query.orWhereBetween('block_to_date', [fromDate, toDate])
            query.orWhere((subQuery) => {
              subQuery
                .where('block_from_date', '<=', fromDate)
                .andWhere('block_to_date', '>=', toDate)
            })
          })
          .count('* as total')

        if (Number(overlappingBlocks[0].$extras.total) > 0) {
          return response.conflict({
            success: false,
            message: 'La chambre est déjà bloquée pour les dates sélectionnées.',
            errors: { blocks: ['Room is already blocked for the selected dates'] },
          })
        }
      }

      // Mettre à jour le bloc - handle dates separately to avoid type conflicts
      const { block_from_date, block_to_date, ...otherFields } = payload

      // Merge non-date fields first
      roomBlock.merge(otherFields)

      // Handle date fields separately
      if (block_from_date) {
        roomBlock.blockFromDate = DateTime.fromJSDate(block_from_date)
      }
      if (block_to_date) {
        roomBlock.blockToDate = DateTime.fromJSDate(block_to_date)
      }
      await roomBlock.save()

      // Recharger avec les relations
      await roomBlock.load('room', (roomQuery) => {
        roomQuery.preload('roomType')
      })
      await roomBlock.load('blockedBy')
      await roomBlock.load('hotel')
      await roomBlock.load('roomType')

      console.log('Room block updated successfully:', roomBlock.toJSON())

      return response.ok({
        success: true,
        data: roomBlock,
        message: 'Bloc de maintenance mis à jour avec succès',
      })
    } catch (error) {
      console.error('Error updating room block:', error)

      if (error.code === 'E_VALIDATION_FAILURE') {
        return response.badRequest({
          success: false,
          message: 'Erreur de validation',
          errors: error.messages,
        })
      }

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Bloc de maintenance non trouvé',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la mise à jour du bloc de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Delete Room Block
   */
  public async destroy({ response, params }: HttpContext) {
    try {
      const id = params.id
      console.log('Deleting room block:', id)

      const roomBlock = await RoomBlock.findOrFail(id)
      await roomBlock.delete()

      console.log('Room block deleted successfully:', id)

      return response.ok({
        success: true,
        message: 'Bloc de maintenance supprimé avec succès',
      })
    } catch (error) {
      console.error('Error deleting room block:', error)

      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Bloc de maintenance non trouvé',
        })
      }

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression du bloc de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Bulk delete Room Blocks
   */
  public async bulkDestroy({ request, response }: HttpContext) {
    try {
      const { blockIds } = request.only(['blockIds'])

      if (!Array.isArray(blockIds) || blockIds.length === 0) {
        return response.badRequest({
          success: false,
          message: 'Aucun ID de bloc fourni pour la suppression',
        })
      }

      console.log('Bulk deleting room blocks:', blockIds)

      const deletedCount = await RoomBlock.query().whereIn('id', blockIds).delete()

      console.log(`Bulk deleted ${deletedCount} room blocks`)

      return response.ok({
        success: true,
        message: `${deletedCount} blocs de maintenance supprimés avec succès`,
        deletedCount,
      })
    } catch (error) {
      console.error('Error bulk deleting room blocks:', error)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la suppression en masse des blocs de maintenance',
        error: error.message,
      })
    }
  }

  /**
   * Get Room Block statistics
   */
  public async statistics({ params, response }: HttpContext) {
    try {
      const hotelId = params.hotelId

      const stats = await db
        .from('room_blocks')
        .where('hotel_id', hotelId)
        .select(
          db.raw('COUNT(*) as total_blocks'),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as blocked_count', ['blocked']),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as maintenance_count', ['maintenance']),
          db.raw('COUNT(CASE WHEN status = ? THEN 1 END) as out_of_order_count', ['out_of_order']),
          db.raw(
            'COUNT(CASE WHEN block_from_date <= ? AND block_to_date >= ? THEN 1 END) as active_blocks',
            [new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0]]
          )
        )
        .first()

      return response.ok({
        success: true,
        data: stats,
        message: 'Statistiques des blocs de maintenance récupérées avec succès',
      })
    } catch (error) {
      console.error('Error getting room block statistics:', error)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        error: error.message,
      })
    }
  }

  /**
   * Check room availability for blocking
   */
  public async checkAvailability({ request, response }: HttpContext) {
    try {
      const { room_id, block_from_date, block_to_date, exclude_block_id } = request.only([
        'room_id',
        'block_from_date',
        'block_to_date',
        'exclude_block_id',
      ])

      if (!room_id || !block_from_date || !block_to_date) {
        return response.badRequest({
          success: false,
          message: 'Paramètres requis manquants',
        })
      }

      const fromDate = new Date(block_from_date)
      const toDate = new Date(block_to_date)

      // Vérifier les réservations
      const reservationConflicts = await db
        .from('reservation_rooms')
        .where('room_id', room_id)
        .where((query) => {
          query.whereBetween('check_in_date', [fromDate, toDate])
          query.orWhereBetween('check_out_date', [fromDate, toDate])
          query.orWhere((subQuery) => {
            subQuery.where('check_in_date', '<=', fromDate).andWhere('check_out_date', '>=', toDate)
          })
        })

      // Vérifier les autres blocs
      let blockQuery = RoomBlock.query()
        .where('room_id', room_id)
        .where((query) => {
          query.whereBetween('block_from_date', [fromDate, toDate])
          query.orWhereBetween('block_to_date', [fromDate, toDate])
          query.orWhere((subQuery) => {
            subQuery
              .where('block_from_date', '<=', fromDate)
              .andWhere('block_to_date', '>=', toDate)
          })
        })

      if (exclude_block_id) {
        blockQuery = blockQuery.whereNot('id', exclude_block_id)
      }

      const blockConflicts = await blockQuery

      const isAvailable = reservationConflicts.length === 0 && blockConflicts.length === 0

      return response.ok({
        success: true,
        data: {
          available: isAvailable,
          conflicts: {
            reservations: reservationConflicts.length,
            blocks: blockConflicts.length,
          },
        },
        message: isAvailable
          ? 'Chambre disponible pour ces dates'
          : 'Chambre non disponible pour ces dates',
      })
    } catch (error) {
      console.error('Error checking room availability:', error)

      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la vérification de disponibilité',
        error: error.message,
      })
    }
  }
}
