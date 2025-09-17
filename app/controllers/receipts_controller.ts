import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Receipt from '#models/receipt'
import ReceiptService from '#services/receipt_service'
import LoggerService from '#services/logger_service'
import {
  createReceiptValidator,
  updateReceiptValidator,
  voidReceiptValidator,
  receiptQueryValidator
} from '#validators/receipt'

export default class ReceiptsController {
  /**
   * Display a list of receipts with filtering and pagination
   */
  async index({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(receiptQueryValidator)
      
      // Convert date strings to DateTime objects if provided
      const options = {
        ...payload,
        fromDate: payload.fromDate ? DateTime.fromJSDate(payload.fromDate) : undefined,
        toDate: payload.toDate ? DateTime.fromJSDate(payload.toDate) : undefined
      }

      const result = await ReceiptService.getReceipts(options)

      return response.ok({
        message: 'Receipts retrieved successfully',
        data: result.data,
        meta: result.meta
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to retrieve receipts',
        data: { error: error.message }
      })

      return response.internalServerError({
        message: 'Failed to retrieve receipts',
        error: error.message
      })
    }
  }

  /**
   * Create a new receipt
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReceiptValidator)

      const receiptData = {
        ...payload,
        paymentDate: DateTime.fromJSDate(payload.paymentDate),
        createdBy: payload.createdBy || auth.user?.id || 0
      }

      const receipt = await ReceiptService.createReceipt(receiptData)

      // Load relationships for response
      await receipt.load('hotel')
      await receipt.load('tenant')
      await receipt.load('paymentMethod')
      await receipt.load('creator')
      await receipt.load('folioTransaction')

      return response.created({
        message: 'Receipt created successfully',
        data: receipt
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to create receipt',
        data: { error: error.message, payload: request.body() }
      })

      return response.badRequest({
        message: 'Failed to create receipt',
        error: error.message
      })
    }
  }

  /**
   * Show a specific receipt
   */
  async show({ params, response }: HttpContext) {
    try {
      const receipt = await ReceiptService.getReceiptById(params.id)

      if (!receipt) {
        return response.notFound({
          message: 'Receipt not found'
        })
      }

      return response.ok({
        message: 'Receipt retrieved successfully',
        data: receipt
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to retrieve receipt',
        data: { error: error.message, receiptId: params.id }
      })

      return response.internalServerError({
        message: 'Failed to retrieve receipt',
        error: error.message
      })
    }
  }

  /**
   * Update a receipt
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateReceiptValidator)

      const receipt = await Receipt.findOrFail(params.id)

      if (receipt.isVoided) {
        return response.badRequest({
          message: 'Cannot update a voided receipt'
        })
      }

      // Convert date if provided
      if (payload.paymentDate) {
        payload.paymentDate = DateTime.fromJSDate(payload.paymentDate)
      }

      receipt.merge(payload)
      await receipt.save()

      // Load relationships for response
      await receipt.load('hotel')
      await receipt.load('tenant')
      await receipt.load('paymentMethod')
      await receipt.load('creator')
      await receipt.load('folioTransaction')

      await LoggerService.log({
        level: 'info',
        message: 'Receipt updated successfully',
        data: {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber
        }
      })

      return response.ok({
        message: 'Receipt updated successfully',
        data: receipt
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to update receipt',
        data: { error: error.message, receiptId: params.id }
      })

      return response.badRequest({
        message: 'Failed to update receipt',
        error: error.message
      })
    }
  }

  /**
   * Void a receipt
   */
  async void({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(voidReceiptValidator)

      const voidData = {
        receiptId: params.id,
        voidedBy: payload.voidedBy || auth.user?.id || 0,
        reason: payload.reason
      }

      const receipt = await ReceiptService.voidReceipt(voidData)

      // Load relationships for response
      await receipt.load('hotel')
      await receipt.load('tenant')
      await receipt.load('paymentMethod')
      await receipt.load('creator')
      await receipt.load('voider')
      await receipt.load('folioTransaction')

      return response.ok({
        message: 'Receipt voided successfully',
        data: receipt
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to void receipt',
        data: { error: error.message, receiptId: params.id }
      })

      return response.badRequest({
        message: 'Failed to void receipt',
        error: error.message
      })
    }
  }

  /**
   * Delete a receipt (soft delete)
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const receipt = await Receipt.findOrFail(params.id)

      if (receipt.isVoided) {
        return response.badRequest({
          message: 'Cannot delete a voided receipt'
        })
      }

      await receipt.delete()

      await LoggerService.log({
        level: 'info',
        message: 'Receipt deleted successfully',
        data: {
          receiptId: receipt.id,
          receiptNumber: receipt.receiptNumber
        }
      })

      return response.ok({
        message: 'Receipt deleted successfully'
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to delete receipt',
        data: { error: error.message, receiptId: params.id }
      })

      return response.badRequest({
        message: 'Failed to delete receipt',
        error: error.message
      })
    }
  }

  /**
   * Get receipt by receipt number
   */
  async getByNumber({ params, response }: HttpContext) {
    try {
      const receipt = await ReceiptService.getReceiptByNumber(params.receiptNumber)

      if (!receipt) {
        return response.notFound({
          message: 'Receipt not found'
        })
      }

      return response.ok({
        message: 'Receipt retrieved successfully',
        data: receipt
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to retrieve receipt by number',
        data: { error: error.message, receiptNumber: params.receiptNumber }
      })

      return response.internalServerError({
        message: 'Failed to retrieve receipt',
        error: error.message
      })
    }
  }

  /**
   * Get receipt summary for a date range
   */
  async getSummary({ request, response }: HttpContext) {
    try {
      const hotelId = request.input('hotelId')
      const fromDate = request.input('fromDate')
      const toDate = request.input('toDate')
      const paymentMethodId = request.input('paymentMethodId')
      const createdBy = request.input('createdBy')
      const currency = request.input('currency')

      if (!hotelId || !fromDate || !toDate) {
        return response.badRequest({
          message: 'Hotel ID, from date, and to date are required'
        })
      }

      const summary = await ReceiptService.getReceiptSummary(
        hotelId,
        DateTime.fromISO(fromDate),
        DateTime.fromISO(toDate),
        {
          paymentMethodId,
          createdBy,
          currency
        }
      )

      return response.ok({
        message: 'Receipt summary retrieved successfully',
        data: summary
      })
    } catch (error) {
      await LoggerService.log({
        level: 'error',
        message: 'Failed to retrieve receipt summary',
        data: { error: error.message }
      })

      return response.internalServerError({
        message: 'Failed to retrieve receipt summary',
        error: error.message
      })
    }
  }
}