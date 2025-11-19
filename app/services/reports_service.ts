import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Room from '#models/room'
import ActivityLog from '#models/activity_log'
import Task from '#models/task'
import Expense from '#models/expense'
import FolioTransaction from '#models/folio_transaction'
import { TransactionStatus, TransactionType } from '#app/enums'
import Database from '@adonisjs/lucid/services/db'
import { HtmlReportGenerator } from './htmlReports_service.ts'

export interface ReportFilters {
  hotelId?: number
  startDate?: string
  endDate?: string
  roomTypeId?: number
  guestId?: number
  userId?: number
  status?: string
  departmentId?: number
  bookingSourceId?: number
  ratePlanId?: number
  company?: string
  travelAgent?: string
  businessSource?: string
  market?: string
  rateFrom?: number
  rateTo?: number
  reservationType?: string
  taxInclusive?: boolean
  selectedColumns?: string[]
  showAmount?: 'rent_per_night' | 'total_amount',
  arrivalFrom?: string
  arrivalTo?: string
  roomType?: string
  rateType?: string
  user?: string
  checkin?: string
}

export interface HtmlReport {
  title: string
  html: string
  generatedAt: DateTime
  filters: ReportFilters
}

export interface Html {
  title: string
  content: string
  generatedAt: DateTime
  filters: ReportFilters
  totalRecords: number
  summary?: any
  data: any[]
}
export interface ReportData {
  title: string
  generatedAt: DateTime
  filters: ReportFilters
  data: any[]
  summary?: any
  totalRecords: number
}

