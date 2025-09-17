import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Receipt from '#models/receipt'
import Hotel from '#models/hotel'
import User from '#models/user'
import PaymentMethod from '#models/payment_method'
import Currency from '#models/currency'
import { createDailyReceiptReportValidator } from '#validators/daily_receipt_report'
import LoggerService from '#services/logger_service'

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
        .preload('createdByUser')
        .preload('paymentMethod')
        .preload('currency')
        .preload('hotel')
        .where('hotelId', hotelId)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())

      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }

      if (currencyId) {
        query = query.where('currencyId', currencyId)
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
        const userId = receipt.createdBy
        const userName = receipt.createdByUser ? 
          `${receipt.createdByUser.firstName} ${receipt.createdByUser.lastName}` : 
          'Unknown User'
        const paymentMethodId = receipt.paymentMethodId
        const paymentMethodName = receipt.paymentMethod?.methodName || 'Unknown Method'
        const amount = receipt.totalAmount
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
          methodSummary.voidAmount += amount
          userSummary.totalVoid += 1
          userSummary.voidAmount += amount
          grandTotalVoid += 1
          grandVoidAmount += amount
        } else {
          methodSummary.totalTransactions += 1
          methodSummary.amount += amount
          userSummary.totalTransactions += 1
          userSummary.totalAmount += amount
          grandTotalTransactions += 1
          grandTotalAmount += amount
        }

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
          globalMethodSummary.voidAmount += amount
        } else {
          globalMethodSummary.totalTransactions += 1
          globalMethodSummary.amount += amount
        }

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

      // Log the report generation
      await LoggerService.log({
        level: 'info',
        message: 'Daily receipt summary report generated',
        data: {
          hotelId,
          fromDate,
          toDate,
          receiptByUserId,
          currencyId,
          paymentMethodId,
          totalReceipts: receipts.length,
          generatedBy: auth.user?.id
        }
      })

      return response.ok({
        success: true,
        message: 'Daily receipt summary report generated successfully',
        data: responseData,
        filters: payload,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to generate daily receipt summary report',
        data: {
          error: error.message,
          stack: error.stack,
          userId: auth.user?.id
        }
      })

      return response.badRequest({
        success: false,
        message: 'Failed to generate daily receipt summary report',
        error: error.message
      })
    }
  }

  /**
   * Generate Daily Receipt Detail Report
   * Input: fromDate, toDate, hotelId, receiptByUserId (optional), currencyId (optional), paymentMethodId (optional)
   * Output: Detailed list of receipts with totals by payment method
   */
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
        .preload('createdByUser')
        .preload('paymentMethod')
        .preload('currency')
        .preload('hotel')
        .preload('tenant') // Guest
        .where('hotelId', hotelId)
        .where('paymentDate', '>=', startDateTime.toSQLDate())
        .where('paymentDate', '<=', endDateTime.toSQLDate())

      if (receiptByUserId) {
        query = query.where('createdBy', receiptByUserId)
      }

      if (currencyId) {
        query = query.where('currencyId', currencyId)
      }

      if (paymentMethodId) {
        query = query.where('paymentMethodId', paymentMethodId)
      }

      const receipts = await query.orderBy('paymentDate', 'asc')

      // Process receipt details
      const receiptList = receipts.map(receipt => ({
        date: DateTime.fromJSDate(receipt.paymentDate).toFormat('yyyy-MM-dd HH:mm:ss'),
        receiptNumber: receipt.receiptNumber,
        summary: receipt.description,
        amount: receipt.totalAmount,
        user: receipt.createdByUser ? 
          `${receipt.createdByUser.firstName} ${receipt.createdByUser.lastName}` : 
          'Unknown User',
        enteredOn: DateTime.fromJSDate(receipt.createdAt).toFormat('yyyy-MM-dd HH:mm:ss'),
        paymentMethod: receipt.paymentMethod?.methodName || 'Unknown Method',
        isVoided: receipt.isVoided,
        currency: receipt.currency?.currencyCode || 'XAF',
        guest: receipt.tenant ? 
          `${receipt.tenant.firstName} ${receipt.tenant.lastName}` : 
          'Unknown Guest'
      }))

      // Calculate totals by payment method
      const paymentMethodTotals = new Map()
      let grandTotalAmount = 0

      receipts.forEach(receipt => {
        const methodId = receipt.paymentMethodId
        const methodName = receipt.paymentMethod?.methodName || 'Unknown Method'
        const amount = receipt.isVoided ? 0 : receipt.totalAmount

        if (!paymentMethodTotals.has(methodId)) {
          paymentMethodTotals.set(methodId, {
            methodName,
            total: 0,
            count: 0
          })
        }

        const methodTotal = paymentMethodTotals.get(methodId)
        methodTotal.total += amount
        methodTotal.count += receipt.isVoided ? 0 : 1
        grandTotalAmount += amount
      })

      const responseData = {
        hotelInformation: {
          hotelId: hotel.id,
          hotelName: hotel.hotelName,
          address: hotel.address,
          contactPerson: hotel.contactPerson,
          phone: hotel.phone,
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

      // Log the report generation
      await LoggerService.log({
        level: 'info',
        message: 'Daily receipt detail report generated',
        data: {
          hotelId,
          fromDate,
          toDate,
          receiptByUserId,
          currencyId,
          paymentMethodId,
          totalReceipts: receipts.length,
          generatedBy: auth.user?.id
        }
      })

      return response.ok({
        success: true,
        message: 'Daily receipt detail report generated successfully',
        data: responseData,
        filters: payload,
        generatedAt: DateTime.now().toISO(),
        generatedBy: auth.user?.firstName + ' ' + auth.user?.lastName
      })

    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to generate daily receipt detail report',
        data: {
          error: error.message,
          stack: error.stack,
          userId: auth.user?.id
        }
      })

      return response.badRequest({
        success: false,
        message: 'Failed to generate daily receipt detail report',
        error: error.message
      })
    }
  }
}