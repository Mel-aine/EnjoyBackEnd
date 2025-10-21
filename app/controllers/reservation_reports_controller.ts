import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import Hotel from '#models/hotel'
import { createReservationReportValidator } from '#validators/reservation_report'

export default class ReservationReportsController {
  /**
   * Generate Arrival List Report
   * Input: startDate, endDate, hotelId, filters (roomType, rateType, company, etc.)
   * Output: List of upcoming arrivals with details
   */
  async generateArrivalList({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      const {
        startDate,
        endDate,
        hotelId,
        roomTypeId,
        ratePlanId,
        company,
        businessSource,
        market,
        userId,
        rateFrom,
        rateTo,
        reservationType,
        showAmount,
        taxInclusive,
        selectedColumns
      } = payload

      console.log('payload.receive', payload)

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for arrivals
      let query = Reservation.query()
      .preload('guest')
      .preload('roomType')
      .preload('reservationRooms', (reservationRoomQuery) => {
        reservationRoomQuery.preload('room', (roomQuery)=> {
          roomQuery.preload('roomType')
        })
        reservationRoomQuery.preload('roomType')
        reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
          roomRateQuery.preload('rateType')
        })
      })
      .preload('businessSource')
      .preload('paymentMethod')
      .preload('creator')
      .preload('marketCode')
      .where('hotelId', hotelId)
      .whereBetween('arrivedDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])

      // Apply optional filters
      if (roomTypeId) {
        query = query.where('roomTypeId', roomTypeId)
      }

      if (ratePlanId) {
        query = query.whereHas('reservationRooms', (roomQuery) => {
          roomQuery.whereHas('roomRates', (rateQuery) => {
            rateQuery.where('rateTypeId', ratePlanId)
          })
        })
      }

      if (company) {
        query = query.where('companyCode', company)
      }

      if (businessSource) {
        query = query.where('businessSourceId', businessSource)
      }

      if (market) {
        query = query.where('market_code_id', market)
      }

      if (userId) {
        query = query.where('createdBy', userId)
      }

      if (rateFrom && rateTo) {
        query = query.whereBetween('roomRate', [rateFrom, rateTo])
      }

      if (reservationType) {
        query = query.where('reservationType', reservationType)
      }

      // Filter by taxExempt if taxInclusive is true
      if (taxInclusive) {
        query = query.where('taxExempt', true)
      }

      const reservations = await query.orderBy('arrivedDate', 'asc')

      // Process reservation data
      const reservationList = reservations.map((reservation) => {
        
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const nbNights = reservation.numberOfNights
        const totalAmount = roomRate * nbNights!

        // Calculate amount to display based on showAmount
        let displayAmount = showAmount === 'total_amount' ? totalAmount : roomRate

        const baseData: any = {
          reservationNumber: reservation.reservationNumber,
          guestName: reservation.guest?.firstName || 'N/A',
          roomType: reservation.reservationRooms?.[0]?.room?.roomType.roomTypeName,
          roomNumber: reservation.reservationRooms?.[0]?.room?.roomNumber || 'Unassigned',
          arrivalDate: reservation.arrivedDate.toFormat('dd/MM/yyyy'),
          departureDate: reservation.departDate.toFormat('dd/MM/yyyy'),
          numberOfNights: reservation.numberOfNights,
          totalPax: `${reservation.adults}/${reservation.children}`,
          ratePerNight: roomRate,
          totalAmount,
          status: reservation.reservationStatus,
          ratePlan: reservation.reservationRooms?.[0]?.roomRates?.rateType?.rateTypeName || 'N/A',
          businessSource: reservation.businessSource?.name || 'Direct',
          company: reservation.companyName || '',
          marketCode: reservation.marketCode?.name || '',
          createdBy: reservation.creator?.fullName || '',
          depositPaid: reservation.depositPaid || 0,
          balanceDue: totalAmount - (reservation.depositPaid || 0)
        }

        // Add selected columns if provided
        if (selectedColumns && selectedColumns.length > 0) {
          selectedColumns.forEach(col => {
            switch(col) {
              case 'pickUp':
                baseData.pickUp = reservation.pickupTime || ''
                break
              case 'dropOff':
                baseData.dropOff = reservation.dropoffTime || ''
                break
              case 'resType':
                baseData.reservationType = reservation.reservationType || ''
                break
            }
          })
        }

        return baseData
      })

      // Calculate summary
      const summary = {
        totalArrivals: reservationList.length,
        totalNights: reservationList.reduce((sum, r) => sum + r.numberOfNights, 0),
        totalAdults: reservations.reduce((sum, r) => sum + (r.adults || 0), 0),
        totalChildren: reservations.reduce((sum, r) => sum + (r.children || 0), 0),
        totalRevenue: reservationList.reduce((sum, r) => sum + r.totalAmount, 0),
        averageRate: reservationList.length > 0 
          ? reservationList.reduce((sum, r) => sum + r.ratePerNight, 0) / reservationList.length 
          : 0
      }

      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address
        },
        dateRange: {
          fromDate: startDateTime.toFormat('dd/MM/yyyy'),
          toDate: endDateTime.toFormat('dd/MM/yyyy')
        },
        data: reservationList,
        summary,
        filters: payload
      }

      return response.ok({
        success: true,
        message: 'Arrival list report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      console.error('Error generating arrival list:', error)
      return response.badRequest({
        success: false,
        message: 'Failed to generate arrival list report',
        error: error.message
      })
    }
  }

  /**
   * Generate Departure List Report
   */
  async generateDepartureList({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      const {
        startDate,
        endDate,
        hotelId,
        roomTypeId,
        ratePlanId,
        company,
        businessSource,
        market,
        userId,
        rateFrom,
        rateTo,
        reservationType,
        showAmount,
        taxInclusive
      } = payload

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for departures
      let query = Reservation.query()
        .preload('guest')
        .preload('roomType')
        .preload('reservationRooms', (reservationRoomQuery) => {
          reservationRoomQuery.preload('room', (roomQuery)=> {
            roomQuery.preload('roomType')
          })
          reservationRoomQuery.preload('roomType')
          reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
            roomRateQuery.preload('rateType')
          })
        })
        .preload('businessSource')
        .preload('paymentMethod')
        .preload('creator')
        .preload('folios')
        .where('hotelId', hotelId)
        .whereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
        //.whereIn('reservationStatus', ['CheckedIn', 'Confirmed'])

      // Apply same filters as arrival list
      if (roomTypeId) query = query.where('roomTypeId', roomTypeId)
      if (ratePlanId) {
        query = query.whereHas('reservationRooms', (roomQuery) => {
          roomQuery.whereHas('roomRates', (rateQuery) => {
            rateQuery.where('rateTypeId', ratePlanId)
          })
        })
      }
      if (company) query = query.where('companyCode', company)
      if (businessSource) query = query.where('businessSourceId', businessSource)
      if (market) query = query.where('market_code_id', market)
      if (userId) query = query.where('createdBy', userId)
      if (rateFrom && rateTo) query = query.whereBetween('roomRate', [rateFrom, rateTo])
      if (reservationType) query = query.where('reservationType', reservationType)
      
      // Filter by taxExempt if taxInclusive is true
      if (taxInclusive) {
        query = query.where('taxExempt', true)
      }

      const reservations = await query.orderBy('departDate', 'asc')

      const reservationList = reservations.map((reservation) => {
      const nbNights = reservation.nights
        
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const totalAmount = roomRate * nbNights

        // Calculate balance from folios
        let totalCharges = 0
        let totalPayments = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            totalCharges += Number(folio.totalCharges || 0)
            totalPayments += Number(folio.totalPayments || 0)
          })
        }

        return {
          reservationNumber: reservation.reservationNumber,
          guestName: reservation.guest?.displayName || 'N/A',
          roomType: reservation.reservationRooms?.[0]?.room?.roomType.roomTypeName,
          roomNumber: reservation.reservationRooms?.[0]?.room?.roomNumber || 'N/A',
          arrivalDate: reservation.arrivedDate.toFormat('dd/MM/yyyy'),
          departureDate: reservation.departDate.toFormat('dd/MM/yyyy'),
          numberOfNights: reservation.nights,
          totalPax: `${reservation.adults || 0}/${reservation.children || 0}`,
          ratePerNight: roomRate,
          totalAmount,
          totalCharges,
          totalPayments,
          balance: totalCharges - totalPayments,
          status: reservation.reservationStatus,
          ratePlan: reservation.reservationRooms?.[0]?.roomRates?.rateType?.rateTypeName || 'N/A',
          businessSource: reservation.businessSource?.name || 'Direct',
          company: reservation.company?.companyName || '',
          createdBy: reservation.creator?.fullName || '',
          folioNumber: reservation.folios?.[0]?.folioNumber || 'N/A'
        }
      })

      const summary = {
        totalDepartures: reservationList.length,
        totalNights: reservationList.reduce((sum, r) => sum + r.numberOfNights, 0),
        totalRevenue: reservationList.reduce((sum, r) => sum + r.totalAmount, 0),
        totalCharges: reservationList.reduce((sum, r) => sum + r.totalCharges, 0),
        totalPayments: reservationList.reduce((sum, r) => sum + r.totalPayments, 0),
        totalBalance: reservationList.reduce((sum, r) => sum + r.balance, 0)
      }

      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address
        },
        dateRange: {
          fromDate: startDateTime.toFormat('dd/MM/yyyy'),
          toDate: endDateTime.toFormat('dd/MM/yyyy')
        },
        data: reservationList,
        summary,
        filters: payload
      }

      return response.ok({
        success: true,
        message: 'Departure list report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      console.error('Error generating departure list:', error)
      return response.badRequest({
        success: false,
        message: 'Failed to generate departure list report',
        error: error.message
      })
    }
  }

  /**
   * Generate Cancelled Reservations Report
   */
  async generateCancelledList({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      const {
        startDate,
        endDate,
        hotelId,
        roomTypeId,
        ratePlanId,
        company,
        businessSource,
        market,
        userId,
        rateFrom,
        rateTo,
        taxInclusive
      } = payload

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for cancelled reservations
      let query = Reservation.query()
        .preload('guest')
        .preload('roomType')
        .preload('reservationRooms', (reservationRoomQuery) => {
          reservationRoomQuery.preload('room')
          reservationRoomQuery.preload('roomType')
          reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
            roomRateQuery.preload('rateType')
          })
        })
        .preload('businessSource')
        //.preload('cancelledBy')
        //.preload('company')
        .preload('folios')
        .where('hotelId', hotelId)
        .where('reservationStatus', 'Cancelled')
        .whereBetween('cancelletionDate', [startDateTime.toSQL(), endDateTime.toSQL()])

      // Apply filters
      if (roomTypeId) query = query.where('roomTypeId', roomTypeId)
      if (ratePlanId) {
        query = query.whereHas('reservationRooms', (roomQuery) => {
          roomQuery.whereHas('roomRates', (rateQuery) => {
            rateQuery.where('rateTypeId', ratePlanId)
          })
        })
      }
      if (company) query = query.where('companyCode', company)
      if (businessSource) query = query.where('businessSourceId', businessSource)
      if (market) query = query.where('market_code_id', market)
      if (userId) query = query.where('cancelledBy', userId)
      if (rateFrom && rateTo) query = query.whereBetween('roomRate', [rateFrom, rateTo])
      
      // Filter by taxExempt if taxInclusive is true
      if (taxInclusive) {
        query = query.where('taxExempt', true)
      }

      const reservations = await query.orderBy('cancelledAt', 'desc')

      const reservationList = reservations.map((reservation) => {
        const nbNights = reservation.nights
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const adr = roomRate * nbNights

        // Calculate charges and payments
        let totalCharges = 0
        let totalPayments = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            totalCharges += Number(folio.totalCharges || 0)
            totalPayments += Number(folio.totalPayments || 0)
          })
        }

        return {
          resNo: reservation.reservationNumber,
          bookingDate: reservation.createdAt.toFormat('dd/MM/yyyy'),
          guest: reservation.guest?.displayName || 'N/A',
          rateType: reservation.reservationRooms?.[0]?.roomRates?.rateType?.rateTypeName || 'N/A',
          arrival: reservation.arrivedDate.toFormat('dd/MM'),
          departure: reservation.departDate.toFormat('dd/MM'),
          folioNo: reservation.folios?.[0]?.folioNumber || 'N/A',
          adr: adr.toFixed(2),
          carRevenue: '0.00',
          charges: totalCharges.toFixed(2),
          paid: totalPayments.toFixed(2),
          balance: (totalCharges - totalPayments).toFixed(2),
          source: reservation.businessSource?.name || '',
          //cancelledBy: reservation.cancelledBy?.fullName || 'N/A',
          cancelledDate: reservation.cancelledAt?.toFormat('dd/MM/yyyy') || 'N/A',
          remarks: reservation.cancellationReason || ''
        }
      })

      const summary = {
        totalCancelled: reservationList.length,
        totalADR: reservationList.reduce((sum, r) => sum + parseFloat(r.adr), 0),
        totalCharges: reservationList.reduce((sum, r) => sum + parseFloat(r.charges), 0),
        totalPaid: reservationList.reduce((sum, r) => sum + parseFloat(r.paid), 0),
        totalBalance: reservationList.reduce((sum, r) => sum + parseFloat(r.balance), 0)
      }

      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address
        },
        dateRange: {
          fromDate: startDateTime.toFormat('dd/MM/yyyy'),
          toDate: endDateTime.toFormat('dd/MM/yyyy')
        },
        data: reservationList,
        summary,
        filters: payload
      }

      return response.ok({
        success: true,
        message: 'Cancelled reservations report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      console.error('Error generating cancelled list:', error)
      return response.badRequest({
        success: false,
        message: 'Failed to generate cancelled reservations report',
        error: error.message
      })
    }
  }

  /**
   * Generate Void Reservations Report
   */
  async generateVoidList({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      const { startDate, endDate, hotelId } = payload

      const startDateTime = DateTime.fromISO(startDate)
      const endDateTime = DateTime.fromISO(endDate)

      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for void reservations
      const query = Reservation.query()
        .preload('guest')
        .preload('roomType')
        .preload('reservationRooms', (reservationRoomQuery) => {
          reservationRoomQuery.preload('room')
          reservationRoomQuery.preload('roomType')
          reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
            roomRateQuery.preload('rateType')
          })
        })
        .preload('businessSource')
        //.preload('voidedBy')
        .preload('folios')
        .where('hotelId', hotelId)
        .where('isVoided', true)
        .whereBetween('voidedAt', [startDateTime.toSQL(), endDateTime.toSQL()])

      const reservations = await query.orderBy('voidedAt', 'desc')

      const reservationList = reservations.map((reservation) => {
        const nights = Math.ceil(
          reservation.departDate.diff(reservation.arrivedDate, 'days').days
        )
        
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const adr = roomRate * nights

        let totalCharges = 0
        let totalPayments = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            totalCharges += Number(folio.totalCharges || 0)
            totalPayments += Number(folio.totalPayments || 0)
          })
        }

        return {
          resNo: reservation.reservationNumber,
          bookingDate: reservation.createdAt.toFormat('dd/MM/yyyy'),
          guest: reservation.guest?.displayName || 'N/A',
          rateType: reservation.reservationRooms?.[0]?.roomRates?.rateType?.rateTypeName || 'N/A',
          arrival: reservation.arrivedDate.toFormat('dd/MM'),
          departure: reservation.departDate.toFormat('dd/MM'),
          folioNo: reservation.folios?.[0]?.folioNumber || 'N/A',
          adr: adr.toFixed(2),
          carRevenue: '0.00',
          charges: totalCharges.toFixed(2),
          paid: totalPayments.toFixed(2),
          balance: (totalCharges - totalPayments).toFixed(2),
          source: reservation.businessSource?.name || '',
          cancelledBy: reservation.voidedBy?.fullName || 'N/A',
          cancelledDate: reservation.voidedAt?.toFormat('dd/MM/yyyy') || 'N/A',
          remarks: reservation.voidReason || ''
        }
      })

      const summary = {
        totalVoid: reservationList.length,
        totalADR: reservationList.reduce((sum, r) => sum + parseFloat(r.adr), 0),
        totalCharges: reservationList.reduce((sum, r) => sum + parseFloat(r.charges), 0),
        totalPaid: reservationList.reduce((sum, r) => sum + parseFloat(r.paid), 0),
        totalBalance: reservationList.reduce((sum, r) => sum + parseFloat(r.balance), 0)
      }

      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address
        },
        dateRange: {
          fromDate: startDateTime.toFormat('dd/MM/yyyy'),
          toDate: endDateTime.toFormat('dd/MM/yyyy')
        },
        data: reservationList,
        summary,
        filters: payload
      }

      return response.ok({
        success: true,
        message: 'Void reservations report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      console.error('Error generating void list:', error)
      return response.badRequest({
        success: false,
        message: 'Failed to generate void reservations report',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF for Arrival List
   */
  async generateArrivalListPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      
      const dataResponse = await this.generateArrivalList({ request, response, auth } as HttpContext)
      const reportData = dataResponse.body?.data

      if (!reportData) {
        return response.badRequest({
          success: false,
          message: 'Failed to generate report data'
        })
      }

      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      const htmlContent = await this.generateArrivalHtml(
        reportData.hotelDetails.hotelName,
        DateTime.fromISO(payload.startDate),
        DateTime.fromISO(payload.endDate),
        reportData,
        printedBy
      )

      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `

      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        landscape: true,
        margin: {
          top: '60px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        footerTemplate,
        printBackground: true
      })

      const fileName = `arrival-list-${reportData.hotelDetails.hotelName.replace(/\s+/g, '-')}-${DateTime.fromISO(payload.startDate).toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)

    } catch (error) {
      console.error('Error generating arrival list PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate arrival list PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF for Departure List
   */
  async generateDepartureListPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      
      const dataResponse = await this.generateDepartureList({ request, response, auth } as HttpContext)
      const reportData = dataResponse.body?.data

      if (!reportData) {
        return response.badRequest({
          success: false,
          message: 'Failed to generate report data'
        })
      }

      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      const htmlContent = await this.generateDepartureHtml(
        reportData.hotelDetails.hotelName,
        DateTime.fromISO(payload.startDate),
        DateTime.fromISO(payload.endDate),
        reportData,
        printedBy
      )

      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `

      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        landscape: true,
        margin: {
          top: '60px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        footerTemplate,
        printBackground: true
      })

      const fileName = `departure-list-${reportData.hotelDetails.hotelName.replace(/\s+/g, '-')}-${DateTime.fromISO(payload.startDate).toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)

    } catch (error) {
      console.error('Error generating departure list PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate departure list PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF for Cancelled Reservations
   */
  async generateCancelledListPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      
      const dataResponse = await this.generateCancelledList({ request, response, auth } as HttpContext)
      const reportData = dataResponse.body?.data

      if (!reportData) {
        return response.badRequest({
          success: false,
          message: 'Failed to generate report data'
        })
      }

      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      const htmlContent = await this.generateCancelledHtml(
        reportData.hotelDetails.hotelName,
        DateTime.fromISO(payload.startDate),
        DateTime.fromISO(payload.endDate),
        reportData,
        printedBy
      )

      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `

      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        landscape: true,
        margin: {
          top: '60px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        footerTemplate,
        printBackground: true
      })

      const fileName = `cancelled-reservations-${reportData.hotelDetails.hotelName.replace(/\s+/g, '-')}-${DateTime.fromISO(payload.startDate).toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)

    } catch (error) {
      console.error('Error generating cancelled list PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate cancelled list PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF for Void Reservations
   */
  async generateVoidListPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationReportValidator)
      
      const dataResponse = await this.generateVoidList({ request, response, auth } as HttpContext)
      const reportData = dataResponse.body?.data

      if (!reportData) {
        return response.badRequest({
          success: false,
          message: 'Failed to generate report data'
        })
      }

      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      const htmlContent = await this.generateVoidHtml(
        reportData.hotelDetails.hotelName,
        DateTime.fromISO(payload.startDate),
        DateTime.fromISO(payload.endDate),
        reportData,
        printedBy
      )

      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `

      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        landscape: true,
        margin: {
          top: '60px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        footerTemplate,
        printBackground: true
      })

      const fileName = `void-reservations-${reportData.hotelDetails.hotelName.replace(/\s+/g, '-')}-${DateTime.fromISO(payload.startDate).toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)

    } catch (error) {
      console.error('Error generating void list PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate void list PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate HTML content for Arrival List using Edge template
   */
  private async generateArrivalHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      printedOn,
      printedBy,
      data: reportData,
      formatCurrency
    }

    return await edge.render('reports/arrival_list', templateData)
  }

  /**
   * Generate HTML content for Departure List using Edge template
   */
  private async generateDepartureHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      printedOn,
      printedBy,
      data: reportData,
      formatCurrency
    }

    return await edge.render('reports/departure_list', templateData)
  }

  /**
   * Generate HTML content for Cancelled Reservations using Edge template
   */
  private async generateCancelledHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      printedOn,
      printedBy,
      data: reportData,
      formatCurrency
    }

    return await edge.render('reports/cancelled_reservations', templateData)
  }

  /**
   * Generate HTML content for Void Reservations using Edge template
   */
  private async generateVoidHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')

    edge.mount(path.join(process.cwd(), 'resources/views'))

    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      printedOn,
      printedBy,
      data: reportData,
      formatCurrency
    }

    return await edge.render('reports/void_reservations', templateData)
  }
}