export class ReservationReportsService {
  /**
   * Arrival List Report
   * Liste des clients prévus pour arriver aujourd'hui ou à des dates futures
   */
  static async getArrivalList(filters: ReportFilters): Promise<HtmlReport> {
    const startDate = filters.startDate 
      ? DateTime.fromISO(filters.startDate).toISODate() 
      : DateTime.now().startOf('day')
    const endDate = filters.endDate 
      ? DateTime.fromISO(filters.endDate).toISODate() 
      : DateTime.now().endOf('day')
  
    console.log('Filtres dates:', { startDate, endDate });
  
    // Construction de la requête de base
    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('folios')
      .preload('reservationType')
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room'),
        roomQuery.preload('roomType')
        roomQuery.preload('roomRates', (roomRateQuery) => {
          roomRateQuery.preload('rateType')
        })
      })
      .preload('bookingSource')
      .preload('ratePlan')
      .preload('creator')
      .whereBetween('arrived_date', [startDate, endDate])
      .orderBy('arrived_date', 'asc')
  
    // Filtre obligatoire : Hotel ID
    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }
  
    // ============================================
    // APPLICATION DES FILTRES OPTIONNELS
    // ============================================
  
    // Filtre taxes incluses
    if (filters.taxInclusive === true) {
      query.where('tax_exempt', filters.taxInclusive)
    }
  
    // Filtre type de chambre
    if (filters.roomTypeId) {
      query.where('room_type_id', filters.roomTypeId)
    }
  
    // Filtre statut (peut être multiple)
    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      query.whereIn('reservation_status', statuses)
    }
  
    // Filtre compagnie
    if (filters.company) {
      query.where('company_name', 'like', `%${filters.company}%`)
    }
  
    // Filtre agent de voyage
    if (filters.travelAgent) {
      query.where('travel_agent_code', 'like', `%${filters.travelAgent}%`)
    }
  
    // Filtre source d'affaires
    if (filters.businessSource) {
      query.where('booking_source_id', filters.businessSource)
    }
  
    // Filtre marché
    if (filters.market) {
      query.where('market_code_id', filters.market)
    }
  
    // Filtre fourchette de prix
    if (filters.rateFrom !== undefined || filters.rateTo !== undefined) {
      const rateField = filters.showAmount === 'rent_per_night' 
        ? 'room_rate' 
        : 'total_estimated_revenue'
  
      if (filters.rateFrom !== undefined && filters.rateTo !== undefined) {
        query.whereBetween(rateField, [filters.rateFrom, filters.rateTo])
      } else if (filters.rateFrom !== undefined) {
        query.where(rateField, '>=', filters.rateFrom)
      } else if (filters.rateTo !== undefined) {
        query.where(rateField, '<=', filters.rateTo)
      }
    }
  
    // Filtre type de réservation
    if (filters.reservationType) {
      query.where('reservation_type', filters.reservationType)
    }
  
    // Filtre utilisateur
    if (filters.userId) {
      query.where('user_id', filters.userId)
    }
  
    // Filtre rate plan
    if (filters.ratePlanId) {
      query.where('rate_plan_id', filters.ratePlanId)
    }
  
    // ============================================
    // EXÉCUTION DE LA REQUÊTE
    // ============================================
  
    const reservations = await query
    const totalRecords = reservations.length
  
    // Aucune donnée trouvée
    if (totalRecords === 0) {
      return {
        title: 'Liste des Arrivées',
        html: '<div class="no-data" style="padding: 40px; text-align: center; color: #666; font-size: 16px;">Aucune donnée trouvée pour la période sélectionnée</div>',
        datas: { data: [], summary: null },
        generatedAt: DateTime.now(),
        filters
      }
    }
  
    // ============================================
    // PRÉPARATION DES DONNÉES
    // ============================================
  
    // Déterminer quelles colonnes inclure
    const selectedColumns = filters.selectedColumns || []
    const includePickUp = selectedColumns.includes('pickUp')
    const includeDropOff = selectedColumns.includes('dropOff')
    const includeResType = selectedColumns.includes('resType')
    const includeCompany = selectedColumns.includes('company')
    const includeUser = selectedColumns.includes('user')
    const includeDeposit = selectedColumns.includes('deposit')
    const includeBalanceDue = selectedColumns.includes('balanceDue')
    const includeMarketCode = selectedColumns.includes('marketCode')
    const includeBusinessSource = selectedColumns.includes('businessSource')
    const includeMealPlan = selectedColumns.includes('mealPlan')
    const includeRateType = selectedColumns.includes('rateType')
  
    const data = reservations.map((reservation) => {
      const folio = reservation.folios?.[0]
      // Données de base TOUJOURS incluses
      const baseData: any = {
        reservationNumber: reservation.reservationNumber || 'N/A',
        guestName: `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim() || 'N/A',
        guestEmail: reservation.guest?.email || 'N/A',
        guestPhone: reservation.guest?.phonePrimary || 'N/A',
        hotelName: reservation.hotel?.hotelName || 'N/A',
        
        // Dates
        arrivalDate: reservation.arrivedDate?.toFormat('dd/MM/yyyy') || 'N/A',
        departureDate: reservation.departDate?.toFormat('dd/MM/yyyy') || 'N/A',
        arrivalTime: reservation.scheduledArrivalDate?.toFormat('HH:mm') || 'N/A',
        
        // Hébergement
        roomNumber: reservation.reservationRooms?.[0]?.room?.roomNumber || 'N/A',
        roomType: reservation.reservationRooms?.[0]?.roomType?.roomTypeName || 'N/A',
        roomTypeId: reservation.roomType?.id,
        
        // Tarifs - Selon showAmount
        ratePerNight: reservation.reservationRooms?.[0]?.roomRates?.baseRate || 0,
        totalAmount: reservation.totalEstimatedRevenue || 0,
        taxAmount: reservation.taxAmount || 0,
        discountAmount: reservation.discountAmount || 0,
        finalAmount: reservation.finalAmount || 0,
        
        // Affichage selon le filtre showAmount
        displayAmount: filters.showAmount === 'rent_per_night' 
          ? reservation.roomRate || 0
          : reservation.totalEstimatedRevenue || 0,
        
        // Occupants
        adults: reservation.adults || 0,
        children: reservation.children || 0,
        infants: reservation.infants || 0,
        totalPax: (reservation.adults || 0) + 
                  (reservation.children || 0) + 
                  (reservation.infants || 0),
        
        // Statut
        status: reservation.reservationStatus || 'N/A',
        
        // Nuits
        nights: reservation.numberOfNights || 0,
        
        // Taxes
        taxExempt: reservation.taxExempt
      }
  
      // ============================================
      // COLONNES CONDITIONNELLES (selon selectedColumns)
      // ============================================
      
      if (includePickUp) {
        baseData.pickUp = reservation.pickup_information || ''
      }
      
      if (includeDropOff) {
        baseData.dropOff = reservation.dropoffInformation || ''
      }
      
      if (includeResType) {
        baseData.reservationType = reservation.reservationType?.name || 'N/A'
      }
      
      if (includeCompany) {
        baseData.company = reservation.companyName || 'N/A'
      }
      
      if (includeUser) {
        baseData.createdBy = reservation.creator?.firstName
          ? `${reservation.creator.firstName} ${reservation.creator.lastName}`
          : 'System'
      }
      
      if (includeDeposit) {
        baseData.depositPaid = folio?.totalPayments ? Number(folio.totalPayments).toFixed(2) : '0.00'
      }
      
      if (includeBalanceDue) {
        baseData.balanceDue = folio?.balance ? Number(folio.balance).toFixed(2) : '0.00'
      }
      
      if (includeMarketCode) {
        baseData.marketSegment = reservation.marketingSource || 'N/A'
      }
      
      if (includeBusinessSource) {
        baseData.businessSource = reservation.bookingSource?.sourceName || 'N/A'
      }
      
      if (includeMealPlan) {
        baseData.mealPlan = reservation.board_basis_type || 'N/A'
      }
      
      if (includeRateType) {
        baseData.ratePlan = reservation.ratePlan?.planName || 'N/A'
      }
  
      // Informations commerciales (toujours incluses pour les résumés)
      baseData.travelAgent = reservation.travelAgentCode || 'N/A'
      baseData.isGuaranteed = reservation.isGuaranteed
      baseData.specialRequests = reservation.specialNotes || ''
      baseData.estimatedCheckinTime = reservation.estimatedCheckinTime || 'N/A'
      baseData.estimatedCheckoutTime = reservation.estimatedCheckoutTime || 'N/A'
      baseData.paymentStatus = reservation.paymentStatus || 'N/A'
  
      return baseData
    })
  
    // ============================================
    // CALCUL DES TOTAUX
    // ============================================
  
    const totalRevenue = data.reduce((sum, item) => {
      const amount = Number(item.finalAmount) || Number(item.totalAmount) || 0
      return sum + amount
    }, 0)
    
    const totalNights = data.reduce((sum, item) => sum + (item.nights || 0), 0)
    const totalAdults = data.reduce((sum, item) => sum + (item.adults || 0), 0)
    const totalChildren = data.reduce((sum, item) => sum + (item.children || 0), 0)
  
    const summary = {
      totalArrivals: totalRecords,
      totalRevenue,
      totalNights,
      totalAdults,
      totalChildren,
      totalPax: totalAdults + totalChildren,
      averageRate: totalNights > 0 ? totalRevenue / totalNights : 0,
      byStatus: ReservationReportsService.getStatusSummary(data),
      byRoomType: ReservationReportsService.getRoomTypeSummary(data),
      byMarket: ReservationReportsService.getMarketSummary(data)
    }
  
    // ============================================
    // GÉNÉRATION DU RAPPORT HTML
    // ============================================
  
    return {
      title: 'Liste des Arrivées',
      html: HtmlReportGenerator.generateArrivalListHtml(data, summary, filters, DateTime.now()),
      datas: { data, summary },
      generatedAt: DateTime.now(),
      filters
    }
  }
  // Méthodes helpers pour les résumés

  private static getStatusSummary(data: any[]) {
    const statusCount: { [key: string]: number } = {}
    data.forEach(item => {
      statusCount[item.status] = (statusCount[item.status] || 0) + 1
    })
    return statusCount
  }

  private static getRoomTypeSummary(data: any[]) {
    const roomTypeCount: { [key: string]: number } = {}
    data.forEach(item => {
      const roomType = item.roomType || 'Unknown'
      roomTypeCount[roomType] = (roomTypeCount[roomType] || 0) + 1
    })
    return roomTypeCount
  }

  private static getMarketSummary(data: any[]) {
    const marketCount: { [key: string]: number } = {}
    data.forEach(item => {
      const market = item.marketSegment || 'Unknown'
      marketCount[market] = (marketCount[market] || 0) + 1
    })
    return marketCount
  }

  /**
   * Departure List Report - Version améliorée
   * Liste des clients prévus pour le départ
   */
  static async getDepartureList(filters: ReportFilters): Promise<HtmlReport> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    console.log('Filters:', filters)
    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('bookingSource')
      .preload('ratePlan')
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room')
      })
      .preload('creator')
      .whereBetween('depart_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .orderBy('depart_date', 'asc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    // Filtre par type de chambre
    if (filters.roomType) {
      query.preload('reservationRooms', (roomQuery) => {
        roomQuery.where('room_type_id', filters.roomType)
      })
    }

    // Filtre par type de tarif
    if (filters.rateType) {
      query.where('rate_plan_id', filters.rateType)
    }

    // Filtre par utilisateur
    if (filters.user) {
      query.where('created_by', filters.user)
    }


    // Filtre fourchette de prix
    if (filters.rateFrom !== undefined || filters.rateTo !== undefined) {
      const rateField = filters.showAmount === 'rent_per_night' 
        ? 'room_rate' 
        : 'total_estimated_revenue'
  
      if (filters.rateFrom !== undefined && filters.rateTo !== undefined) {
        query.whereBetween(rateField, [filters.rateFrom, filters.rateTo])
      } else if (filters.rateFrom !== undefined) {
        query.where(rateField, '>=', filters.rateFrom)
      } else if (filters.rateTo !== undefined) {
        query.where(rateField, '<=', filters.rateTo)
      }
    }
  

    // Filtre par type de réservation
    if (filters.reservationType) {
      query.where('reservation_type', filters.reservationType)
    }

    // Filtre par compagnie
    if (filters.company) {
      query.where('company_name', 'like', `%${filters.company}%`)
    }

    // Filtre par agent de voyage
    if (filters.travelAgent) {
      query.where('travel_agent_code', 'like', `%${filters.travelAgent}%`)
    }

    // Filtre par source d'affaires
    if (filters.businessSource) {
      query.whereHas('bookingSource', (sourceQuery) => {
        sourceQuery.where('source_name', 'like', `%${filters.businessSource}%`)
      })
    }

    // Filtre par marché
    if (filters.market) {
      query.where('market_code_id', filters.market)
    }

    const reservations = await query
    const totalRecords = reservations.length

    // Préparer les données pour le rapport
    const data = reservations.map((reservation) => {
      const roomInfo = reservation.reservationRooms?.[0]?.room
      const roomType = reservation.roomType

      return {
        // Données de base pour les colonnes principales
        hotelName: reservation.hotel?.hotelName || 'N/A',
        resNo: reservation.reservationNumber || 'N/A',
        guest: reservation.guest? `${reservation.guest.firstName} ${reservation.guest.lastName}` : 'N/A',
        room: roomInfo ? `${roomInfo.roomNumber} - ${roomType?.roomTypeName || 'N/A'}` : 'N/A',
        rate: reservation.roomRate ? Number(reservation.roomRate).toFixed(2) : '0.00',
        arrival: reservation.arrivedDate?.toFormat('dd/MM/yyyy HH:mm') || 'N/A',
        departure: reservation.departDate?.toFormat('dd/MM/yyyy') || 'N/A',
        pax: `${reservation.numAdultsTotal || 0}/${reservation.numChildrenTotal || 0}`,
        BusiSour: reservation.bookingSource?.sourceName || 'N/A',
        restyp: reservation.reservationType || 'N/A',
        user: reservation.creator ? `${reservation.creator.firstName} ${reservation.creator.lastName}` : 'System',

        // Données supplémentaires pour les colonnes optionnelles
        pickUp: reservation.pickupInformation || '',
        dropOff: reservation.dropoffInformation || '',
        company: reservation.companyName || '',
        deposit: reservation.depositPaid || 0,
        balanceDue: reservation.balanceDue || 0,
        marketCode: reservation.marketingSource || 'N/A',
        mealPlan: reservation.board_basis_type || 'N/A',
        rateType: reservation.ratePlan?.planName || 'N/A'
      }
    })

    // Calcul des totaux
    const totalPax = data.reduce((sum, item) => {
      const paxCount = item.pax.split('/')[0]
      return sum + parseInt(paxCount || '0')
    }, 0)

    const summary = {
      totalReservations: totalRecords,
      totalPax: totalPax,
      totalRevenue: reservations.reduce((sum, res) => sum + (res.totalEstimatedRevenue || 0), 0),
      checkedOut: reservations.filter(res => res.reservationStatus === 'Checked-Out').length,
      pendingCheckout: reservations.filter(res => res.reservationStatus === 'Checked-In').length
    }

    // Générer le rapport HTML
    return {
      title: 'Liste des Départs',
      html: HtmlReportGenerator.generateDepartureListHtml(data, summary, filters, DateTime.now()),
      datas: {data, summary},
      generatedAt: DateTime.now(),
      filters,
    }
  }

  /**
   * Confirmed Reservations Report
   */
  static async getConfirmedReservations(filters: ReportFilters): Promise<ReportData> {
    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('bookingSource')
      .preload('ratePlan')
      .where('reservation_status', 'Confirmed')
      .orderBy('scheduled_arrival_date', 'asc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    if (filters.startDate && filters.endDate) {
      query.whereBetween('scheduled_arrival_date', [filters.startDate, filters.endDate])
    }

    const reservations = await query
    const totalRecords = reservations.length

    const data = reservations.map(reservation => ({
      reservationNumber: reservation.reservationNumber,
      guestName: `${reservation.guest?.firstName} ${reservation.guest?.lastName}`,
      arrivalDate: reservation.scheduledArrivalDate?.toFormat('dd/MM/yyyy'),
      departureDate: reservation.scheduledDepartureDate?.toFormat('dd/MM/yyyy'),
      nights: reservation.numberOfNights??reservation.nights,
      adults: reservation.numAdultsTotal,
      children: reservation.numChildrenTotal,
      roomType: reservation.roomType?.roomTypeName,
      bookingSource: reservation.bookingSource?.sourceName,
      ratePlan: reservation.ratePlan?.planName,
      totalAmount: reservation.totalEstimatedRevenue,
      reservationDate: reservation.reservationDatetime?.toFormat('dd/MM/yyyy HH:mm')
    }))

    return {
      title: 'Réservations Confirmées',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalConfirmed: totalRecords,
        totalRevenue: data.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
      },
    }
  }

  /**
   * Cancelled Reservations Report
   */
  /**
   * Cancelled Reservations Report - Version améliorée
   */
  static async getCancelledReservations(filters: ReportFilters): Promise<HtmlReport> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('bookingSource')
      .preload('ratePlan')
      .preload('folios')
      .preload('creator')
      .whereBetween('cancellation_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      //.where('reservation_status', 'Cancelled')
      .orderBy('cancellation_date', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }


    // Filtre par type de chambre
    if (filters.roomType) {
      query.where('room_type_id', filters.roomType)
    }

    // Filtre par type de tarif
    if (filters.rateType) {
      query.where('rate_plan_id', filters.rateType)
    }

    // Filtre par compagnie
    if (filters.company) {
      query.where('company_name', 'like', `%${filters.company}%`)
    }

    // Filtre par source d'affaires
    if (filters.businessSource) {
      query.whereHas('bookingSource', (sourceQuery) => {
        sourceQuery.where('source_name', 'like', `%${filters.businessSource}%`)
      })
    }

    // Filtre par agent de voyage
    if (filters.travelAgent) {
      query.where('travel_agent_code', 'like', `%${filters.travelAgent}%`)
    }

    const reservations = await query
    const totalRecords = reservations.length

    // Préparer les données pour le rapport
    const data = reservations.map((reservation) => {
      const folio = reservation.folios?.[0]

      return {
        // Données de base pour les colonnes principales
        //hotelName: reservation.hotel?.hotelName || 'N/A',
        resNo: reservation.reservationNumber || 'N/A',
        bookingDate: reservation.reservationDatetime?.toFormat('yyyy-MM-dd') || 'N/A',
        guest: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : 'N/A',
        rateType: reservation.ratePlan?.planName || 'N/A',
        arrival: reservation.arrivedDate?.toFormat('dd/MM') || 'N/A',
        departure: reservation.departDate?.toFormat('dd/MM') || 'N/A',
        folioNo: folio?.folioNumber || 'N/A',
        adr: reservation.roomRate ? Number(reservation.roomRate).toFixed(2) : '0.00',
        carRevenue: '0.00', // À adapter selon votre modèle de données
        charges: folio?.totalCharges ? Number(folio.totalCharges).toFixed(2) : '0.00',
        paid: folio?.totalPayments ? Number(folio.totalPayments).toFixed(2) : '0.00',
        balance: folio?.balance ? Number(folio.balance).toFixed(2) : '0.00',
        source: reservation.bookingSource?.sourceName || 'N/A',
        cancelledBy: reservation.creator ? `${reservation.creator.firstName} ${reservation.creator.lastName}` : 'System',
        cancelledDate: reservation.cancellationDate?.toFormat('yyyy-MM-dd') || 'N/A',
        remarks: reservation.cancellationReason || ''
      }
    })

    // Calcul des totaux
    const totalADR = data.reduce((sum, item) => sum + parseFloat(item.adr.replace(',', '') || '0'), 0)
    const totalCarRevenue = data.reduce((sum, item) => sum + parseFloat(item.carRevenue || '0'), 0)
    const totalCharges = data.reduce((sum, item) => sum + parseFloat(item.charges || '0'), 0)
    const totalPaid = data.reduce((sum, item) => sum + parseFloat(item.paid || '0'), 0)
    const totalBalance = data.reduce((sum, item) => sum + parseFloat(item.balance || '0'), 0)

    const summary = {
      totalCancelled: totalRecords,
      totalADR,
      totalCarRevenue,
      totalCharges,
      totalPaid,
      totalBalance,
      totalCancellationFees: data.reduce((sum, item) => sum + (parseFloat(item.adr.replace(',', '') || 0) * 0.1), 0), // Exemple: 10% de frais
      lostRevenue: data.reduce((sum, item) => sum + parseFloat(item.adr.replace(',', '') || 0), 0)
    }

    // Générer le rapport HTML
    return {
      title: 'Cancelled Reservations Report',
      html: HtmlReportGenerator.generateCancelledReservationsHtml(data, summary, filters, DateTime.now()),
      datas: {data, summary},
      generatedAt: DateTime.now(),
      filters
    }
  }

  /**
   * No Show Reservations Report
   */
  static async getNoShowReservations(filters: ReportFilters): Promise<ReportData> {
    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .where('reservation_status', 'No-Show')
      .orderBy('scheduled_arrival_date', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    if (filters.startDate && filters.endDate) {
      query.whereBetween('scheduled_arrival_date', [filters.startDate, filters.endDate])
    }

    const reservations = await query
    const totalRecords = reservations.length

    const data = reservations.map(reservation => ({
      reservationNumber: reservation.reservationNumber,
      guestName: `${reservation.guest?.firstName} ${reservation.guest?.lastName}`,
      guestPhone: reservation.guest?.phonePrimary,
      arrivalDate: reservation.scheduledArrivalDate?.toFormat('dd/MM/yyyy'),
      roomType: reservation.roomType?.roomTypeName,
      noShowReason: reservation.noShowReason,
      lostRevenue: reservation.totalEstimatedRevenue,
      isGuaranteed: reservation.isGuaranteed
    }))

    return {
      title: 'Réservations Non-Présentées',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalNoShows: totalRecords,
        guaranteedNoShows: data.filter(item => item.isGuaranteed).length,
        totalLostRevenue: data.reduce((sum, item) => sum + (item.lostRevenue || 0), 0)
      }
    }
  }

  /**
   * Reservation Forecast Report
   */
  static async getReservationForecast(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now()
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().plus({ days: 30 })

    const query = Database.from('reservations')
      .select(
        Database.raw('DATE(scheduled_arrival_date) as date'),
        Database.raw('COUNT(*) as total_reservations'),
        Database.raw('SUM(num_adults_total) as total_adults'),
        Database.raw('SUM(num_children_total) as total_children'),
        Database.raw('SUM(total_estimated_revenue) as total_revenue')
      )
      .whereBetween('scheduled_arrival_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .whereIn('reservation_status', ['Confirmed', 'Guaranteed'])
      .groupByRaw('DATE(scheduled_arrival_date)')
      .orderBy('date', 'asc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    const forecast = await query
    const totalRecords = forecast.length

    return {
      title: 'Prévisions de Réservation',
      generatedAt: DateTime.now(),
      filters,
      data: forecast,
      totalRecords,
      summary: {
        totalDays: totalRecords,
        totalReservations: forecast.reduce((sum, item) => sum + item.total_reservations, 0),
        totalRevenue: forecast.reduce((sum, item) => sum + (item.total_revenue || 0), 0),
        averageReservationsPerDay: totalRecords > 0 ? forecast.reduce((sum, item) => sum + item.total_reservations, 0) / totalRecords : 0
      }
    }
  }

  /**
   * Void Reservations Report - Version améliorée
   */
  static async getVoidReservations(filters: ReportFilters): Promise<HtmlReport> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('bookingSource')
      .preload('ratePlan')
      .preload('folios')
      //.preload('creator')
      .whereBetween('voided_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')]) 
      //.where('reservation_status', 'Void')
      .orderBy('voided_date', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

 
    const reservations = await query
    const totalRecords = reservations.length

    // Préparer les données pour le rapport
    const data = reservations.map((reservation) => {
      const folio = reservation.folios?.[0]
      return {
        // Données de base pour les colonnes principales
        hotelName: reservation.hotel?.hotelName || 'N/A',
        resNo: reservation.reservationNumber || 'N/A',
        bookingDate: reservation.reservationDatetime?.toFormat('yyyy-MM-dd') || 'N/A',
        guest: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : 'N/A',
        rateType: reservation.ratePlan?.planName || 'N/A',
        arrival: reservation.arrivedDate?.toFormat('yyyy-MM-dd') || 'N/A',
        departure: reservation.departDate?.toFormat('yyyy-MM-dd') || 'N/A',
        folioNo: folio?.folioNumber || 'N/A',
        adr: reservation.roomRate ? Number(reservation.roomRate).toFixed(2) : '0.00',
        carRevenue: '0.00', // À adapter selon votre modèle de données
        charges: folio?.totalCharges ? Number(folio.totalCharges).toFixed(2) : '0.00',
        paid: folio?.totalPayments ? Number(folio.totalPayments).toFixed(2) : '0.00',
        balance: folio?.balance ? Number(folio.balance).toFixed(2) : '0.00',
        source: reservation.bookingSource?.sourceName || 'N/A',
        cancelledBy: reservation.creator ? `${reservation.creator.firstName} ${reservation.creator.lastName}` : 'System',
        cancelledDate: reservation.voidedDate?.toFormat('yyyy-MM-dd') || 'N/A',
        remarks: reservation.cancellationReason || ''
      }
    })

    // Calcul des totaux
    const totalADR = data.reduce((sum, item) => sum + parseFloat(item.adr.replace(',', '') || '0'), 0)
    const totalCarRevenue = data.reduce((sum, item) => sum + parseFloat(item.carRevenue || '0'), 0)
    const totalCharges = data.reduce((sum, item) => sum + parseFloat(item.charges || '0'), 0)
    const totalPaid = data.reduce((sum, item) => sum + parseFloat(item.paid || '0'), 0)
    const totalBalance = data.reduce((sum, item) => sum + parseFloat(item.balance || '0'), 0)

    const summary = {
      totalCancelled: totalRecords,
      totalADR,
      totalCarRevenue,
      totalCharges,
      totalPaid,
      totalBalance,
      lostRevenue: data.reduce((sum, item) => sum + parseFloat(item.adr.replace(',', '') || 0), 0)
    }

    // Générer le rapport HTML
    return {
      title: 'Void Reservations Report',
      html: HtmlReportGenerator.generateVoidReservationsHtml(data, summary, filters, DateTime.now()),
      datas: {data, summary},
      generatedAt: DateTime.now(),
      filters
    }
  }

}

export class FrontOfficeReportsService {
  /**
   * Guest Checked In Report
   */
/**
 * Guest Checked In Report
 */
/**
 * Guest Checked In Report
 */
  static async getGuestCheckedIn(filters: ReportFilters): Promise<HtmlReport> {
    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room')
      })
      .preload('bookingSource')
      .preload('ratePlan')
      //.preload('creator')
      //.where('reservation_status', 'Checked_in')
      .orderBy('check_in_date', 'desc')

    // Filtre par hôtel
    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    // Filtres de date d'arrivée
    if (filters.arrivalFrom) {
      const arrivalFromDate = DateTime.fromFormat(filters.arrivalFrom, 'dd/MM/yyyy')
      query.where('check_in_date', '>=', arrivalFromDate.toFormat('yyyy-MM-dd'))
    }

    if (filters.arrivalTo) {
      const arrivalToDate = DateTime.fromFormat(filters.arrivalTo, 'dd/MM/yyyy')
      query.where('check_in_date', '<=', arrivalToDate.plus({ days: 1 }).toFormat('yyyy-MM-dd'))
    }

    // Filtre par type de chambre
    if (filters.roomType) {
      query.where('primary_room_type_id', filters.roomType)
    }

    // Filtre par type de tarif
    if (filters.rateType) {
      query.where('rate_plan_id', filters.rateType)
    }

    // Filtre par utilisateur (créateur)
    if (filters.user) {
      query.where('created_by', filters.user)
    }

    // Filtre par fourchette de prix
    if (filters.rateFrom !== undefined || filters.rateTo !== undefined) {
      if (filters.rateFrom !== undefined && filters.rateTo !== undefined) {
        query.whereBetween('room_rate', [filters.rateFrom, filters.rateTo])
      } else if (filters.rateFrom !== undefined) {
        query.where('room_rate', '>=', filters.rateFrom)
      } else if (filters.rateTo !== undefined) {
        query.where('room_rate', '<=', filters.rateTo)
      }
    }

    // Filtre par type de réservation
    if (filters.reservationType) {
      query.where('reservation_type', filters.reservationType)
    }

    // Filtre par compagnie
    if (filters.company) {
      query.where('company_name', 'like', `%${filters.company}%`)
    }

    // Filtre par agent de voyage
    if (filters.travelAgent) {
      query.where('travel_agent_code', 'like', `%${filters.travelAgent}%`)
    }

    // Filtre par source d'affaires
    if (filters.businessSource) {
      query.whereHas('bookingSource', (sourceQuery) => {
        sourceQuery.where('source_name', 'like', `%${filters.businessSource}%`)
      })
    }

    // Filtre par marché
    if (filters.market) {
      query.where('marketing_source', filters.market)
    }

    // Filtre taxInclusive - si true, seulement les réservations où tax_exempt = false (taxes incluses)
    if (filters.taxInclusive) {
      query.where('tax_exempt', false)
    }

    // Filtre checkin (direct check-in) - si true, seulement les réservations avec check-in direct
    if (filters.checkin) {
      query.whereNotNull('check_in_date')
    }

    const reservations = await query
    const totalRecords = reservations.length

    // Préparer les données pour le rapport
    const data = reservations.map((reservation) => {
      const roomInfo = reservation.reservationRooms?.[0]?.room
      const roomType = reservation.roomType

      return {
        // Données de base pour les colonnes principales
        hotelName: reservation.hotel?.hotelName || 'N/A',
        resNo: reservation.reservationNumber || 'N/A',
        guest: reservation.guest ? `${reservation.guest.firstName} ${reservation.guest.lastName}` : 'N/A',
        room: roomInfo ? `${roomInfo.roomNumber} - ${roomType?.roomTypeName || 'N/A'}` : 'N/A',
        rate: reservation.roomRate ? Number(reservation.roomRate).toFixed(2) : '0.00',
        arrival: reservation.actualArrivalDatetime?.toFormat('dd/MM/yyyy HH:mm') || 'N/A',
        departure: reservation.scheduledDepartureDate?.toFormat('dd/MM/yyyy') || 'N/A',
        pax: `${reservation.numAdultsTotal || 0}/${reservation.numChildrenTotal || 0}`,
        BusiSour: reservation.bookingSource?.sourceName || 'N/A',
        restyp: reservation.reservationType || 'N/A',
        user: reservation.creator ? `${reservation.creator.firstName} ${reservation.creator.lastName}` : 'System',

        // Données supplémentaires pour les colonnes optionnelles
        pickUp: reservation.pickupInformation || '',
        dropOff: reservation.dropoffInformation || '',
        company: reservation.companyName || '',
        deposit: reservation.depositPaid || 0,
        balanceDue: reservation.balanceDue || 0,
        marketCode: reservation.marketingSource || 'N/A',
        mealPlan: reservation.board_basis_type || 'N/A',
        rateType: reservation.ratePlan?.planName || 'N/A',
        
        // Informations supplémentaires
        guestEmail: reservation.guest?.email || '',
        guestPhone: reservation.guest?.phonePrimary || '',
        nights: reservation.numberOfNights || 0,
        totalAmount: reservation.totalEstimatedRevenue || 0
      }
    })

    // Calcul des totaux
    const totalPax = data.reduce((sum, item) => {
      const paxCount = item.pax.split('/')[0]
      return sum + parseInt(paxCount || '0')
    }, 0)

    const totalRevenue = data.reduce((sum, item) => sum + (parseFloat(item.rate) || 0), 0)

    const summary = {
      totalReservations: totalRecords,
      totalPax: totalPax,
      totalRevenue: totalRevenue,
      averageRate: totalRecords > 0 ? totalRevenue / totalRecords : 0
    }

    // Générer le rapport HTML
    return {
      title: 'Clients Enregistrés',
      html: HtmlReportGenerator.generateGuestCheckedInHtml(data, summary, filters, DateTime.now()),
      generatedAt: DateTime.now(),
      filters
    }
  }

  /**
   * Guest Checked Out Report
   */
/**
 * Guest Checked Out Report - Retourne les données soit par folio soit par booking
 */
  static async getGuestCheckedOut(filters: ReportFilters): Promise<HtmlReport> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    const query = Reservation.query()
      .preload('guest')
      .preload('hotel')
      .preload('roomType')
      .preload('reservationRooms', (roomQuery) => {
        roomQuery.preload('room')
      })
      .preload('folios', (folioQuery) => {
        folioQuery.preload('transactions')
      })
      .preload('bookingSource')
      .preload('ratePlan')
      .where('reservation_status', 'Checked-Out')
      .whereBetween('actual_departure_datetime', [startDate.toString(), endDate.toString()])
      .orderBy('actual_departure_datetime', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    // Filtres supplémentaires
    if (filters.roomTypeId) {
      query.where('primary_room_type_id', filters.roomTypeId)
    }

    if (filters.guestId) {
      query.where('guest_id', filters.guestId)
    }

    if (filters.bookingSourceId) {
      query.where('booking_source_id', filters.bookingSourceId)
    }

    if (filters.ratePlanId) {
      query.where('rate_plan_id', filters.ratePlanId)
    }

    const reservations = await query
    const totalRecords = reservations.length

    // Déterminer le format de retour des données
    const dataFormat = filters.status || 'booking'

    let data: any[] = []

    if (dataFormat === 'folio') {
      data = this.formatDataByFolio(reservations)
    } else {
      data = this.formatDataByBooking(reservations)
    }

    const summary = this.calculateSummary(data, dataFormat)

    return {
      title: 'Clients Sortis',
      html: HtmlReportGenerator.generateGuestCheckedOutHtml(data, summary, filters, DateTime.now()),
      generatedAt: DateTime.now(),
      filters
    }
  }

/**
 * Format les données par FOLIO (regroupement par folio)
 */
  private static formatDataByFolio(reservations: Reservation[]): any[] {
    const folioData: any[] = []

    reservations.forEach(reservation => {
      reservation.folios?.forEach(folio => {
        const totalCharges = folio.transactions
          ?.filter(t => t.transactionType === TransactionType.CHARGE)
          .reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        const totalPayments = folio.transactions
          ?.filter(t => t.transactionType === TransactionType.PAYMENT)
          .reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        const balance = totalCharges - totalPayments

        folioData.push({
          // Informations folio
          folioNumber: folio.folioNumber,
          folioType: folio.folioType,
          folioStatus: folio.status,
          
          // Informations réservation
          reservationNumber: reservation.reservationNumber,
          guestName: `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim(),
          
          // Informations chambre
          roomNumbers: reservation.reservationRooms?.map(rr => rr.room?.roomNumber).filter(Boolean).join(', '),
          roomType: reservation.roomType?.roomTypeName,
          
          // Dates
          checkinDate: reservation.actualArrivalDatetime?.toFormat('dd/MM/yyyy HH:mm'),
          checkoutDate: reservation.actualDepartureDatetime?.toFormat('dd/MM/yyyy HH:mm'),
          
          // Financial
          totalCharges,
          totalPayments,
          balance,
          paymentStatus: folio.paymentStatus,
          
          // Métadonnées
          company: reservation.companyName,
          travelAgent: reservation.travelAgentCode,
          bookingSource: reservation.bookingSource?.sourceName,
          ratePlan: reservation.ratePlan?.planName
        })
      })
    })

    return folioData
  }

