import type { HttpContext } from '@adonisjs/core/http'
import HotelHistory from '#models/hotel_history'
import Hotel from '#models/hotel'
import { DateTime } from 'luxon'

type HistoryFilters = {
  historyId?: string | number
  searchText?: string
  roomType?: string
  rateType?: string
  reservationType?: string
  reservationNumber?: string
  source?: string
  showBookings?: string | string[]
  dateType?: string
  dateStart?: string
  dateEnd?: string
  stayCheckInDate?: string
  stayCheckOutDate?: string
}

export default class HotelHistoriesController {
  /**
   * Construit la requête de recherche de l'historique des réservations
   * partagée entre la liste et l'impression de facture.
   */
  private buildHistoryQuery(hotelId: string | number, filters: HistoryFilters) {
    const {
      historyId,
      searchText,
      roomType,
      rateType,
      reservationType,
      reservationNumber,
      source,
      showBookings,
      dateType,
      dateStart,
      dateEnd,
      stayCheckInDate,
      stayCheckOutDate,
    } = filters

    const query = HotelHistory.query().where('hotel_id', hotelId)

    // Filtre sur une ligne précise de l'historique (impression d'une seule facture)
    if (historyId) {
      query.where('id', historyId)
    }

    // Filtre par texte de recherche (nom du client ou numéro de réservation)
    if (searchText) {
      const searchLower = searchText.toLowerCase()
      query.where((subQuery) => {
        subQuery
          .whereRaw('LOWER(guest_name) LIKE ?', [`%${searchLower}%`])
          // .orWhere('reservation_number', 'LIKE', `%${searchText}%`)
          .orWhere('email', 'LIKE', `%${searchText}%`)
          .orWhere('mobile_no', 'LIKE', `%${searchText}%`)
      })
    }

    //reservation Number

    if (reservationNumber) {
      query.where('reservation_number', reservationNumber)
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
      } else if (sources.includes('channel') || sources.includes('web')) {
        query.whereNot('source', 'PMS')
      } else {
        query.whereIn('source', sources)
      }
    }

