import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Receipt from '#models/receipt'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation' // Modifié: Reservation au lieu de Booking
import { createDailyReceiptReportValidator } from '#validators/daily_receipt_report'
import { createDailyRevenueReportValidator } from '#validators/daily_revenue_report'

export default class DailyReceiptReportsController {
  /**
   * Generate Daily Receipt Summary Report
   * Input: fromDate, toDate, hotelId, receiptByUserId (optional), currencyId (optional), paymentMethodId (optional)
   * Output: Summary by user and payment method with totals
   */
  async generateSummary({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyReceiptReportValidator)
      const { fromDate, toDate, hotelId, receiptByUserId, currencyId, paymentMethodId } = payload

      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for receipts
      let query = Receipt.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .where('hotelId', hotelId)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())

      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }

      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }

      const receipts = await query.orderBy('paymentDate', 'asc')

      // Group receipts by user
      const userSummaries = new Map()
      const paymentMethodSummaries = new Map()
      let grandTotalTransactions = 0
      let grandTotalAmount = 0
      let grandTotalVoid = 0
      let grandVoidAmount = 0

      receipts.forEach(receipt => {
        const userId = receipt.creator?.id
        const userName = `${receipt.creator?.fullName}`
        const paymentMethodId = receipt.paymentMethodId
        const paymentMethodName = receipt.paymentMethod?.methodName
        const amount = Number(receipt.totalAmount)
        const isVoided = receipt.isVoided

        // User summary
        if (!userSummaries.has(userId)) {
          userSummaries.set(userId, {
            userName,
            paymentMethods: new Map(),
            totalTransactions: 0,
            totalAmount: 0,
            totalVoid: 0,
            voidAmount: 0
          })
        }

        const userSummary = userSummaries.get(userId)

        // Payment method within user
        if (!userSummary.paymentMethods.has(paymentMethodId)) {
          userSummary.paymentMethods.set(paymentMethodId, {
            methodName: paymentMethodName,
            totalTransactions: 0,
            amount: 0,
            totalVoid: 0,
            voidAmount: 0,
            total: 0
          })
        }

        const methodSummary = userSummary.paymentMethods.get(paymentMethodId)

        if (isVoided) {
          methodSummary.totalVoid += 1
          methodSummary.voidAmount += Number(amount)
          userSummary.totalVoid += 1
          userSummary.voidAmount += Number(amount)
          grandTotalVoid += 1
          grandVoidAmount += Number(amount)
        }
        methodSummary.totalTransactions += 1
        methodSummary.amount += Number(amount)
        userSummary.totalTransactions += 1
        userSummary.totalAmount += Number(amount)
        grandTotalTransactions += 1
        grandTotalAmount += Number(amount)

        methodSummary.total = methodSummary.amount - methodSummary.voidAmount

        // Payment method global summary
        if (!paymentMethodSummaries.has(paymentMethodId)) {
          paymentMethodSummaries.set(paymentMethodId, {
            methodName: paymentMethodName,
            totalTransactions: 0,
            amount: 0,
            totalVoid: 0,
            voidAmount: 0,
            total: 0
          })
        }

        const globalMethodSummary = paymentMethodSummaries.get(paymentMethodId)

        if (isVoided) {
          globalMethodSummary.totalVoid += 1
          globalMethodSummary.voidAmount += Number(amount)
        } 
        globalMethodSummary.totalTransactions += 1
        globalMethodSummary.amount += Number(amount)

        globalMethodSummary.total = globalMethodSummary.amount - globalMethodSummary.voidAmount
      })

      // Convert Maps to Arrays for response
      const userSummaryList = Array.from(userSummaries.values()).map(user => ({
        ...user,
        paymentMethods: Array.from(user.paymentMethods.values()),
        userTotal: user.totalAmount - user.voidAmount
      }))

      const paymentMethodSummaryList = Array.from(paymentMethodSummaries.values())

      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd')
        },
        userSummaries: userSummaryList,
        grandTotals: {
          totalTransactions: grandTotalTransactions,
          totalAmount: grandTotalAmount,
          totalVoid: grandTotalVoid,
          voidAmount: grandVoidAmount,
          netTotal: grandTotalAmount - grandVoidAmount
        },
        summary: {
          userSummary: userSummaryList.map(user => ({
            userName: user.userName,
            totalTransactions: user.totalTransactions,
            totalAmount: user.totalAmount,
            totalVoid: user.totalVoid,
            voidAmount: user.voidAmount,
            netTotal: user.userTotal
          })),
          paymentMethodSummary: paymentMethodSummaryList,
          grandTotalUserSummary: {
            totalUsers: userSummaryList.length,
            totalTransactions: grandTotalTransactions,
            totalAmount: grandTotalAmount,
            totalVoid: grandTotalVoid,
            voidAmount: grandVoidAmount,
            netTotal: grandTotalAmount - grandVoidAmount
          },
          grandTotalPaymentMethodSummary: {
            totalMethods: paymentMethodSummaryList.length,
            totalTransactions: grandTotalTransactions,
            totalAmount: grandTotalAmount,
            totalVoid: grandTotalVoid,
            voidAmount: grandVoidAmount,
            netTotal: grandTotalAmount - grandVoidAmount
          }
        }
      }

      return response.ok({
        success: true,
        message: 'Daily receipt summary report generated successfully',
        data: responseData,
        filters: payload,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate daily receipt summary report',
        error: error.message
      })
    }
  }

  async generateDetail({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyReceiptReportValidator)
      const { fromDate, toDate, hotelId, receiptByUserId, currencyId, paymentMethodId } = payload

      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Build query for receipts
      let query = Receipt.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .preload('tenant') // Guest
        .where('hotelId', hotelId)
        .where('isVoided', false)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())

      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }

      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }

      const receipts = await query.orderBy('paymentDate', 'asc')

      // Process receipt details
      const receiptList = receipts.map(receipt => ({
        date: receipt.paymentDate.toFormat('yyyy-MM-dd HH:mm:ss'),
        receiptNumber: receipt.receiptNumber,
        summary: receipt.description,
        amount: receipt.totalAmount,
        user: receipt.creator.fullName,
        enteredOn: receipt.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        paymentMethod: receipt.paymentMethod?.methodName,
        isVoided: receipt.isVoided,
        currency: receipt.currency,
        guest: receipt.tenant.displayName
      }))

      // Calculate totals by payment method
      const paymentMethodTotals = new Map()
      let grandTotalAmount = 0

      receipts.forEach(receipt => {
        const methodId = receipt.paymentMethodId
        const methodName = receipt.paymentMethod?.methodName 
        const amount = receipt.isVoided ? 0 : receipt.totalAmount

        if (!paymentMethodTotals.has(methodId)) {
          paymentMethodTotals.set(methodId, {
            methodName,
            total: 0,
            count: 0,
            receipts: []
          })
        }

        const methodTotal = paymentMethodTotals.get(methodId)
        methodTotal.total += Number(amount)
        methodTotal.count += receipt.isVoided ? 0 : 1
        
        // Add receipt details to the payment method's receipts array
        methodTotal.receipts.push({
          date: receipt.paymentDate.toFormat('yyyy-MM-dd HH:mm:ss'),
          receiptNumber: receipt.receiptNumber,
          summary: receipt.description,
          amount: receipt.totalAmount,
          user: receipt.creator.fullName,
          enteredOn: receipt.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
          isVoided: receipt.isVoided,
          currency: receipt.currency,
          guest: receipt.tenant.displayName
        })
        
        grandTotalAmount += Number(amount)
      })

      const responseData = {
        hotelInformation: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          email: hotel.email
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd')
        },
        receiptList,
        paymentMethodTotals: Array.from(paymentMethodTotals.values()),
        grandTotalAmount
      }

      return response.ok({
        success: true,
        message: 'Daily receipt detail report generated successfully',
        data: responseData,
        filters: payload,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate daily receipt detail report',
        error: error.message
      })
    }
  }

  /**
   * Generate Daily Revenue Report using Reservation model
   */
  async generatedailyRevenueReport({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyRevenueReportValidator)
      const { 
        fromDate, 
        toDate, 
        hotelId, 
        dateType,
        roomId, 
        businessSourceId, 
        paymentMethodIds,
        taxIds,
        showUnassignRooms,
        showUnpostedInclusion,
        discardUnconfirmedBookings,
        //showMobileNoField,
        //showEmailField
      } = payload
  
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)
  
      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)
  
      // Build query for reservations
      let query = Reservation.query()
        .preload('guest')
        .preload('roomType', (roomTypeQuery) => {
          roomTypeQuery.preload('rooms', (roomQuery) => {
            roomQuery.preload('taxRates', (taxRateQuery) => {
              if (taxIds && taxIds.length > 0) {
                taxRateQuery.whereIn('taxRateId', taxIds)
              }
            })
          })
        })
        .preload('ratePlan')
        .preload('businessSource')
        .preload('paymentMethod')
        .preload('folios')
        .where('hotelId', hotelId)
  
      // Apply date type filter
      switch (dateType) {
        case 'booking':
          query = query.whereBetween('createdAt', [startDateTime.toSQL(), endDateTime.toSQL()])
          break
          
        case 'stay':
          query = query.where((builder) => {
            builder
              .whereBetween('arrivedDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhere((subBuilder) => {
                subBuilder
                  .where('arrivedDate', '<=', startDateTime.toSQLDate())
                  .where('departDate', '>=', endDateTime.toSQLDate())
              })
          })
          break
          
        case 'departure':
          query = query.whereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
          break
          
        default:
          query = query.where((builder) => {
            builder
              .whereBetween('arrivedDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhere((subBuilder) => {
                subBuilder
                  .where('arrivedDate', '<=', startDateTime.toSQLDate())
                  .where('departDate', '>=', endDateTime.toSQLDate())
              })
          })
      }
  
      // Apply optional filters
      if (roomId) {
        query = query.where('roomTypeId', roomId)
      }
  
      if (businessSourceId) {
        query = query.where('businessSourceId', businessSourceId)
      }
  
      // Filter by payment methods
      if (paymentMethodIds && paymentMethodIds.length > 0) {
        query = query.whereIn('paymentMethodId', paymentMethodIds)
      }
  
      if (discardUnconfirmedBookings) {
        query = query.where('reservationStatus', 'Confirmed')
      }
  
      if (showUnassignRooms) {
        query = query.whereNull('roomTypeId')
      }
  
      const reservations = await query.orderBy('arrivedDate', 'asc')
  
      // Process reservation data
      let grandTotalRoomRate = 0
      let grandTotalTaxes = 0
      let grandTotalRevenue = 0
      let grandTotalCommission = 0
      let totalNights = 0
  
      const reservationList = reservations.map((reservation) => {
        // Calculate nights
        const nights = Math.ceil(
          reservation.departDate.diff(reservation.arrivedDate, 'days').days
        )
        
        // Calculate room rate
        const roomRate = reservation.roomRate || 0
        const totalRoomRate = roomRate * nights
  
        // Calculate taxes (already filtered by preload)
        let totalTaxes = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.taxes) {
              folio.taxes.forEach((tax) => {
                totalTaxes += Number(tax.amount)
              })
            }
          })
        }
  
        // Calculate commission
        const commissionRate = reservation.businessSource?.commissionValue || 0
        const commission = (totalRoomRate * commissionRate) / 100
  
        const totalRevenue = totalRoomRate + totalTaxes
  
        // Update grand totals
        grandTotalRoomRate += totalRoomRate
        grandTotalTaxes += totalTaxes
        grandTotalRevenue += totalRevenue
        grandTotalCommission += commission
        totalNights += nights
  
        // Base reservation data
        const reservationData: any = {
          serialNo: 0,
          guestName: reservation.guest?.displayName || 'N/A',
          arrivalDate: reservation.arrivedDate.toFormat('dd/MM/yyyy'),
          departureDate: reservation.departDate.toFormat('dd/MM/yyyy'),
          nights,
          room: reservation.roomType?.rooms?.[0]?.roomNumber 
          ? `${reservation.roomType.rooms[0].roomNumber} - ${reservation.roomType.roomTypeName}` 
          : 'Unassigned',
          voucherNo: reservation.confirmationCode || '-',
          rateType: reservation.ratePlan?.planName || 'Standard',
          folioNo: reservation.folios?.[0]?.folioNumber || '-',
          roomRate: totalRoomRate,
          totalTaxes,
          totalRevenue,
          commission,
          reservationType: reservation.reservationType?.name || 'Reservation',
          showOnlyUnassignRooms: !reservation.roomTypeId,
          businessSource: reservation.businessSource?.name || 'Direct',
          paymentMethod: reservation.paymentMethod?.methodName || '-'
        }
  
   /*      // Add mobile number field if requested
        if (showMobileNoField) {
          reservationData.mobileNo = reservation.guest?.mobileNo || '-'
        }
  
        // Add email field if requested
        if (showEmailField) {
          reservationData.email = reservation.guest?.email || '-'
        } */
  
        return reservationData
      })
  
      // Set serial numbers
      reservationList.forEach((item, index) => {
        item.serialNo = index + 1
      })
  
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
        reportData: {
          reservations: reservationList
        },
        grandTotals: {
          totalNights,
          totalRoomRate: grandTotalRoomRate,
          totalTaxes: grandTotalTaxes,
          totalRevenue: grandTotalRevenue,
          totalCommission: grandTotalCommission,
          totalReservations: reservationList.length
        },
        filters: {
          dateType,
          roomId,
          businessSourceId,
          paymentMethodIds,
          taxIds,
          showUnassignRooms,
          showUnpostedInclusion,
          discardUnconfirmedBookings,
          //showMobileNoField,
          //showEmailField
        }
      }
  
      return response.ok({
        success: true,
        message: 'Daily revenue report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })
  
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate daily revenue report',
        error: error.message
      })
    }
  }
  

  /**
   * Generate PDF for Daily Revenue Report using Reservation model
   */
  async generatedailyRevenueReportPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyRevenueReportValidator)
      const { 
        fromDate, 
        toDate, 
        hotelId, 
        dateType,
        roomId, 
        businessSourceId,
        paymentMethodIds,
        taxIds,
        showUnassignRooms,
        showUnpostedInclusion,
        discardUnconfirmedBookings,
      } = payload
  
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)
  
      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)
  
      // Get authenticated user information
      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'
  
      // Build query for reservations
      let query = Reservation.query()
        .preload('guest')
        .preload('roomType', (roomTypeQuery) => {
          roomTypeQuery.preload('rooms', (roomQuery) => {
            roomQuery.preload('taxRates', (taxRateQuery) => {
              if (taxIds && taxIds.length > 0) {
                taxRateQuery.whereIn('taxRateId', taxIds)
              }
            })
          })
        })
        .preload('ratePlan')
        .preload('businessSource')
        .preload('paymentMethod')
        .preload('folios')
        .where('hotelId', hotelId)
  
      // Apply date type filter
      switch (dateType) {
        case 'booking':
          query = query.whereBetween('createdAt', [startDateTime.toSQL(), endDateTime.toSQL()])
          break
          
        case 'stay':
          query = query.where((builder) => {
            builder
              .whereBetween('arrivedDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhere((subBuilder) => {
                subBuilder
                  .where('arrivedDate', '<=', startDateTime.toSQLDate())
                  .where('departDate', '>=', endDateTime.toSQLDate())
              })
          })
          break
          
        case 'departure':
          query = query.whereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
          break
          
        default:
          query = query.where((builder) => {
            builder
              .whereBetween('arrivedDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhereBetween('departDate', [startDateTime.toSQLDate(), endDateTime.toSQLDate()])
              .orWhere((subBuilder) => {
                subBuilder
                  .where('arrivedDate', '<=', startDateTime.toSQLDate())
                  .where('departDate', '>=', endDateTime.toSQLDate())
              })
          })
      }
  
      // Apply optional filters
      if (roomId) {
        query = query.where('roomTypeId', roomId)
      }
  
      if (businessSourceId) {
        query = query.where('businessSourceId', businessSourceId)
      }
  
      // Filter by payment methods
      if (paymentMethodIds && paymentMethodIds.length > 0) {
        query = query.whereIn('paymentMethodId', paymentMethodIds)
      }
  
      if (discardUnconfirmedBookings) {
        query = query.where('reservationStatus', 'Confirmed')
      }
  
      if (showUnassignRooms) {` `
        query = query.whereNull('roomTypeId')
      }
      
      const reservations = await query.orderBy('arrivedDate', 'asc')
  
      // Process data
      let grandTotalRoomRate = 0
      let grandTotalTaxes = 0
      let grandTotalRevenue = 0
      let grandTotalCommission = 0
      let totalNights = 0
  
      const reservationList = reservations.map((reservation, index) => {
        const nights = Math.ceil(
          reservation.departDate.diff(reservation.arrivedDate, 'days').days
        )
        
        const roomRate = reservation.roomRate || 0
        const totalRoomRate = roomRate * nights
  
        // Calculate taxes (already filtered by preload)
        let totalTaxes = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.taxes) {
              folio.taxes.forEach((tax) => {
                totalTaxes += Number(tax.amount)
              })
            }
          })
        }
  
        const commissionRate = reservation.businessSource?.commissionRate || 0
        const commission = (totalRoomRate * commissionRate) / 100
        const totalRevenue = totalRoomRate + totalTaxes
  
        grandTotalRoomRate += totalRoomRate
        grandTotalTaxes += totalTaxes
        grandTotalRevenue += totalRevenue
        grandTotalCommission += commission
        totalNights += nights
  
        return {
          serialNo: index + 1,
          guestName: reservation.guest?.displayName || 'N/A',
          arrivalDate: reservation.arrivedDate.toFormat('dd/MM/yyyy'),
          departureDate: reservation.departDate.toFormat('dd/MM/yyyy'),
          nights,
          room: reservation.roomType?.rooms?.[0]?.roomNumber 
          ? `${reservation.roomType.rooms[0].roomNumber} - ${reservation.roomType.roomTypeName}` 
          : 'Unassigned',
          voucherNo: reservation.confirmationCode || '-',
          rateType: reservation.ratePlan?.planName || 'EP',
          folioNo: reservation.folios?.[0]?.folioNumber || '-',
          roomRate: totalRoomRate,
          totalTaxes,
          totalRevenue,
          commission,
          businessSource: reservation.businessSource?.name || 'Direct',
          paymentMethod: reservation.paymentMethod?.methodName || '-'
        }
      })
  
      const reportData = {
        hotelDetails: {
          hotelName: hotel.hotelName
        },
        dateRange: {
          fromDate: startDateTime.toFormat('dd/MM/yyyy'),
          toDate: endDateTime.toFormat('dd/MM/yyyy')
        },
        reservationList,
        grandTotals: {
          totalRoomRate: grandTotalRoomRate,
          totalTaxes: grandTotalTaxes,
          totalRevenue: grandTotalRevenue,
          totalCommission: grandTotalCommission,
          totalNights
        },
        filters: {
          dateType,
          showUnassignRooms,
          discardUnconfirmedBookings,
          paymentMethodIds,
          taxIds
        }
      }
  
      // Generate HTML content
      const htmlContent = await this.generateRevenueHtml(
        hotel.hotelName,
        startDateTime,
        endDateTime,
        reportData,
        printedBy
      )
  
      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
  
      const formattedFromDate = startDateTime.toFormat('dd/MM/yyyy')
      const formattedToDate = endDateTime.toFormat('dd/MM/yyyy')
      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')
  
      // Header template