/**
 * Format les données par BOOKING (regroupement par réservation)
 */
  private static formatDataByBooking(reservations: Reservation[]): any[] {
    return reservations.map(reservation => {
      // Calculer les totaux de tous les folios de la réservation
      let totalCharges = 0
      let totalPayments = 0
      let folioCount = 0

      reservation.folios?.forEach(folio => {
        const folioCharges = folio.transactions
          ?.filter(t => t.transactionType === TransactionType.CHARGE)
          .reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        const folioPayments = folio.transactions
          ?.filter(t => t.transactionType === TransactionType.PAYMENT)
          .reduce((sum, t) => sum + (t.amount || 0), 0) || 0

        totalCharges += folioCharges
        totalPayments += folioPayments
        folioCount++
      })

      const balance = totalCharges - totalPayments

      // Calcul du nombre de nuits réelles
      let actualNights = 0
      if (reservation.actualArrivalDatetime && reservation.actualDepartureDatetime) {
        actualNights = Math.ceil(reservation.actualDepartureDatetime.diff(reservation.actualArrivalDatetime, 'days').days)
      }

      return {
        // Informations réservation
        reservationNumber: reservation.reservationNumber,
        guestName: `${reservation.guest?.firstName || ''} ${reservation.guest?.lastName || ''}`.trim(),
        guestEmail: reservation.guest?.email,
        guestPhone: reservation.guest?.phonePrimary,
        
        // Informations chambre
        roomNumbers: reservation.reservationRooms?.map(rr => rr.room?.roomNumber).filter(Boolean).join(', '),
        roomType: reservation.roomType?.roomTypeName,
        
        // Dates
        checkinDate: reservation.actualArrivalDatetime?.toFormat('dd/MM/yyyy HH:mm'),
        checkoutDate: reservation.actualDepartureDatetime?.toFormat('dd/MM/yyyy HH:mm'),
        actualNights,
        
        // Financial
        roomRate: reservation.roomRate,
        totalCharges,
        totalPayments,
        balance,
        paymentStatus: reservation.paymentStatus,
        
        // Informations commerciales
        company: reservation.companyName,
        travelAgent: reservation.travelAgentCode,
        bookingSource: reservation.bookingSource?.sourceName,
        ratePlan: reservation.ratePlan?.planName,
        
        // Métadonnées
        folioCount,
        adults: reservation.numAdultsTotal,
        children: reservation.numChildrenTotal
      }
    })
  }

