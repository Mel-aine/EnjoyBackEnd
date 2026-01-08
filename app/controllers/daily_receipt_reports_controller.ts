import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Receipt from '#models/receipt'
import Hotel from '#models/hotel'
import Reservation from '#models/reservation' // Modifié: Reservation au lieu de Booking
import { createDailyReceiptReportValidator } from '#validators/daily_receipt_report'
import { createDailyRevenueReportValidator } from '#validators/daily_revenue_report'
import { PaymentMethodType,TransactionType, TransactionCategory } from '../enums.js'
import FolioTransaction from '#models/folio_transaction'

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
        .whereDoesntHave('paymentMethod', (pmQuery) => {
          pmQuery.where('method_type', PaymentMethodType.CITY_LEDGER)
        })

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
  async generateDailyRefundDetail({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createDailyReceiptReportValidator)
      const { fromDate, toDate, hotelId, receiptByUserId, currencyId, paymentMethodId } = payload
  
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)
  
      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)
  
      // Build query for refund transactions
      let query = FolioTransaction.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .preload('folio', (folioQuery) => {
          folioQuery.preload('reservation')
        })
        .where('hotelId', hotelId)
        .where('transactionType', TransactionType.REFUND)
        .where('category', TransactionCategory.REFUND)
        .where('transactionDate', '>=', startDateTime.startOf('day').toISO())
        .where('transactionDate', '<=', endDateTime.endOf('day').toISO())
  
      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }
  
      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }
  
      const refundTransactions = await query.orderBy('transactionDate', 'asc')
  
      // Group transactions by user
      const userSummaries = new Map()
      let grandTotalAmount = 0
  
      refundTransactions.forEach(transaction => {
        const userId = transaction.createdBy
        const userName = transaction.creator ? `${transaction.creator.fullName}` : 'Unknown User'
        const paymentMethodName = transaction.paymentMethod?.methodName || 'Unknown Method'
        const amount = Math.abs(Number(transaction.amount)) // Remboursements sont négatifs, on prend la valeur absolue
        
        // User summary
        if (!userSummaries.has(userId)) {
          userSummaries.set(userId, {
            userId,
            userName,
            transactions: [], // Liste des transactions détaillées
            userTotal: 0
          })
        }
  
        const userSummary = userSummaries.get(userId)
  
        // Ajouter la transaction à la liste
        userSummary.transactions.push({
          date: transaction.transactionDate.toFormat('yyyy-MM-dd HH:mm:ss'),
          receipt: transaction.receiptNumber || 'N/A',
          reference: transaction.reference || transaction.externalReference || transaction.paymentReference || 'N/A',
          amount: amount,
          user: userName,
          enteredOn: transaction.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
          paymentMethod: paymentMethodName,
          transactionNumber: transaction.transactionNumber,
          description: transaction.description,
          guestName: transaction.guestName,
          folioNumber: transaction.folio?.folioNumber,
          reservationNumber: transaction.folio?.reservation?.reservationNumber
        })
  
        // Mettre à jour les totaux
        userSummary.userTotal += amount
        grandTotalAmount += amount
      })
  
      // Convert Map to Array for response
      const userSummaryList = Array.from(userSummaries.values()).map(user => ({
        ...user,
        totalTransactions: user.transactions.length
      }))
  
      const responseData = {
        hotelDetails: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName
        },
        dateRange: {
          fromDate: startDateTime.toFormat('yyyy-MM-dd'),
          toDate: endDateTime.toFormat('yyyy-MM-dd'),
          fromDateTime: startDateTime.toISO(),
          toDateTime: endDateTime.toISO()
        },
        userSummaries: userSummaryList,
        grandTotals: {
          totalTransactions: refundTransactions.length,
          totalAmount: grandTotalAmount,
          netTotal: grandTotalAmount
        },
        reportType: 'DAILY_REFUND_DETAIL',
        filters: {
          fromDate: payload.fromDate,
          toDate: payload.toDate,
          hotelId: payload.hotelId,
          receiptByUserId: payload.receiptByUserId,
          paymentMethodId: payload.paymentMethodId
        }
      }
  
      return response.ok({
        success: true,
        message: 'Daily refund detail report generated successfully',
        data: responseData,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName,
        metadata: {
          totalRecords: refundTransactions.length,
          totalAmount: grandTotalAmount,
          dateRange: `${startDateTime.toFormat('dd/MM/yyyy')} - ${endDateTime.toFormat('dd/MM/yyyy')}`
        }
      })
  
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate daily refund detail report',
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
        .whereDoesntHave('paymentMethod', (pmQuery) => {
          pmQuery.where('method_type', PaymentMethodType.CITY_LEDGER)
        })

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
        message: 'Daily refund detail report generated successfully',
        data: responseData,
        filters: payload,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to generate daily refund detail report',
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
      } = payload
      console.log('payload@@@@@@@@@', payload)

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
                taxRateQuery.whereIn('tax_rates.tax_rate_id', taxIds)
              }
            })
            roomQuery.orderBy('sort_key', 'asc')
          })
        })
        .preload('reservationRooms', (reservationRoomQuery) => {
          reservationRoomQuery.preload('room')
          reservationRoomQuery.preload('roomType')
          reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
            roomRateQuery.preload('rateType')
          })
        })
        .preload('businessSource')
        .preload('paymentMethod')
        .preload('folios')
        .where('hotelId', hotelId)
        .whereDoesntHave('paymentMethod', (pmQuery) => {
          pmQuery.where('method_type', PaymentMethodType.CITY_LEDGER)
        })



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
      let grandTotalCharges = 0
      let grandTotalTaxes = 0
      let grandTotalRevenue = 0
      let grandTotalCommission = 0
      let totalNights = 0

      const reservationList = reservations.map((reservation) => {
        // Calculate nights
        const nights = reservation.numberOfNights || Math.ceil(
          reservation.departDate.diff(reservation.arrivedDate, 'days').days
        )
        
        // Calculate room rate
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const totalRoomRate = roomRate * nights

        // Calculate charges from folios
        let totalCharges = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.folioCharges && folio.folioCharges.length > 0) {
              folio.folioCharges.forEach((charge) => {
                totalCharges += Number(charge.amount || 0)
              })
            }
          })
        }

        // Calculate taxes (already filtered by preload)
        let totalTaxes = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.taxes) {
              folio.taxes.forEach((tax) => {
                totalTaxes += Number(tax.amount || 0)
              })
            }
          })
        }

        // Calculate commission
        const commissionRate = reservation.businessSource?.commissionValue || 0
        const commission = (totalRoomRate * commissionRate) / 100

        const totalRevenue = totalRoomRate + totalCharges + totalTaxes

        // Update grand totals
        grandTotalRoomRate += totalRoomRate
        grandTotalCharges += totalCharges
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
          room:  reservation.reservationRooms?.[0]?.room?.roomNumber
          ? `${reservation.reservationRooms?.[0]?.room?.roomNumber} - ${reservation.reservationRooms?.[0]?.roomType.roomTypeName}` 
          : 'N/A',
          voucherNo: reservation.confirmationCode || '-',
          rateType: reservation.reservationRooms?.[0]?.roomRates.rateType?.rateTypeName || 'N/A',
          folioNo: reservation.folios?.[0]?.folioNumber || '-',
          roomRate: totalRoomRate,
          totalCharges,
          totalTaxes,
          totalRevenue,
          commission,
          netRevenue: totalRevenue - commission,
          reservationType: reservation.reservationType?.name || 'Reservation',
          showOnlyUnassignRooms: !reservation.roomTypeId,
          businessSource: reservation.businessSource?.name || 'N/A',
          paymentMethod: reservation.paymentMethod?.methodName || '-'
        }
        console.log('reservationData@@@@@@@@@', reservationData)
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
          totalCharges: grandTotalCharges,
          totalTaxes: grandTotalTaxes,
          totalRevenue: grandTotalRevenue,
          totalCommission: grandTotalCommission,
          netRevenue: grandTotalRevenue - grandTotalCommission,
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
          discardUnconfirmedBookings
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
      console.log('error', error)
      return response.badRequest({
        success: false,
        error: error
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

      console.log('payload@@@@@@@@@', payload)
      const startDateTime = DateTime.fromISO(fromDate)
      const endDateTime = DateTime.fromISO(toDate)

      // Get hotel details
      const hotel = await Hotel.findOrFail(hotelId)

      // Get authenticated user information
      const user = auth.user
      const printedBy = user 
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'

      // Build query for reservations (IDENTIQUE à generatedailyRevenueReport)
      let query = Reservation.query()
        .preload('guest')
        .preload('roomType', (roomTypeQuery) => {
          roomTypeQuery.preload('rooms', (roomQuery) => {
            roomQuery.preload('taxRates', (taxRateQuery) => {
              if (taxIds && taxIds.length > 0) {
                taxRateQuery.whereIn('tax_rates.tax_rate_id', taxIds)
              }
            })
            roomQuery.orderBy('sort_key', 'asc')
          })
        })
        .preload('reservationRooms', (reservationRoomQuery) => {
          reservationRoomQuery.preload('room')
          reservationRoomQuery.preload('roomType')
          reservationRoomQuery.preload('roomRates', (roomRateQuery) => {
            roomRateQuery.preload('rateType')
          })
        })
        .preload('businessSource')
        .preload('paymentMethod')
        .preload('folios')
        .where('hotelId', hotelId)
        .whereDoesntHave('paymentMethod', (pmQuery) => {
          pmQuery.where('method_type', PaymentMethodType.CITY_LEDGER)
        })

      // Apply date type filter (IDENTIQUE)
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

      // Apply optional filters (IDENTIQUE)
      if (roomId) {
        query = query.where('roomTypeId', roomId)
      }

      if (businessSourceId) {
        query = query.where('businessSourceId', businessSourceId)
      }

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
      
      
      // Process data (IDENTIQUE avec les charges)
      let grandTotalRoomRate = 0
      let grandTotalCharges = 0
      let grandTotalTaxes = 0
      let grandTotalRevenue = 0
      let grandTotalCommission = 0
      let totalNights = 0

      const reservationList = reservations.map((reservation, index) => {
        const nights = reservation.numberOfNights || Math.ceil(
          reservation.departDate.diff(reservation.arrivedDate, 'days').days
        )
        
        const roomRate = reservation.reservationRooms?.[0]?.roomRate || reservation.roomRate || 0
        const totalRoomRate = roomRate * nights

        // Calculate charges from folios
        let totalCharges = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.folioCharges && folio.folioCharges.length > 0) {
              folio.folioCharges.forEach((charge) => {
                totalCharges += Number(charge.amount || 0)
              })
            }
          })
        }

        // Calculate taxes (already filtered by preload)
        let totalTaxes = 0
        if (reservation.folios && reservation.folios.length > 0) {
          reservation.folios.forEach((folio) => {
            if (folio.taxes) {
              folio.taxes.forEach((tax) => {
                totalTaxes += Number(tax.amount || 0)
              })
            }
          })
        }

        const commissionRate = reservation.businessSource?.commissionValue || 0
        const commission = (totalRoomRate * commissionRate) / 100
        const totalRevenue = totalRoomRate + totalCharges + totalTaxes
        
        grandTotalRoomRate += totalRoomRate
        grandTotalCharges += totalCharges
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
          room:  reservation.reservationRooms?.[0]?.room?.roomNumber
          ? `${reservation.reservationRooms?.[0]?.room?.roomNumber} - ${reservation.reservationRooms?.[0]?.roomType.roomTypeName}` 
          : 'N/A',
          voucherNo: reservation.confirmationCode || '-',
          rateType: reservation.reservationRooms?.[0]?.roomRates?.rateType?.rateTypeName || 'N/A',
          folioNo: reservation.folios?.[0]?.folioNumber || '-',
          roomRate: totalRoomRate,
          totalCharges,
          totalTaxes,
          totalRevenue,
          commission,
          netRevenue: totalRevenue - commission,
          businessSource: reservation.businessSource?.name || 'Direct',
          paymentMethod: reservation.paymentMethod?.methodName || '-'
        }
      })

      const reportData = {
        hotelDetails: {
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
          totalRoomRate: grandTotalRoomRate,
          totalCharges: grandTotalCharges,
          totalTaxes: grandTotalTaxes,
          totalRevenue: grandTotalRevenue,
          totalCommission: grandTotalCommission,
          netRevenue: grandTotalRevenue - grandTotalCommission,
          totalNights,
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
          discardUnconfirmedBookings
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
          top: '60px',
          right: '10px',
          bottom: '70px',
          left: '10px'
        },
        displayHeaderFooter: true,
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
        ? `${user.fullName || ''}`.trim() || user.email || 'Unknown User' 
        : 'System'
  
      // Build query for receipts
      let query = Receipt.query()
        .preload('creator')
        .preload('paymentMethod')
        .preload('hotel')
        .where('hotelId', hotelId)
        .whereDoesntHave('paymentMethod',(paQuery)=>paQuery.where('method_type',PaymentMethodType.CITY_LEDGER))
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
   * Generate PDF for Detailed Daily Refund Report
   */

    async generateDailyRefundDetailPdf({ request, response, auth }: HttpContext) {
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
          ? `${user.fullName || ''}`.trim() || user.email || 'Unknown User' 
          : 'System'
    
        // Build query for refund transactions
        let query = FolioTransaction.query()
          .preload('creator')
          .preload('paymentMethod')
          .preload('hotel')
          .preload('folio', (folioQuery) => {
            folioQuery.preload('reservation')
          })
          .where('hotelId', hotelId)
          .where('transactionType', TransactionType.REFUND)
          .where('category', TransactionCategory.REFUND)
          .where('transactionDate', '>=', startDateTime.startOf('day').toISO())
          .where('transactionDate', '<=', endDateTime.endOf('day').toISO())
    
        if (receiptByUserId) {
          query = query.where('createdBy', receiptByUserId)
        }
    
        if (paymentMethodId) {
          query = query.where('paymentMethodId', paymentMethodId)
        }
    
        const refundTransactions = await query.orderBy('transactionDate', 'asc')
    
        // Group transactions by user
        const userSummaries = new Map()
        let grandTotalAmount = 0
    
        refundTransactions.forEach(transaction => {
          const userId = transaction.createdBy
          const userName = transaction.creator ? `${transaction.creator.fullName}` : 'Unknown User'
          const paymentMethodName = transaction.paymentMethod?.methodName || 'Unknown Method'
          const amount = Math.abs(Number(transaction.amount)) // Remboursements sont négatifs, on prend la valeur absolue
          
          // User summary
          if (!userSummaries.has(userId)) {
            userSummaries.set(userId, {
              userId,
              userName,
              transactions: [], // Liste des transactions détaillées
              userTotal: 0
            })
          }
    
          const userSummary = userSummaries.get(userId)
    
          // Ajouter la transaction à la liste
          userSummary.transactions.push({
            date: transaction.transactionDate.toFormat('yyyy-MM-dd HH:mm:ss'),
            receipt: transaction.receiptNumber || 'N/A',
            reference: transaction.reference || transaction.externalReference || transaction.paymentReference || 'N/A',
            amount: amount,
            user: userName,
            enteredOn: transaction.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
            paymentMethod: paymentMethodName,
            transactionNumber: transaction.transactionNumber,
            description: transaction.description,
            guestName: transaction.guestName,
            folioNumber: transaction.folio?.folioNumber,
            reservationNumber: transaction.folio?.reservation?.reservationNumber
          })
    
          // Mettre à jour les totaux
          userSummary.userTotal += amount
          grandTotalAmount += amount
        })
    
        // Convert Map to Array for response
        const userSummaryList = Array.from(userSummaries.values()).map(user => ({
          ...user,
          totalTransactions: user.transactions.length
        }))
    
        const reportData = {
          hotelDetails: {
            hotelId: hotel.id,
            hotelName: hotel.hotelName
          },
          dateRange: {
            fromDate: startDateTime.toFormat('yyyy-MM-dd'),
            toDate: endDateTime.toFormat('yyyy-MM-dd'),
            fromDateTime: startDateTime.toISO(),
            toDateTime: endDateTime.toISO()
          },
          userSummaries: userSummaryList,
          grandTotals: {
            totalTransactions: refundTransactions.length,
            totalAmount: grandTotalAmount,
            netTotal: grandTotalAmount
          },
          reportType: 'DAILY_REFUND_DETAIL',
          filters: {
            fromDate: payload.fromDate,
            toDate: payload.toDate,
            hotelId: payload.hotelId,
            receiptByUserId: payload.receiptByUserId,
            paymentMethodId: payload.paymentMethodId
          }
        }
    
        // Generate HTML content using Edge template
        const htmlContent = await this.generateRefundDetailHtml(
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
            <div style="font-size:13px; color:#8B0000; font-weight:bold;">Daily Refund - Detail Report</div>
          </div>
          
          <!-- Report Info -->
          <div style="font-size:8px; margin-bottom:3px;">
            <span style="margin-right:10px;"><strong>From:</strong> ${formattedFromDate} <strong>To:</strong> ${formattedToDate}</span>
            <span><strong>Currency:</strong> ${currencyId || 'XAF'}</span>
          </div>
          
          <div style="border-top:1px solid #333; margin:0;"></div>
        </div>
        `
    
        // Create footer template
        const footerTemplate = `
        <div style="font-size:9px; width:100%; padding:8px 20px; border-top:1px solid #ddd; color:#555; display:flex; align-items:center; justify-content:space-between;">
          <div style="font-weight:bold;">Generated On: <span style="font-weight:normal;">${printedOn}</span></div>
          <div style="font-weight:bold;">Generated by: <span style="font-weight:normal;">${printedBy}</span></div>
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
        const fileName = `daily-refund-detail-${hotel.hotelName.replace(/\s+/g, '-')}-${startDateTime.toFormat('yyyy-MM-dd')}-to-${endDateTime.toFormat('yyyy-MM-dd')}.pdf`
        response.header('Content-Type', 'application/pdf')
        response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    
        return response.send(pdfBuffer)
    
      } catch (error) {
        console.error('Error generating daily refund detail PDF:', error)
        return response.internalServerError({
          success: false,
          message: 'Failed to generate daily refund detail PDF',
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
        .whereDoesntHave('paymentMethod', (pmQuery) => {
          pmQuery.where('method_type', PaymentMethodType.CITY_LEDGER)
        })

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
  private async generateRefundDetailHtml(
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
  
    // Helper function to format date
    const formatDate = (dateString: string): string => {
      if (!dateString) return 'N/A'
      
      try {
        // Essayer différents formats de date
        let date: DateTime | null = null
        
        // Essayer DateTime.fromISO
        date = DateTime.fromISO(dateString)
        if (date.isValid) {
          return date.toFormat('dd/MM/yyyy HH:mm:ss')
        }
        
        // Essayer DateTime.fromSQL (format MySQL)
        date = DateTime.fromSQL(dateString)
        if (date.isValid) {
          return date.toFormat('dd/MM/yyyy HH:mm:ss')
        }
        
        // Essayer de parser comme string
        const jsDate = new Date(dateString)
        if (!isNaN(jsDate.getTime())) {
          return DateTime.fromJSDate(jsDate).toFormat('dd/MM/yyyy HH:mm:ss')
        }
        
        // Retourner la string originale si on ne peut pas la parser
        return dateString
      } catch (error) {
        return dateString
      }
    }
  
    // S'assurer que reportData a la structure attendue
    const userSummaries = reportData.userSummaries || []
    const grandTotals = reportData.grandTotals || {
      totalTransactions: 0,
      totalAmount: 0,
      netTotal: 0
    }
  
    // Préparer les données pour le template
    const templateData = {
      hotelName,
      fromDate: formattedFromDate,
      toDate: formattedToDate,
      currency,
      printedOn,
      printedBy,
      currentPage: 1,
      totalPages: 1,
      data: {
        // Structure principale pour le template de détail des remboursements
        userSummaries: userSummaries.map((userSummary: any) => ({
          userName: userSummary.userName || 'Unknown User',
          totalTransactions: userSummary.totalTransactions || (userSummary.transactions ? userSummary.transactions.length : 0),
          userTotal: userSummary.userTotal || 0,
          transactions: (userSummary.transactions || []).map((transaction: any) => {
            // Normaliser les données de transaction
            const transactionDate = transaction.date || transaction.transactionDate || transaction.createdAt
            const receiptNumber = transaction.receipt || transaction.receiptNumber || transaction.reference || 'N/A'
            const reference = transaction.reference || transaction.externalReference || transaction.paymentReference || transaction.description || 'N/A'
            const amount = Math.abs(transaction.amount || 0) // Remboursements sont négatifs, on prend la valeur absolue
            const userName = transaction.user || userSummary.userName || 'Unknown User'
            const enteredOn = transaction.enteredOn || transaction.createdAt || transactionDate
            const paymentMethod = transaction.paymentMethod || transaction.paymentMethodName || 'Unknown'
            
            return {
              date: formatDate(transactionDate),
              receipt: receiptNumber,
              reference: reference,
              amount: amount,
              user: userName,
              enteredOn: formatDate(enteredOn),
              paymentMethod: paymentMethod
            }
          })
        })),
        grandTotals: {
          totalTransactions: grandTotals.totalTransactions || userSummaries.reduce((sum: number, user: any) => sum + (user.totalTransactions || 0), 0),
          totalAmount: grandTotals.totalAmount || userSummaries.reduce((sum: number, user: any) => sum + (user.userTotal || 0), 0),
          netTotal: grandTotals.netTotal || grandTotals.totalAmount || userSummaries.reduce((sum: number, user: any) => sum + (user.userTotal || 0), 0)
        }
      },
      formatCurrency,
      formatDate,
      // Statistiques
      totalEntries: grandTotals.totalTransactions || 0,
      // Header specific data
      header: {
        hotelName,
        reportTitle: 'Daily Refund Detail Report',
        fromDate: formattedFromDate,
        toDate: formattedToDate,
        currency,
        totalTransactions: grandTotals.totalTransactions || 0,
        totalAmount: formatCurrency(grandTotals.totalAmount || 0)
      }
    }
  
    // Utiliser le bon template - daily_refund_detail.edge
    return await edge.render('reports/daily-refund-detail', templateData)
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