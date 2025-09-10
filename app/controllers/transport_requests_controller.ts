
import type { HttpContext } from '@adonisjs/core/http'
import PickupsDropoffsLog from '#models/pickups_dropoffs_log'
import TransportationMode from '#models/transportation_mode'
import Folio from '#models/folio'
import { createTransportationRequestValidator, updateTransportationRequestValidator } from '#validators/transportation_request'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import FolioTransaction from '#models/folio_transaction'
import  { TransactionType } from '#app/enums'

export default class TransportRequestsController {
  /**
   * Créer une nouvelle demande de transport
   */
async store({ request, response, auth }: HttpContext) {
  const payload = await request.validateUsing(createTransportationRequestValidator)
  const user = auth.user!

  const trx = await db.transaction()

  try {
    // Vérifier le mode de transport
    const transportationMode = await TransportationMode.findOrFail(payload.transportationModeId)

    // Créer la demande
    const transportRequest = await PickupsDropoffsLog.create({
      ...payload,
      createdBy: user.id,
      requestDate: DateTime.now(),
      // Convertir la Date en DateTime Luxon
      scheduledDateTime: DateTime.fromISO(payload.scheduledDateTime),
    }, { client: trx })

    // Si des frais sont appliqués, les poster au folio
    if (payload.serviceFee && payload.serviceFee > 0 && payload.folioId) {
      const folio = await Folio.findOrFail(payload.folioId, { client: trx })

      // Poster les frais correctement
      folio.totalCharges += payload.serviceFee


      // Recalculer le balance
      folio.balance = folio.totalCharges - folio.totalPayments - folio.totalAdjustments

      folio.useTransaction(trx)
      await folio.save()

      const transactionCode =  TransactionType.CHARGE ? 'CHG' : 'ADJ';
      const transactionNumber = parseInt(Date.now().toString().slice(-9));



      // Créer une transaction de folio pour traçabilité
      await FolioTransaction.create({
        folioId: folio.id,
        hotelId: payload.hotelId,
        guestId: payload.guestId,
        reservationId: payload.reservationId,
        transactionType: TransactionType.CHARGE,
        description: `Frais de transport - ${transportationMode.name}`,
        amount : payload.serviceFee,
        totalAmount: payload.serviceFee ,
        transactionDate: DateTime.now(),
        postingDate: DateTime.now(),
        transactionCode: transactionCode,
        transactionNumber: transactionNumber,
        createdBy: user.id,
      }, { client: trx })

      transportRequest.chargePostedToFolio = true
      transportRequest.useTransaction(trx)
      await transportRequest.save()
    }

    await trx.commit()

    await transportRequest.load('guest')
    await transportRequest.load('transportationMode')
    await transportRequest.load('reservation')

    return response.created(transportRequest)
  } catch (error) {
    await trx.rollback()
    throw error
  }
}