/**
 * Calcule les résumés selon le format de données
 */
  private static calculateSummary(data: any[], dataFormat: string): any {
    const summary: any = {
      totalCheckedOut: data.length,
      totalRevenue: data.reduce((sum, item) => sum + (item.totalCharges || 0), 0),
      totalPayments: data.reduce((sum, item) => sum + (item.totalPayments || 0), 0),
      totalBalance: data.reduce((sum, item) => sum + (item.balance || 0), 0)
    }

    if (dataFormat === 'booking') {
      // Résumé spécifique au format booking
      summary.totalGuests = data.reduce((sum, item) => sum + (item.adults || 0) + (item.children || 0), 0)
      summary.totalNights = data.reduce((sum, item) => sum + (item.actualNights || 0), 0)
      summary.averageStayLength = data.length > 0 ? summary.totalNights / data.length : 0
      summary.averageDailyRate = summary.totalNights > 0 ? summary.totalRevenue / summary.totalNights : 0
    } else {
      // Résumé spécifique au format folio
      summary.totalFolios = data.length
    }

    // Statistiques par statut de paiement
    summary.byPaymentStatus = {}
    data.forEach(item => {
      const status = item.paymentStatus || 'Unknown'
      summary.byPaymentStatus[status] = (summary.byPaymentStatus[status] || 0) + 1
    })

    return summary
  }

  /**
   * Room Availability Report
   */
  static async getRoomAvailability(filters: ReportFilters): Promise<ReportData> {
    const targetDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now()

    const query = Room.query()
      .preload('hotel')
      .preload('roomType')
      .orderBy('sort_key', 'asc')
      .orderBy('roomNumber', 'asc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    if (filters.roomTypeId) {
      query.where('room_type_id', filters.roomTypeId)
    }

    const rooms = await query

    // Check occupancy for the target date
    const occupiedRoomsResult = await Database
      .from('reservation_rooms')
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .where('reservations.reservation_status', 'Checked-In')
      .where('reservation_rooms.check_in_date', '<=', targetDate.toFormat('yyyy-MM-dd'))
      .where('reservation_rooms.check_out_date', '>', targetDate.toFormat('yyyy-MM-dd'))
      .select('reservation_rooms.room_id')
    
    const occupiedRooms = occupiedRoomsResult.map(row => row.room_id)

    const data = rooms.map(room => ({
      roomNumber: room.roomNumber,
      roomName: room.description,
      roomType: room.roomType?.id,
      floor: room.floorNumber,
      maxOccupancy: room.maxOccupancy,
      status: room.status,
      housekeepingStatus: room.housekeepingStatus,
      maintenanceStatus: room.status,
      isOccupied: occupiedRooms.includes(room.id),
      isAvailable: room.status === 'available' && !occupiedRooms.includes(room.id) && room.housekeepingStatus === 'clean'
    }))

    const totalRecords = data.length

    return {
      title: 'Disponibilité des Chambres',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalRooms: totalRecords,
        availableRooms: data.filter(room => room.isAvailable).length,
        occupiedRooms: data.filter(room => room.isOccupied).length,
        outOfOrderRooms: data.filter(room => room.status === 'out_of_order').length,
        maintenanceRooms: data.filter(room => room.status === 'maintenance').length,
        dirtyRooms: data.filter(room => room.housekeepingStatus === 'dirty').length
      }
    }
  }

  /**
   * Room Status Report
   */
  static async getRoomStatus(filters: ReportFilters): Promise<ReportData> {
    const query = Room.query()
      .preload('hotel')
      .preload('roomType')
      .preload('cleaningStatuses', (cleaningQuery) => {
        cleaningQuery.orderBy('created_at', 'desc').limit(1)
      })
      .orderBy('roomNumber', 'asc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    const rooms = await query
    const totalRecords = rooms.length

    const data = rooms.map(room => {
      const latestCleaning = room.cleaningStatuses?.[0]
      return {
        roomNumber: room.roomNumber,
        roomType: room.roomType?.id,
        floor: room.floorNumber,
        roomStatus: room.status,
        housekeepingStatus: room.housekeepingStatus,
        maintenanceStatus: room.status,
        lastCleaningDate: latestCleaning?.completedAt?.toFormat('dd/MM/yyyy HH:mm'),
        cleaningStatus: latestCleaning?.status,
        assignedTo: latestCleaning?.assignedTo,
        notes: room.notes
      }
    })

    return {
      title: 'État des Chambres',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalRooms: totalRecords,
        cleanRooms: data.filter(room => room.housekeepingStatus === 'clean').length,
        dirtyRooms: data.filter(room => room.housekeepingStatus === 'dirty').length,
        inspectedRooms: data.filter(room => room.housekeepingStatus === 'inspected').length,
        maintenanceRooms: data.filter(room => room.maintenanceStatus === 'maintenance').length
      }
    }
  }

  /**
   * Task List Report
   */
  static async getTaskList(filters: ReportFilters): Promise<ReportData> {
    const query = Task.query()
        .preload('assignedUser')
        .orderBy('createdAt', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    if (filters.status) {
      query.where('status', filters.status)
    }

    if (filters.userId) {
      query.where('assigned_to', filters.userId)
    }

    const tasks = await query
    const totalRecords = tasks.length

    const data = tasks.map(task => ({
      taskId: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignedTo: task.assignedUser ? `${task.assignedUser.firstName} ${task.assignedUser.lastName}` : null,
      createdBy: null,
      dueDate: task.due_date?.toFormat('dd/MM/yyyy HH:mm'),
      createdAt: task.createdAt?.toFormat('dd/MM/yyyy HH:mm'),
      completedAt: null
    }))

    return {
      title: 'Liste des Tâches',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalTasks: totalRecords,
        pendingTasks: data.filter(task => task.status === 'pending' || task.status === 'todo' || task.status === 'in_progress').length,
        inProgressTasks: data.filter(task => task.status === 'in_progress').length,
        completedTasks: data.filter(task => task.status === 'done').length,
        overdueTasks: data.filter(task => {
            if (!task.dueDate || task.status === 'done') return false
          return DateTime.fromFormat(task.dueDate, 'dd/MM/yyyy HH:mm') < DateTime.now()
        }).length
      }
    }
  }
}