    // Filtre par plage de dates selon le type
    if (dateStart && dateEnd && dateType) {
      const startDate = DateTime.fromISO(dateStart).startOf('day')
      const endDate = DateTime.fromISO(dateEnd).endOf('day')

      switch (dateType) {
        case 'created':
          query.whereBetween('created_at', [startDate.toSQL()!, endDate.toSQL()!])
          break
        case 'arrival':
          query.whereBetween('arrival_date', [startDate.toSQL()!, endDate.toSQL()!])
          break
        case 'departure':
          query.whereBetween('departure_date', [startDate.toSQL()!, endDate.toSQL()!])
          break
        case 'cancelled':
          query
            .whereBetween('cancellation_date', [startDate.toSQL()!, endDate.toSQL()!])
            .whereNotNull('cancellation_date')
          break
        case 'booking':
          query.whereBetween('booking_date', [startDate.toSQL()!, endDate.toSQL()!])
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
          .whereBetween('arrival_date', [stayStart.toSQL()!, stayEnd.toSQL()!])
          // OU départ dans la période
          .orWhereBetween('departure_date', [stayStart.toSQL()!, stayEnd.toSQL()!])
          // OU séjour qui englobe toute la période
          .orWhere((overlapQuery) => {
            overlapQuery
              .where('arrival_date', '<=', stayStart.toSQL()!)
              .where('departure_date', '>=', stayEnd.toSQL()!)
          })
      })
    }

    return query
  }

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
        reservationNumber,
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
      const hotelId = request.qs().hotelId || auth.user?.hotelId
      if (!hotelId) {
        return response.badRequest({ message: 'hotelId est requis' })
      }

      const query = this.buildHistoryQuery(hotelId, {
        searchText,
        roomType,
        rateType,
        reservationType,
        reservationNumber,
        source,
        showBookings,
        dateType,
        dateStart,
        dateEnd,
        stayCheckInDate,
        stayCheckOutDate,
      }).orderBy('created_at', 'desc')

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

  /**
   * Génère un PDF avec une facture distincte pour chaque réservation
   * de l'historique correspondant au client recherché.
   */
  async printInvoicePdf({ request, response, auth }: HttpContext) {
    try {
      const body = request.all()

      const hotelId = body.hotelId || auth.user?.hotelId
      const requestedGuestName = String(body.guestName || body.searchText || '').trim()
      const historyId = body.historyId ? Number(body.historyId) : undefined
      const reservationNumber = body.reservationNumber
        ? String(body.reservationNumber).trim()
        : undefined

      if (!hotelId) {
        return response.badRequest({ message: 'hotelId est requis' })
      }

      // On imprime soit toutes les factures d'un client, soit une seule réservation
      if (!requestedGuestName && !historyId && !reservationNumber) {
        return response.badRequest({
          message: 'Le nom du client ou une réservation est requis pour imprimer la facture',
        })
      }

      const filters: HistoryFilters = {
        historyId,
        // Une facture ciblée est retrouvée par son id : le nom ne sert qu'à l'affichage
        searchText: historyId ? undefined : requestedGuestName || undefined,
        roomType: body.roomType || undefined,
        rateType: body.rateType || undefined,
        reservationType: body.reservationType || undefined,
        reservationNumber,
        source: body.source || undefined,
        showBookings: body.showBookings || undefined,
        dateType: body.dateType || undefined,
        dateStart: body.dateStart || undefined,
        dateEnd: body.dateEnd || undefined,
        stayCheckInDate: body.stayCheckInDate || undefined,
        stayCheckOutDate: body.stayCheckOutDate || undefined,
      }

      // Toutes les réservations du client, sans pagination
      const histories = await this.buildHistoryQuery(hotelId, filters).orderBy(
        'arrival_date',
        'asc'
      )

      if (histories.length === 0) {
        return response.notFound({
          success: false,
          message: requestedGuestName
            ? `Aucune réservation trouvée pour le client "${requestedGuestName}"`
            : `Aucune réservation trouvée pour la réservation "${historyId || reservationNumber}"`,
        })
      }

      const guestName = requestedGuestName || histories[0].guestName || '-'

      const hotel = await Hotel.find(hotelId)
      if (!hotel) {
        return response.notFound({ success: false, message: 'Hôtel introuvable' })
      }

      const formatDate = (value: DateTime | null) => {
        if (!value || !value.isValid) return '-'
        return value.toFormat('dd/MM/yyyy')
      }

      const reservations = histories.map((history) => {
        const json = history.toJSON()
        const nights =
          json.numberOfNights ??
          (history.arrivalDate && history.departureDate
            ? Math.max(history.departureDate.diff(history.arrivalDate, 'days').days, 0)
            : 0)

        const totalCharges = Number(json.totalCharges || 0)
        const totalTaxes = Number(json.totalTax || 0)
        const grandTotal = Number(json.total ?? totalCharges + totalTaxes)
        const totalPayments = Number(json.deposit || 0)
        const outstandingBalance = Number(json.dueAmount ?? grandTotal - totalPayments)
        const pax = Number(json.pax || 0)

        return {
          reservationNumber: json.reservationNumber || String(json.id),
          folioNumber: json.folioNo || '-',
          guestName: json.guestName || guestName,
          company: 'N/A',
          nationality: json.country || '-',
          guestCode: 'N/A',
          pax,
          adults: pax,
          children: 0,
          nights,
          roomNumber: json.room || '-',
          arrivalDate: history.arrivalDate?.toISODate() || '',
          departureDate: history.departureDate?.toISODate() || '',
          checkInTime: '-',
          checkOutTime: '-',
          tariff: Number(json.adr || 0),
          rateType: json.rateType || '-',
          reservedBy: json.userName || '-',
          checkedInBy: '-',
          checkedOutBy: '-',
          totals: {
            totalChargesWithTaxes: grandTotal,
            totalPayments,
            totalTaxes,
            outstandingBalance,
          },
        }
      })

      const firstRow = histories[0]
      const lastRow = histories[histories.length - 1]
      const guestEmail = histories.find((h) => h.email)?.email || null
      const guestPhone = histories.find((h) => h.mobileNo)?.mobileNo || null
      const guestCity = histories.find((h) => h.city)?.city || null
      const guestCountry = histories.find((h) => h.country)?.country || null
      const language = body.language === 'en' ? 'en' : 'fr'

      // Une page de facture par réservation, avec le folio de cette réservation.
      const invoiceData = {
        hotel: {
          name: hotel.hotelName,
          address: hotel.address || '',
          city: hotel.city || '',
          state: hotel.stateProvince || '',
          country: hotel.country || '',
          phone: hotel.phoneNumber || '',
          email: hotel.email || '',
          website: hotel.website || '',
          registrationNumber: hotel.registrationNo1,
          rcNumber: hotel.registrationNo2,
        },
        guest: {
          name: guestName,
          email: guestEmail,
          phone: guestPhone,
          address: [guestCity, guestCountry].filter(Boolean).join(', ') || null,
          city: guestCity,
          country: guestCountry,
        },
        meta: {
          invoiceNumber: `INV-${new Date().getTime()}`,
          generatedAt: DateTime.now().toFormat('dd/MM/yyyy HH:mm'),
          printedBy: auth.user?.fullName || 'System',
          periodFrom: formatDate(firstRow?.arrivalDate ?? null),
          periodTo: formatDate(lastRow?.departureDate ?? null),
        },
        currency: { code: hotel.currencyCode || 'XAF' },
        reservations,
      }

      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
      const pdfBuffer =
        language === 'fr'
          ? await PdfGenerationService.generateGuestHistoryPdfFrench(invoiceData)
          : await PdfGenerationService.generateGuestHistoryPdf(invoiceData)

      const safeGuestName = guestName.replace(/[^a-zA-Z0-9-_]/g, '_')

      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `inline; filename="invoice-${safeGuestName}.pdf"`)
      response.header('Content-Length', pdfBuffer.length.toString())

      return response.send(pdfBuffer)
    } catch (error) {
      console.error('Erreur lors de la génération de la facture PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Erreur lors de la génération de la facture PDF',
        error: error.message,
      })
    }
  }
}