  /**
   * Lister les demandes de transport avec filtres
   */
  async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 20)
    const status = request.input('status')
    const serviceType = request.input('serviceType')
    const guestId = request.input('guestId')
    const dateFrom = request.input('dateFrom')
    const dateTo = request.input('dateTo')

    const query = PickupsDropoffsLog.query()
      .preload('guest')
      .preload('transportationMode')
      .preload('reservation')
      .preload('creator')

    if (status) {
      query.where('status', status)
    }

    if (serviceType) {
      query.where('serviceType', serviceType)
    }

    if (guestId) {
      query.where('guestId', guestId)
    }

    if (dateFrom) {
      query.where('scheduledDateTime', '>=', dateFrom)
    }

    if (dateTo) {
      query.where('scheduledDateTime', '<=', dateTo)
    }

    const requests = await query.paginate(page, limit)

    return response.ok(requests)
  }

  /**
   * Afficher une demande spécifique
   */
  async show({ params, response }: HttpContext) {
    const request = await PickupsDropoffsLog.query()
      .where('id', params.id)
      .preload('guest')
      .preload('transportationMode')
      .preload('reservation')
      .preload('folio')
      .preload('creator')
      .preload('lastUpdatedBy')
      .firstOrFail()

    return response.ok(request)
  }

  /**
   * Mettre à jour une demande de transport
   */
  async update({ params, request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(updateTransportationRequestValidator)
    const user = auth.user!

    const transportRequest = await PickupsDropoffsLog.findOrFail(params.id)

    // Mise à jour des champs autorisés
    transportRequest.merge({
      ...payload,
      scheduledDateTime: payload.scheduledDateTime
          ? DateTime.fromJSDate(payload.scheduledDateTime as Date)
          : undefined,
      lastModifiedBy: user.id,
    })

    await transportRequest.save()

    await transportRequest.load('guest')
    await transportRequest.load('transportationMode')
    await transportRequest.load('reservation')

    return response.ok(transportRequest)
  }

  /**
   * Mettre à jour le statut d'une demande
   */
  async updateStatus({ params, request, response, auth }: HttpContext) {
    const { status, actualDateTime, cancellationReason } = request.only(['status', 'actualDateTime', 'cancellationReason'])
    const user = auth.user!

    const transportRequest = await PickupsDropoffsLog.findOrFail(params.id)

    transportRequest.status = status
    transportRequest.lastModifiedBy = user.id

    if (status === 'Completed' && actualDateTime) {
      transportRequest.actualDateTime = DateTime.fromJSDate(actualDateTime as Date)
    }

    if (status === 'Cancelled' && cancellationReason) {
      transportRequest.cancellationReason = cancellationReason
    }

    await transportRequest.save()

    return response.ok(transportRequest)
  }

  /**
   * Supprimer une demande de transport
   */
  async destroy({ params, response }: HttpContext) {
    const transportRequest = await PickupsDropoffsLog.findOrFail(params.id)

    // Vérifier si on peut supprimer (pas encore en cours ou terminé)
    if (['En Route', 'Completed'].includes(transportRequest.status)) {
      return response.badRequest({ message: 'Cannot delete a request that is in progress or completed' })
    }

    await transportRequest.delete()

    return response.ok({ message: 'Transportation request deleted successfully' })
  }

  /**
   * Obtenir les statistiques des demandes de transport
   */
  async analytics({ request, response }: HttpContext) {
    const dateFrom = request.input('dateFrom')
    const dateTo = request.input('dateTo')

    const baseQuery = PickupsDropoffsLog.query()

    if (dateFrom) {
      baseQuery.where('scheduledDateTime', '>=', dateFrom)
    }

    if (dateTo) {
      baseQuery.where('scheduledDateTime', '<=', dateTo)
    }

    // Statistiques générales
    const totalRequests = await baseQuery.clone().count('* as total')
    const completedRequests = await baseQuery.clone().where('status', 'Completed').count('* as total')
    const cancelledRequests = await baseQuery.clone().where('status', 'Cancelled').count('* as total')
    const pendingRequests = await baseQuery.clone().where('status', 'Pending').count('* as total')

    // Revenus
    const totalRevenue = await baseQuery.clone()
      .where('chargePostedToFolio', true)
      .sum('serviceFee as total')

    // Par type de service
    const byServiceType = await baseQuery.clone()
      .groupBy('serviceType')
      .count('* as count')
      .select('serviceType')

    // Par mode de transport
    const byTransportMode = await baseQuery.clone()
      .join('transportation_modes', 'pickups_dropoffs_log.transportation_mode_id', 'transportation_modes.id')
      .groupBy('transportation_modes.mode_name')
      .count('* as count')
      .select('transportation_modes.mode_name as mode')

    // Taux de ponctualité (demandes terminées à temps)
    const punctualityRate = await db.rawQuery(`
      SELECT
        COUNT(CASE WHEN actual_date_time <= scheduled_date_time THEN 1 END) * 100.0 / COUNT(*) as rate
      FROM pickups_dropoffs_log
      WHERE status = 'Completed'
        AND actual_date_time IS NOT NULL
        ${dateFrom ? `AND scheduled_date_time >= '${dateFrom}'` : ''}
        ${dateTo ? `AND scheduled_date_time <= '${dateTo}'` : ''}
    `)

    return response.ok({
      summary: {
        total: totalRequests[0].$extras.total,
        completed: completedRequests[0].$extras.total,
        cancelled: cancelledRequests[0].$extras.total,
        pending: pendingRequests[0].$extras.total,
        totalRevenue: totalRevenue[0].$extras.total || 0,
        punctualityRate: punctualityRate[0]?.rate || 0
      },
      breakdown: {
        byServiceType,
        byTransportMode
      }
    })
  }
}