export class BackOfficeReportsService {
  /**
   * Revenue Reports
   */
  static async getRevenueReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    const query = Database.from('folio_transactions')
      .join('folios', 'folio_transactions.folio_id', 'folios.id')
      .join('reservations', 'folios.reservation_id', 'reservations.id')
      .leftJoin('room_types', 'reservations.primary_room_type_id', 'room_types.id')
      .select(
        Database.raw('DATE(folio_transactions.transaction_date) as date'),
        'room_types.type_name as room_type',
        Database.raw('SUM(CASE WHEN folio_transactions.transaction_type = \'charge\' THEN folio_transactions.amount ELSE 0 END) as total_revenue'),
        Database.raw('COUNT(DISTINCT reservations.id) as total_reservations')
      )
      .whereBetween('folio_transactions.transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .groupByRaw('DATE(folio_transactions.transaction_date)').groupBy('room_types.type_name')
      .orderBy('date', 'asc')

    if (filters.hotelId) {
      query.where('reservations.hotel_id', filters.hotelId)
    }

    const revenue = await query
    const totalRecords = revenue.length

    return {
      title: 'Rapport de Revenus',
      generatedAt: DateTime.now(),
      filters,
      data: revenue,
      totalRecords,
      summary: {
        totalRevenue: revenue.reduce((sum, item) => sum + (item.total_revenue || 0), 0),
        totalReservations: revenue.reduce((sum, item) => sum + item.total_reservations, 0),
        averageDailyRevenue: totalRecords > 0 ? revenue.reduce((sum, item) => sum + (item.total_revenue || 0), 0) / totalRecords : 0
      }
    }
  }