/*       const headerTemplate = `
      <div style="font-size:10px; width:100%; padding:3px 20px; margin:0;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:3px;">
          <div style="font-weight:bold; color:#00008B; font-size:13px;">${hotel.hotelName}</div>
          <div style="font-size:13px; color:#8B0000; font-weight:bold;">Detail Revenue Report</div>
        </div>
        
        <div style="font-size:8px; margin-bottom:3px;">
          <span style="margin-right:10px;"><strong>Run From:</strong> ${formattedFromDate}</span>
          <span style="margin-right:10px;"><strong>To:</strong> ${formattedToDate}</span>
          <span><strong>Date Type:</strong> ${dateType.charAt(0).toUpperCase() + dateType.slice(1)}</span>
        </div>
        
        <div style="border-top:1px solid #333; margin:0;"></div>
      </div>
      `
      */
      // Footer template
      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      ` 
  
      // Generate PDF
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        landscape: true,
        margin: {
          top: '70px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        //headerTemplate,
        footerTemplate,
        printBackground: true
      })
  
      // Set response headers
      const fileName = `daily-revenue-report-${dateType}-${hotel.hotelName.replace(/\s+/g, '-')}-${startDateTime.toFormat('yyyy-MM-dd')}-to-${endDateTime.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)
  
      return response.send(pdfBuffer)
  
    } catch (error) {
      console.error('Error generating daily revenue PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate daily revenue PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate HTML content for Management Report using Edge template
   */
  async generateSummaryPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyReceiptReportValidator)
      const { fromDate, toDate, hotelId, receiptByUserId, currencyId, paymentMethodId } = payload
  
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)
  
      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)
  
      // Get authenticated user information
      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'
  
      // Build query for receipts
      let query = Receipt.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .where('hotelId', hotelId)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())
  
      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }
  
      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }
  
      const receipts = await query.orderBy('paymentDate', 'asc')
  
      // Group receipts by user
      const userSummaries = new Map()
      const paymentMethodSummaries = new Map()
      let grandTotalTransactions = 0
      let grandTotalAmount = 0
      let grandTotalVoid = 0
      let grandVoidAmount = 0
  
      receipts.forEach(receipt => {
        const userId = receipt.creator?.id
        const userName = `${receipt.creator?.fullName}`
        const paymentMethodId = receipt.paymentMethodId
        const paymentMethodName = receipt.paymentMethod?.methodName
        const amount = Number(receipt.totalAmount)
        const isVoided = receipt.isVoided
  
        // User summary
        if (!userSummaries.has(userId)) {
          userSummaries.set(userId, {
            userName,
            paymentMethods: new Map(),
            totalTransactions: 0,
            totalAmount: 0,
            totalVoid: 0,
            voidAmount: 0
          })
        }
  
        const userSummary = userSummaries.get(userId)
  
        // Payment method within user
        if (!userSummary.paymentMethods.has(paymentMethodId)) {
          userSummary.paymentMethods.set(paymentMethodId, {
            methodName: paymentMethodName,
            totalTransactions: 0,
            amount: 0,
            totalVoid: 0,
            voidAmount: 0,
            total: 0
          })
        }
  
        const methodSummary = userSummary.paymentMethods.get(paymentMethodId)
  
        if (isVoided) {
          methodSummary.totalVoid += 1
          methodSummary.voidAmount += Number(amount)
          userSummary.totalVoid += 1
          userSummary.voidAmount += Number(amount)
          grandTotalVoid += 1
          grandVoidAmount += Number(amount)
        }
        methodSummary.totalTransactions += 1
        methodSummary.amount += Number(amount)
        userSummary.totalTransactions += 1
        userSummary.totalAmount += Number(amount)
        grandTotalTransactions += 1
        grandTotalAmount += Number(amount)
  
        methodSummary.total = methodSummary.amount - methodSummary.voidAmount
  
        // Payment method global summary
        if (!paymentMethodSummaries.has(paymentMethodId)) {
          paymentMethodSummaries.set(paymentMethodId, {
            methodName: paymentMethodName,
            totalTransactions: 0,
            amount: 0,
            totalVoid: 0,
            voidAmount: 0,
            total: 0
          })
        }
  
        const globalMethodSummary = paymentMethodSummaries.get(paymentMethodId)
  
        if (isVoided) {
          globalMethodSummary.totalVoid += 1
          globalMethodSummary.voidAmount += Number(amount)
        } 
        globalMethodSummary.totalTransactions += 1
        globalMethodSummary.amount += Number(amount)
  
        globalMethodSummary.total = globalMethodSummary.amount - globalMethodSummary.voidAmount
      })
  
      // Convert Maps to Arrays for response
      const userSummaryList = Array.from(userSummaries.values()).map(user => ({
        ...user,
        paymentMethods: Array.from(user.paymentMethods.values()),
        userTotal: user.totalAmount - user.voidAmount
      }))
  
      const paymentMethodSummaryList = Array.from(paymentMethodSummaries.values())
  
      const reportData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd')
        },
        userSummaries: userSummaryList,
        grandTotals: {
          totalTransactions: grandTotalTransactions,
          totalAmount: grandTotalAmount,
          totalVoid: grandTotalVoid,
          voidAmount: grandVoidAmount,
          netTotal: grandTotalAmount - grandVoidAmount
        },
        summary: {
          userSummary: userSummaryList.map(user => ({
            userName: user.userName,
            totalTransactions: user.totalTransactions,
            totalAmount: user.totalAmount,
            totalVoid: user.totalVoid,
            voidAmount: user.voidAmount,
            netTotal: user.userTotal
          })),
          paymentMethodSummary: paymentMethodSummaryList,
          grandTotalUserSummary: {
            totalUsers: userSummaryList.length,
            totalTransactions: grandTotalTransactions,
            totalAmount: grandTotalAmount,
            totalVoid: grandTotalVoid,
            voidAmount: grandVoidAmount,
            netTotal: grandTotalAmount - grandVoidAmount
          },
          grandTotalPaymentMethodSummary: {
            totalMethods: paymentMethodSummaryList.length,
            totalTransactions: grandTotalTransactions,
            totalAmount: grandTotalAmount,
            totalVoid: grandTotalVoid,
            voidAmount: grandVoidAmount,
            netTotal: grandTotalAmount - grandVoidAmount
          }
        }
      }
  
      // Generate HTML content using Edge template
      const htmlContent = await this.generateSummaryHtml(
        hotel.hotelName,
        startDateTime,
        endDateTime,
        currencyId || 'XAF',
        reportData,
        printedBy
      )
  
      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')
  
      // Format dates for display
      const formattedFromDate = startDateTime.toFormat('dd/MM/yyyy')
      const formattedToDate = endDateTime.toFormat('dd/MM/yyyy')
      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')
  
      // Create header template
      const headerTemplate = `
      <div style="font-size:10px; width:100%; padding:3px 20px; margin:0;">
        <!-- Hotel name and report title -->
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:3px;">
          <div style="font-weight:bold; color:#00008B; font-size:13px;">${hotel.hotelName}</div>
          <div style="font-size:13px; color:#8B0000; font-weight:bold;">Daily Receipt - Summary</div>
        </div>
        
        <!-- Report Info -->
        <div style="font-size:8px; margin-bottom:3px;">
          <span style="margin-right:10px;"><strong>From Date:</strong> ${formattedFromDate}</span>
          <span style="margin-right:10px;"><strong>To Date:</strong> ${formattedToDate}</span>
          <span><strong>Currency:</strong> ${currencyId || 'XAF'}</span>
        </div>
        
        <div style="border-top:1px solid #333; margin:0;"></div>
      </div>
      `
  
      // Create footer template
      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `
  
      // Generate PDF with header and footer
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        margin: {
          top: '70px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        printBackground: true
      })
  
      // Set response headers
      const fileName = `daily-receipt-summary-${hotel.hotelName.replace(/\s+/g, '-')}-${startDateTime.toFormat('yyyy-MM-dd')}-to-${endDateTime.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)
  
      return response.send(pdfBuffer)
  
    } catch (error) {
      console.error('Error generating daily receipt summary PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate daily receipt summary PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate PDF for Detailed Receipt Report
   */
  async generateDetailPdf({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyReceiptReportValidator)
      const { fromDate, toDate, hotelId, receiptByUserId, currencyId, paymentMethodId } = payload

      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Get authenticated user information
      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      // Build query for receipts (same as generateDetail method)
      let query = Receipt.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .preload('tenant')
        .where('hotelId', hotelId)
        .where('isVoided', false)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())

      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }

      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }

      const receipts = await query.orderBy('paymentDate', 'asc')

      // Process receipt details (same as generateDetail method)
      const receiptList = receipts.map(receipt => ({
        date: receipt.paymentDate.toFormat('yyyy-MM-dd HH:mm:ss'),
        receiptNumber: receipt.receiptNumber,
        summary: receipt.description,
        amount: receipt.totalAmount,
        user: receipt.creator.fullName,
        enteredOn: receipt.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
        paymentMethod: receipt.paymentMethod?.methodName,
        isVoided: receipt.isVoided,
        currency: receipt.currency,
        guest: receipt.tenant.displayName
      }))

      // Calculate totals by payment method
      const paymentMethodTotals = new Map()
      let grandTotalAmount = 0

      receipts.forEach(receipt => {
        const methodId = receipt.paymentMethodId
        const methodName = receipt.paymentMethod?.methodName 
        const amount = receipt.isVoided ? 0 : receipt.totalAmount

        if (!paymentMethodTotals.has(methodId)) {
          paymentMethodTotals.set(methodId, {
            methodName,
            total: 0,
            count: 0,
            receipts: []
          })
        }

        const methodTotal = paymentMethodTotals.get(methodId)
        methodTotal.total += Number(amount)
        methodTotal.count += receipt.isVoided ? 0 : 1
        
        // Add receipt details to the payment method's receipts array
        methodTotal.receipts.push({
          date: receipt.paymentDate.toFormat('yyyy-MM-dd HH:mm:ss'),
          receiptNumber: receipt.receiptNumber,
          summary: receipt.description,
          amount: receipt.totalAmount,
          user: receipt.creator.fullName,
          enteredOn: receipt.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
          isVoided: receipt.isVoided,
          currency: receipt.currency,
          guest: receipt.tenant.displayName
        })
        
        grandTotalAmount += Number(amount)
      })

      const reportData = {
        hotelInformation: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          email: hotel.email
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd')
        },
        receiptList,
        paymentMethodTotals: Array.from(paymentMethodTotals.values()),
        grandTotalAmount
      }

      // Generate HTML content using Edge template
      const htmlContent = await this.generateDetailHtml(
        hotel.hotelName,
        startDateTime,
        endDateTime,
        currencyId || 'XAF',
        reportData,
        printedBy
      )

      // Import PDF generation service
      const { default: PdfGenerationService } = await import('#services/pdf_generation_service')

      // Format dates for display
      const formattedFromDate = startDateTime.toFormat('dd/MM/yyyy')
      const formattedToDate = endDateTime.toFormat('dd/MM/yyyy')
      const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

      // Create header template
      const headerTemplate = `
      <div style="font-size:10px; width:100%; padding:3px 20px; margin:0;">
        <div style="display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #333; padding-bottom:2px; margin-bottom:3px;">
          <div style="font-weight:bold; color:#00008B; font-size:13px;">${hotel.hotelName}</div>
          <div style="font-size:13px; color:#8B0000; font-weight:bold;">Daily Receipt - Detail</div>
        </div>
        
        <div style="font-size:8px; margin-bottom:3px;">
          <span style="margin-right:10px;"><strong>From Date:</strong> ${formattedFromDate}</span>
          <span style="margin-right:10px;"><strong>To Date:</strong> ${formattedToDate}</span>
          <span><strong>Currency:</strong> ${currencyId || 'XAF'}</span>
        </div>
        
        <div style="border-top:1px solid #333; margin:0;"></div>
      </div>
      `

      // Create footer template
      const footerTemplate = `
      <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
        <div style="font-weight:bold;">Printed On: <span style="font-weight:normal;">${printedOn}</span></div>
        <div style="font-weight:bold;">Printed by: <span style="font-weight:normal;">${printedBy}</span></div>
        <div style="font-weight:bold;">Page <span class="pageNumber" style="font-weight:normal;"></span> of <span class="totalPages" style="font-weight:normal;"></span></div>
      </div>
      `

      // Generate PDF with header and footer
      const pdfBuffer = await PdfGenerationService.generatePdfFromHtml(htmlContent, {
        format: 'A4',
        margin: {
          top: '70px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        printBackground: true
      })

      // Set response headers
      const fileName = `daily-receipt-detail-${hotel.hotelName.replace(/\s+/g, '-')}-${startDateTime.toFormat('yyyy-MM-dd')}-to-${endDateTime.toFormat('yyyy-MM-dd')}.pdf`
      response.header('Content-Type', 'application/pdf')
      response.header('Content-Disposition', `attachment; filename="${fileName}"`)

      return response.send(pdfBuffer)

    } catch (error) {
      console.error('Error generating daily receipt detail PDF:', error)
      return response.internalServerError({
        success: false,
        message: 'Failed to generate daily receipt detail PDF',
        error: error.message
      })
    }
  }

  /**
   * Generate HTML content for Daily Receipt Summary Report using Edge template
   */
  private async generateSummaryHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    currency: string,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')
  
    // Configure Edge with views directory
    edge.mount(path.join(process.cwd(), 'resources/views'))
  
    // Format dates
    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')
  
    // Helper function for currency formatting
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }
  
    // Prepare template data
    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      currency,
      printedOn,
      printedBy,
      currentPage: 1,
      totalPages: 1, // Will be calculated by PDF service
      data: reportData,
      formatCurrency,
      // Header specific data
      header: {
        hotelName,
        reportTitle: 'Daily Receipt Summary Report',
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        currency
      },
      // Footer specific data
      footer: {
        printedBy,
        printedOn,
        pageInfo: 'Page {currentPage} of {totalPages}'
      }
    }
  
    // Render template
    return await edge.render('reports/daily_receipt_summary', templateData)
  }

  /**
   * Generate HTML content for Daily Receipt Detail Report using Edge template
   */
  private async generateDetailHtml(
    hotelName: string,
    fromDate: DateTime,
    toDate: DateTime,
    currency: string,
    reportData: any,
    printedBy: string = 'System'
  ): Promise<string> {
    const { default: edge } = await import('edge.js')
    const path = await import('path')

    // Configure Edge with views directory
    edge.mount(path.join(process.cwd(), 'resources/views'))

    // Format dates
    const formattedFromDate = fromDate.toFormat('dd/MM/yyyy')
    const formattedToDate = toDate.toFormat('dd/MM/yyyy')
    const printedOn = DateTime.now().toFormat('dd/MM/yyyy HH:mm:ss')

    // Helper function for currency formatting
    const formatCurrency = (amount: number | null | undefined): string => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    }

    // Helper function to calculate method total
    const calculateMethodTotal = (receipts: any[]): number => {
      if (!receipts || !Array.isArray(receipts)) return 0
      return receipts.reduce((sum, receipt) => sum + (parseFloat(receipt.amount) || 0), 0)
    }

    // Helper function to format date like in Vue template
    const formatDate = (dateString: string): string => {
      if (!dateString) return ''
      try {
        // Si la date est déjà au bon format, la retourner telle quelle
        if (dateString.includes('/') && dateString.includes(':')) {
          return dateString
        }
        
        // Sinon, convertir le format de date
        const date = new Date(dateString)
        if (isNaN(date.getTime())) {
          return dateString
        }
        
        return date.toLocaleString('en-GB', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }).replace(',', '')
      } catch (error) {
        return dateString
      }
    }

    // Calculate total entries
    const totalEntries = reportData.receiptList?.length || 0

    // Prepare template data
    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      currency,
      printedOn,
      printedBy,
      currentPage: 1,
      totalPages: 1,
      data: reportData,
      formatCurrency,
      calculateMethodTotal,
      formatDate,
      totalEntries,
      // Header specific data
      header: {
        hotelName,
        reportTitle: 'Daily Receipt Detailed Report',
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        currency
      },
      // Footer specific data
      footer: {
        printedBy,
        printedOn,
        pageInfo: 'Page {currentPage} of {totalPages}'
      }
    }

    return await edge.render('reports/daily_receipt_detail', templateData)
  }

  /**
   * Generate HTML content for Daily Revenue Report using Edge template
   */
  private async generateRevenueHtml(
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
        return '0'
      }
      return amount.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
    }

    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      printedOn,
      printedBy,
      data: reportData,
      filters: reportData.filters,
      formatCurrency
    }

    return await edge.render('reports/daily_revenue_report', templateData)
  }
}