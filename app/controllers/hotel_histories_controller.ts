import type { HttpContext } from '@adonisjs/core/http'
import HotelHistory from '#models/hotel_history'
import { DateTime } from 'luxon'

export default class HotelHistoriesController {
  /**
   * Récupère l'historique des réservations avec filtres
   */
  async index({ request, response, auth }: HttpContext) {
    try {
      const {
        searchText,
        roomType,
        rateType,
        reservationType,
        source,
        showBookings,
        dateType,
        dateStart,
        dateEnd,
        stayCheckInDate,
        stayCheckOutDate,
        page = 1,
        limit = 20,
      } = request.qs()

      // Récupérer l'hotelId depuis l'utilisateur authentifié ou la requête
      const hotelId = request.qs().hotelId ||  auth.user?.hotelId
      if (!hotelId) {
        return response.badRequest({ message: 'hotelId est requis' })
      }

      // Construction de la requête de base
      const query = HotelHistory.query()
        .where('hotel_id', hotelId)
        .orderBy('created_at', 'desc')

      // Filtre par texte de recherche (nom du client ou numéro de réservation)
      if (searchText) {
        const searchLower = searchText.toLowerCase()
        query.where((subQuery) => {
          subQuery
            .whereRaw('LOWER(guest_name) LIKE ?', [`%${searchLower}%`])
            .orWhere('reservation_number', 'LIKE', `%${searchText}%`)
            .orWhere('email', 'LIKE', `%${searchText}%`)
            .orWhere('mobile_no', 'LIKE', `%${searchText}%`)
        })
      }

      // Filtre par type de chambre (room)
      if (roomType) {
        query.where('room', roomType)
      }

      // Filtre par type de tarif
      if (rateType) {
        query.where('rate_type', rateType)
      }

      // Filtre par type de réservation
      if (reservationType) {
        query.where('reservation_type', reservationType)
      }

      // Filtre par source
      if (source) {
        query.where('source', source)
      }

      // Filtre par source (web, channel, pms) via showBookings
      let sources: string[] = []

      if (Array.isArray(showBookings)) {
        sources = showBookings.map((s) => s.toLowerCase())
      } else if (typeof showBookings === 'string') {
        sources = showBookings.split(',').map((s) => s.trim().toLowerCase())
      }

      if (sources.length > 0) {

        if (sources.includes('pms')) {
          query.where('source', 'PMS')
        }

        else if (sources.includes('channel') || sources.includes('web')) {
          query.whereNot('source', 'PMS')
        }
        else {
          query.whereIn('source', sources)
        }
      }


      // Filtre par plage de dates selon le type
      if (dateStart && dateEnd && dateType) {
        const startDate = DateTime.fromISO(dateStart).startOf('day')
        const endDate = DateTime.fromISO(dateEnd).endOf('day')

        switch (dateType) {
          case 'created':
            query.whereBetween('created_at', [
              startDate.toSQL()!,
              endDate.toSQL()!,
            ])
            break
          case 'arrival':
            query.whereBetween('arrival_date', [
              startDate.toSQL()!,
              endDate.toSQL()!,
            ])
            break
          case 'departure':
            query.whereBetween('departure_date', [
              startDate.toSQL()!,
              endDate.toSQL()!,
            ])
            break
          case 'cancelled':
            query
              .whereBetween('cancellation_date', [
                startDate.toSQL()!,
                endDate.toSQL()!,
              ])
              .whereNotNull('cancellation_date')
            break
          case 'booking':
            query.whereBetween('booking_date', [
              startDate.toSQL()!,
              endDate.toSQL()!,
            ])
            break
        }
      }

      // Filtre par période de séjour (overlap de dates)
      if (stayCheckInDate && stayCheckOutDate) {
        const stayStart = DateTime.fromISO(stayCheckInDate).startOf('day')
        const stayEnd = DateTime.fromISO(stayCheckOutDate).endOf('day')

        query.where((subQuery) => {
          subQuery
            // Arrivée dans la période
            .whereBetween('arrival_date', [
              stayStart.toSQL()!,
              stayEnd.toSQL()!,
            ])
            // OU départ dans la période
            .orWhereBetween('departure_date', [
              stayStart.toSQL()!,
              stayEnd.toSQL()!,
            ])
            // OU séjour qui englobe toute la période
            .orWhere((overlapQuery) => {
              overlapQuery
                .where('arrival_date', '<=', stayStart.toSQL()!)
                .where('departure_date', '>=', stayEnd.toSQL()!)
            })
        })
      }

      // Pagination
      const histories = await query.paginate(page, limit)

      const formattedData = histories.all().map((history) => {
        const historyJson = history.toJSON()
        return {
          ...historyJson,
          date: historyJson.arrivalDate,
          dateD: historyJson.departureDate,
          guest: {
            displayName: historyJson.guestName,
          },
          balanceSummary: {
            totalChargesWithTaxes: historyJson.total,
            adr: historyJson.adr,
            totalTaxes: historyJson.totalTax,
            totalCharges: historyJson.totalCharges,
          },
          otaName: historyJson.source,
          bookingSourceName: historyJson.source,
          userFullName: historyJson.userName,
        }
      })

      return response.ok({
        data: formattedData,
        meta: {
          total: histories.total,
          perPage: histories.perPage,
          currentPage: histories.currentPage,
          lastPage: histories.lastPage,
          firstPage: histories.firstPage,
          hasMorePages: histories.hasMorePages,
          hasPages: histories.hasPages,
        },
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des historiques:', error)
      return response.internalServerError({
        message: 'Erreur lors de la récupération des historiques',
        error: error.message,
      })
    }
  }








}