  /**
   * Expense Reports
   */
  static async getExpenseReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    const query = Expense.query()
      .whereBetween('expense_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .orderBy('expense_date', 'desc')

    if (filters.hotelId) {
      query.where('hotel_id', filters.hotelId)
    }

    const expenses = await query
    const totalRecords = expenses.length

    const data = expenses.map(expense => ({
      expenseId: expense.id,
      expenseDate: expense.expense_date ? new Date(expense.expense_date).toLocaleDateString('en-GB') : null,
      description: expense.description,
      amount: expense.total_amount,
      category: null,
        supplier: null,
      paymentMethod: expense.payment_method,
      status: expense.status,
      createdBy: null
    }))

    return {
      title: 'Rapport des Dépenses',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalExpenses: totalRecords,
        totalAmount: data.reduce((sum, item) => sum + (item.amount || 0), 0),
        averageExpense: totalRecords > 0 ? data.reduce((sum, item) => sum + (item.amount || 0), 0) / totalRecords : 0
      }
    }
  }

  /**
   * Cashier Reports
   */
  static async getCashierReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    const query = FolioTransaction.query()
      .preload('folio', (folioQuery) => {
        folioQuery.preload('reservation', (reservationQuery) => {
          reservationQuery.preload('guest')
        })
      })
      .where('transaction_type', TransactionType.PAYMENT)
      .whereBetween('transaction_date', [startDate.toString(), endDate.toString()])
      .orderBy('transaction_date', 'desc')

    if (filters.hotelId) {
      query.whereHas('folio', (folioQuery) => {
        folioQuery.whereHas('reservation', (reservationQuery) => {
          reservationQuery.where('hotel_id', filters.hotelId!)
        })
      })
    }

    if (filters.userId) {
      query.where('created_by', filters.userId)
    }

    const payments = await query
    const totalRecords = payments.length

    const data = payments.map(payment => ({
      paymentId: payment.id,
      paymentDate: payment.transactionDate?.toFormat('dd/MM/yyyy HH:mm'),
      amount: payment.amount,
      paymentMethod: payment.description, // Using description as payment method info
      guestName: payment.folio?.reservation?.guest ? `${payment.folio.reservation.guest.firstName} ${payment.folio.reservation.guest.lastName}` : null,
      reservationNumber: payment.folio?.reservation?.confirmationCode,
      processedBy: payment.createdBy,
      status: payment.status,
      transactionReference: payment.reference
    }))

    return {
      title: 'Rapport de Caisse',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalTransactions: totalRecords,
        totalAmount: data.reduce((sum, item) => sum + (item.amount || 0), 0),
        successfulPayments: data.filter(payment => payment.status === TransactionStatus.COMPLETED).length,
        failedPayments: data.filter(payment => payment.status === TransactionStatus.FAILED).length
      }
    }
  }
}

export class AuditReportsService {
  /**
   * User Activity Log Report
   */
  static async getUserActivityLog(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('day')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('day')

    const query = ActivityLog.query()
      .preload('user')
      .whereBetween('created_at', [startDate.toString(), endDate.toString()])
      .orderBy('created_at', 'desc')

    if (filters.userId) {
      query.where('user_id', filters.userId)
    }

    const activities = await query
    const totalRecords = activities.length

    const data = activities.map(activity => ({
      activityId: activity.id,
      timestamp: activity.createdAt?.toFormat('dd/MM/yyyy HH:mm:ss'),
      user: activity.user ? `${activity.user.firstName} ${activity.user.lastName}` : null,
      action: activity.action,
      description: activity.description,
      ipAddress: activity.ipAddress,
      userAgent: activity.userAgent,
      affectedModel: activity.entityType,
      affectedId: activity.entityId
    }))

    return {
      title: 'Journal d\'Activité des Utilisateurs',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalActivities: totalRecords,
        uniqueUsers: [...new Set(data.map(item => item.user))].length,
        mostActiveUser: this.getMostFrequentValue(data.map(item => item.user))
      }
    }
  }

  private static getMostFrequentValue(arr: (string | null)[]): string | null {
    const frequency: { [key: string]: number } = {}
    let maxCount = 0
    let mostFrequent: string | null = null

    arr.forEach(item => {
      if (item) {
        frequency[item] = (frequency[item] || 0) + 1
        if (frequency[item] > maxCount) {
          maxCount = frequency[item]
          mostFrequent = item
        }
      }
    })

    return mostFrequent
  }
}

export class StatisticalReportsService {
  /**
   * Occupancy Report
   */
  static async getOccupancyReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    // Get total rooms by hotel
    const totalRoomsQuery = Database.from('rooms')
      .select('hotel_id')
      .count('* as total_rooms')
      .groupBy('hotel_id')

    if (filters.hotelId) {
      totalRoomsQuery.where('hotel_id', filters.hotelId)
    }

    const totalRoomsData = await totalRoomsQuery

    // Get occupancy data
    const occupancyQuery = Database.from('reservation_rooms')
      .join('reservations', 'reservation_rooms.reservation_id', 'reservations.id')
      .select(
        'reservations.hotel_id',
        Database.raw('DATE(reservation_rooms.check_in_date) as date'),
        Database.raw('COUNT(DISTINCT reservation_rooms.room_id) as occupied_rooms')
      )
      .whereBetween('reservation_rooms.check_in_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .where('reservations.reservation_status', 'Checked-In')
      .groupBy('reservations.hotel_id')
      .groupByRaw('DATE(reservation_rooms.check_in_date)')
      .orderBy('date', 'asc')

    if (filters.hotelId) {
      occupancyQuery.where('reservations.hotel_id', filters.hotelId)
    }

    const occupancyData = await occupancyQuery

    // Calculate occupancy rates
    const data = occupancyData.map(item => {
      const totalRooms = totalRoomsData.find(tr => tr.hotel_id === item.hotel_id)?.total_rooms || 1
      const occupancyRate = (item.occupied_rooms / totalRooms) * 100

      return {
        date: item.date,
        hotelId: item.hotel_id,
        totalRooms,
        occupiedRooms: item.occupied_rooms,
        availableRooms: totalRooms - item.occupied_rooms,
        occupancyRate: Math.round(occupancyRate * 100) / 100
      }
    })

    const totalRecords = data.length

    return {
      title: 'Rapport d\'Occupation',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        averageOccupancyRate: totalRecords > 0 ? data.reduce((sum, item) => sum + item.occupancyRate, 0) / totalRecords : 0,
        maxOccupancyRate: Math.max(...data.map(item => item.occupancyRate)),
        minOccupancyRate: Math.min(...data.map(item => item.occupancyRate)),
        totalRoomNights: data.reduce((sum, item) => sum + item.occupiedRooms, 0)
      }
    }
  }

  /**
   * ADR (Average Daily Rate) Report
   */
  static async getADRReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    const query = Database.from('folio_transactions')
      .join('folios', 'folio_transactions.folio_id', 'folios.id')
      .join('reservations', 'folios.reservation_id', 'reservations.id')
      .join('reservation_rooms', 'reservations.id', 'reservation_rooms.reservation_id')
      .select(
        Database.raw('DATE(folio_transactions.transaction_date) as date'),
        Database.raw('SUM(CASE WHEN folio_transactions.transaction_type = \'charge\' THEN folio_transactions.amount ELSE 0 END) as total_room_revenue'),
        Database.raw('COUNT(DISTINCT reservation_rooms.room_id) as rooms_sold')
      )
      .whereBetween('folio_transactions.transaction_date', [startDate.toFormat('yyyy-MM-dd'), endDate.toFormat('yyyy-MM-dd')])
      .where('folio_transactions.description', 'LIKE', '%room%')
      .groupByRaw('DATE(folio_transactions.transaction_date)')
      .orderBy('date', 'asc')

    if (filters.hotelId) {
      query.where('reservations.hotel_id', filters.hotelId)
    }

    const adrData = await query

    const data = adrData.map(item => ({
      date: item.date,
      totalRoomRevenue: item.total_room_revenue,
      roomsSold: item.rooms_sold,
      adr: item.rooms_sold > 0 ? Math.round((item.total_room_revenue / item.rooms_sold) * 100) / 100 : 0
    }))

    const totalRecords = data.length

    return {
      title: 'Rapport ADR (Tarif Journalier Moyen)',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        averageADR: totalRecords > 0 ? data.reduce((sum, item) => sum + item.adr, 0) / totalRecords : 0,
        maxADR: Math.max(...data.map(item => item.adr)),
        minADR: Math.min(...data.map(item => item.adr)),
        totalRoomRevenue: data.reduce((sum, item) => sum + item.totalRoomRevenue, 0),
        totalRoomsSold: data.reduce((sum, item) => sum + item.roomsSold, 0)
      }
    }
  }

  /**
   * RevPAR (Revenue Per Available Room) Report
   */
  static async getRevPARReport(filters: ReportFilters): Promise<ReportData> {
    // Get ADR data
    const adrData = await this.getADRReport(filters)
    
    // Get occupancy data
    const occupancyData = await this.getOccupancyReport(filters)

    // Combine data to calculate RevPAR
    const data = adrData.data.map(adrItem => {
      const occupancyItem = occupancyData.data.find(occItem => occItem.date === adrItem.date)
      const occupancyRate = occupancyItem ? occupancyItem.occupancyRate / 100 : 0
      const revpar = adrItem.adr * occupancyRate

      return {
        date: adrItem.date,
        adr: adrItem.adr,
        occupancyRate: occupancyItem ? occupancyItem.occupancyRate : 0,
        revpar: Math.round(revpar * 100) / 100,
        totalRooms: occupancyItem ? occupancyItem.totalRooms : 0,
        roomRevenue: adrItem.totalRoomRevenue
      }
    })

    const totalRecords = data.length

    return {
      title: 'Rapport RevPAR (Revenu par Chambre Disponible)',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        averageRevPAR: totalRecords > 0 ? data.reduce((sum, item) => sum + item.revpar, 0) / totalRecords : 0,
        maxRevPAR: Math.max(...data.map(item => item.revpar)),
        minRevPAR: Math.min(...data.map(item => item.revpar)),
        totalRevenue: data.reduce((sum, item) => sum + item.roomRevenue, 0)
      }
    }
  }

  /**
   * Market Segment Analysis
   */
  static async getMarketSegmentAnalysis(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    const query = Database.from('reservations')
      .join('booking_sources', 'reservations.booking_source_id', 'booking_sources.id')
      .leftJoin('rate_plans', 'reservations.rate_plan_id', 'rate_plans.id')
      .select(
        'booking_sources.sourceName as segment',
        'rate_plans.planName as rate_plan',
        Database.raw('COUNT(*) as total_reservations'),
        Database.raw('SUM(reservations.total_estimated_revenue) as total_revenue'),
        Database.raw('AVG(reservations.total_estimated_revenue) as average_revenue'),
        Database.raw('SUM(reservations.num_adults_total + reservations.num_children_total) as total_guests')
      )
      .whereBetween('reservations.reservation_datetime', [startDate.toString(), endDate.toString()])
      .whereIn('reservations.reservation_status', ['Confirmed', 'Checked-In', 'Checked-Out'])
      .groupBy('booking_sources.sourceName', 'rate_plans.planName')
      .orderBy('total_revenue', 'desc')

    if (filters.hotelId) {
      query.where('reservations.hotel_id', filters.hotelId)
    }

    const segments = await query
    const totalRecords = segments.length

    return {
      title: 'Analyse des Segments de Marché',
      generatedAt: DateTime.now(),
      filters,
      data: segments,
      totalRecords,
      summary: {
        totalSegments: totalRecords,
        totalRevenue: segments.reduce((sum, item) => sum + (item.total_revenue || 0), 0),
        totalReservations: segments.reduce((sum, item) => sum + item.total_reservations, 0),
        topSegment: segments[0]?.segment || null
      }
    }
  }

  /**
   * Source of Business Report
   */
  static async getSourceOfBusinessReport(filters: ReportFilters): Promise<ReportData> {
    const startDate = filters.startDate ? DateTime.fromISO(filters.startDate) : DateTime.now().startOf('month')
    const endDate = filters.endDate ? DateTime.fromISO(filters.endDate) : DateTime.now().endOf('month')

    const query = Database.from('reservations')
      .join('booking_sources', 'reservations.booking_source_id', 'booking_sources.id')
      .select(
        'booking_sources.sourceName',
        'booking_sources.sourceType',
        Database.raw('COUNT(*) as total_bookings'),
        Database.raw('SUM(reservations.total_estimated_revenue) as total_revenue'),
        Database.raw('AVG(reservations.total_estimated_revenue) as average_booking_value'),
        Database.raw('COUNT(CASE WHEN reservations.reservation_status = \'Cancelled\' THEN 1 END) as cancelled_bookings'),
        Database.raw('COUNT(CASE WHEN reservations.reservation_status = \'No-Show\' THEN 1 END) as no_show_bookings')
      )
      .whereBetween('reservations.reservation_datetime', [startDate.toString(), endDate.toString()])
      .groupBy('booking_sources.sourceName', 'booking_sources.sourceType')
      .orderBy('total_revenue', 'desc')

    if (filters.hotelId) {
      query.where('reservations.hotel_id', filters.hotelId)
    }

    const sources = await query
    const totalRecords = sources.length

    const data = sources.map(source => ({
      sourceName: source.sourceName,
      sourceType: source.sourceType,
      totalBookings: source.total_bookings,
      totalRevenue: source.total_revenue,
      averageBookingValue: Math.round((source.average_booking_value || 0) * 100) / 100,
      cancelledBookings: source.cancelled_bookings,
      noShowBookings: source.no_show_bookings,
      conversionRate: source.total_bookings > 0 ? 
        Math.round(((source.total_bookings - source.cancelled_bookings - source.no_show_bookings) / source.total_bookings) * 10000) / 100 : 0
    }))

    return {
      title: 'Rapport des Sources d\'Affaires',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords,
      summary: {
        totalSources: totalRecords,
        totalBookings: data.reduce((sum, item) => sum + item.totalBookings, 0),
        totalRevenue: data.reduce((sum, item) => sum + item.totalRevenue, 0),
        bestPerformingSource: data[0]?.sourceName || null,
        averageConversionRate: totalRecords > 0 ? data.reduce((sum, item) => sum + item.conversionRate, 0) / totalRecords : 0
      }
    }
  }
}

export class CustomReportsService {
  /**
   * Generate custom report based on user-defined fields and filters
   */
  static async generateCustomReport(
    tableName: string,
    selectedFields: string[],
    filters: ReportFilters,
    joins?: { table: string; on: string }[],
    groupBy?: string[],
    orderBy?: { field: string; direction: 'asc' | 'desc' }[]
  ): Promise<ReportData> {
    let query = Database.from(tableName)

    // Add selected fields
    if (selectedFields.length > 0) {
      query = query.select(...selectedFields)
    } else {
      query = query.select('*')
    }

    // Add joins
    if (joins) {
      joins.forEach(join => {
        query = query.join(join.table, join.on, '=', `${tableName}.id`)
      })
    }

    // Add filters
    if (filters.hotelId) {
      query = query.where(`${tableName}.hotel_id`, filters.hotelId)
    }

    if (filters.startDate && filters.endDate) {
      query = query.whereBetween(`${tableName}.createdAt`, [filters.startDate, filters.endDate])
    }

    if (filters.status) {
      query = query.where(`${tableName}.status`, filters.status)
    }

    // Add group by
    if (groupBy && groupBy.length > 0) {
      query = query.groupBy(...groupBy)
    }

    // Add order by
    if (orderBy && orderBy.length > 0) {
      orderBy.forEach(order => {
        query = query.orderBy(order.field, order.direction)
      })
    } else {
      query = query.orderBy(`${tableName}.createdAt`, 'desc')
    }

    const data = await query
    const totalRecords = data.length

    return {
      title: 'Rapport Personnalisé',
      generatedAt: DateTime.now(),
      filters,
      data,
      totalRecords
    }
  }
}

export default class ReportsService {
  // Reservation Reports
  static getArrivalList = ReservationReportsService.getArrivalList
  static getDepartureList = ReservationReportsService.getDepartureList
  static getConfirmedReservations = ReservationReportsService.getConfirmedReservations
  static getCancelledReservations = ReservationReportsService.getCancelledReservations
  static getNoShowReservations = ReservationReportsService.getNoShowReservations
  static getReservationForecast = ReservationReportsService.getReservationForecast
  static getVoidReservations = ReservationReportsService.getVoidReservations

  // Front Office Reports
  static getGuestCheckedIn = FrontOfficeReportsService.getGuestCheckedIn
  static getGuestCheckedOut = FrontOfficeReportsService.getGuestCheckedOut
  static getRoomAvailability = FrontOfficeReportsService.getRoomAvailability
  static getRoomStatus = FrontOfficeReportsService.getRoomStatus
  static getTaskList = FrontOfficeReportsService.getTaskList

  // Back Office Reports
  static getRevenueReport = BackOfficeReportsService.getRevenueReport
  static getExpenseReport = BackOfficeReportsService.getExpenseReport
  static getCashierReport = BackOfficeReportsService.getCashierReport

  // Audit Reports
  static getUserActivityLog = AuditReportsService.getUserActivityLog

  // Statistical Reports
  static getOccupancyReport = StatisticalReportsService.getOccupancyReport
  static getADRReport = StatisticalReportsService.getADRReport
  static getRevPARReport = StatisticalReportsService.getRevPARReport
  static getMarketSegmentAnalysis = StatisticalReportsService.getMarketSegmentAnalysis
  static getSourceOfBusinessReport = StatisticalReportsService.getSourceOfBusinessReport

  // Custom Reports
  static generateCustomReport = CustomReportsService.generateCustomReport

  /**
   * Get all available report types
   */
  static getAvailableReports() {
    return {
      reservationReports: [
        { key: 'arrivalList', name: 'Liste des Arrivées', description: 'Liste des clients prévus pour arriver' },
        { key: 'departureList', name: 'Liste des Départs', description: 'Liste des clients prévus pour le départ' },
        { key: 'confirmedReservations', name: 'Réservations Confirmées', description: 'Détails des réservations confirmées' },
        { key: 'cancelledReservations', name: 'Réservations Annulées', description: 'Liste des réservations annulées' },
        { key: 'noShowReservations', name: 'Réservations Non-Présentées', description: 'Liste des no-shows' },
        { key: 'reservationForecast', name: 'Prévisions de Réservation', description: 'Projection des réservations futures' },
        { key: 'voidReservations', name: 'Réservations Invalides', description: 'Liste des réservations annulées sans frais' }
      ],
      frontOfficeReports: [
        { key: 'guestCheckedIn', name: 'Clients Enregistrés', description: 'Liste des clients actuellement enregistrés' },
        { key: 'guestCheckedOut', name: 'Clients Sortis', description: 'Liste des clients ayant effectué leur départ' },
        { key: 'roomAvailability', name: 'Disponibilité des Chambres', description: 'Aperçu des chambres disponibles' },
        { key: 'roomStatus', name: 'État des Chambres', description: 'État actuel des chambres' },
        { key: 'taskList', name: 'Liste des Tâches', description: 'Liste des tâches assignées' }
      ],
      backOfficeReports: [
        { key: 'revenueReport', name: 'Rapport de Revenus', description: 'Analyse des revenus par source' },
        { key: 'expenseReport', name: 'Rapport des Dépenses', description: 'Suivi des dépenses opérationnelles' },
        { key: 'cashierReport', name: 'Rapport de Caisse', description: 'Résumés des transactions par caissier' }
      ],
      auditReports: [
        { key: 'userActivityLog', name: 'Journal d\'Activité', description: 'Enregistrement des actions utilisateurs' }
      ],
      statisticalReports: [
        { key: 'occupancyReport', name: 'Rapport d\'Occupation', description: 'Taux d\'occupation par période' },
        { key: 'adrReport', name: 'Rapport ADR', description: 'Tarif journalier moyen' },
        { key: 'revparReport', name: 'Rapport RevPAR', description: 'Revenu par chambre disponible' },
        { key: 'marketSegmentAnalysis', name: 'Analyse des Segments', description: 'Performance par segment de clientèle' },
        { key: 'sourceOfBusinessReport', name: 'Sources d\'Affaires', description: 'Efficacité des canaux de réservation' }
      ]
    }
  }
}