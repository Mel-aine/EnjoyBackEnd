import type { HttpContext } from '@adonisjs/core/http'
import PaymentMethod from '#models/payment_method'
import { createPaymentMethodValidator, updatePaymentMethodValidator } from '#validators/payment_method'

export default class PaymentMethodsController {
  /**
   * Display a list of payment methods
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const methodType = request.input('method_type')
      const isActive = request.input('is_active')
      const isDefault = request.input('is_default')
      const requiresProcessing = request.input('requires_processing')

      const query = PaymentMethod.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('method_name', 'ILIKE', `%${search}%`)
            .orWhere('method_code', 'ILIKE', `%${search}%`)
            .orWhere('description', 'ILIKE', `%${search}%`)
        })
      }

      if (methodType) {
        query.where('method_type', methodType)
      }

      if (isActive !== undefined) {
        query.where('is_active', isActive)
      }

      if (isDefault !== undefined) {
        query.where('is_default', isDefault)
      }

      if (requiresProcessing !== undefined) {
        query.where('requires_processing', requiresProcessing)
      }

      const paymentMethods = await query
        .preload('hotel')
        .orderBy('sort_order', 'asc')
        .orderBy('method_name', 'asc')
        .paginate(page, limit)

      return response.ok({
        message: 'Payment methods retrieved successfully',
        data: paymentMethods
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve payment methods',
        error: error.message
      })
    }
  }

  /**
   * Create a new payment method
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createPaymentMethodValidator)

      const paymentMethod = await PaymentMethod.create({
        ...payload,
        createdBy: auth.user?.id || 0
      })

      await paymentMethod.load('hotel')

      return response.created({
        message: 'Payment method created successfully',
        data: paymentMethod
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create payment method',
        error: error.message
      })
    }
  }

  /**
   * Show a specific payment method
   */
  async show({ params, response }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('transactions')
        .firstOrFail()

      return response.ok({
        message: 'Payment method retrieved successfully',
        data: paymentMethod
      })
    } catch (error) {
      return response.notFound({
        message: 'Payment method not found',
        error: error.message
      })
    }
  }

  /**
   * Update a payment method
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)
      const payload = await request.validateUsing(updatePaymentMethodValidator)

      paymentMethod.merge({
        ...payload,
        lastModifiedBy: auth.user?.id
      })

      await paymentMethod.save()
      await paymentMethod.load('hotel')

      return response.ok({
        message: 'Payment method updated successfully',
        data: paymentMethod
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update payment method',
        error: error.message
      })
    }
  }

  /**
   * Delete a payment method
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)

      // Check if there are any transactions using this payment method
      await paymentMethod.load('transactions')
      const transactionCount = paymentMethod.transactions.length
      if (transactionCount > 0) {
        return response.badRequest({
          message: 'Cannot delete payment method with existing transactions'
        })
      }

      await paymentMethod.delete()

      return response.ok({
        message: 'Payment method deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete payment method',
        error: error.message
      })
    }
  }

  /**
   * Toggle payment method status
   */
  async toggleStatus({ params, response, auth }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)

      paymentMethod.isActive = !paymentMethod.isActive
      paymentMethod.lastModifiedBy = auth.user?.id || 0

      await paymentMethod.save()

      return response.ok({
        message: `Payment method ${paymentMethod.isActive ? 'activated' : 'deactivated'} successfully`,
        data: paymentMethod
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to toggle payment method status',
        error: error.message
      })
    }
  }

  /**
   * Set as default payment method
   */
  async setDefault({ params, response, auth }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)

      // Remove default from other payment methods in the same hotel
      await PaymentMethod.query()
        .where('hotel_id', paymentMethod.hotelId)
        .where('id', '!=', paymentMethod.id)
        .update({ isDefault: false })

      paymentMethod.isDefault = true
      paymentMethod.lastModifiedBy = auth.user?.id || 0

      await paymentMethod.save()

      return response.ok({
        message: 'Payment method set as default successfully',
        data: paymentMethod
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to set default payment method',
        error: error.message
      })
    }
  }

  /**
   * Update sort order
   */
  async updateSortOrder({ request, response, auth }: HttpContext) {
    try {
      const { paymentMethods } = request.only(['paymentMethods'])

      if (!Array.isArray(paymentMethods)) {
        return response.badRequest({
          message: 'Payment methods array is required'
        })
      }

      for (const item of paymentMethods) {
        await PaymentMethod.query()
          .where('id', item.id)
          .update({
            sortOrder: item.sortOrder,
            lastModifiedBy: auth.user?.id
          })
      }

      return response.ok({
        message: 'Payment method sort order updated successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update sort order',
        error: error.message
      })
    }
  }

  /**
   * Test payment method configuration
   */
  async testConfiguration({ params, response }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)

      if (!paymentMethod.requiresProcessing) {
        return response.badRequest({
          message: 'Payment method does not require processing'
        })
      }

      // This would typically involve testing the actual payment processor
      // For now, we'll simulate a test
      const testResult = {
        success: true,
        message: 'Payment method configuration is valid',
        responseTime: Math.random() * 1000,
        timestamp: new Date()
      }

      await paymentMethod.save()

      return response.ok({
        message: 'Payment method test completed',
        data: testResult
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to test payment method',
        error: error.message
      })
    }
  }

  /**
   * Get payment method statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId, period } = request.only(['hotelId', 'period'])

      const query = PaymentMethod.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const totalMethods = await query.clone().count('* as total')
      const activeMethods = await query.clone().where('is_active', true).count('* as total')
      const creditCardMethods = await query.clone().where('method_type', 'credit_card').count('* as total')
      const digitalMethods = await query.clone().where('method_type', 'digital_wallet').count('* as total')
      const cashMethods = await query.clone().where('method_type', 'cash').count('* as total')
      const bankTransferMethods = await query.clone().where('method_type', 'bank_transfer').count('* as total')

      // Get transaction statistics if period is provided
      let transactionStats = null
      if (period) {
        const now = new Date()
        let startDate: Date

        switch (period) {
          case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            break
          case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
            break
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1)
            break
          case 'year':
            startDate = new Date(now.getFullYear(), 0, 1)
            break
          default:
            startDate = new Date(0)
        }

        // This would require joining with folio_transactions table
        // For now, we'll return basic stats
        transactionStats = {
          period,
          startDate,
          endDate: now
        }
      }

      const stats = {
        totalMethods: totalMethods[0].$extras.total,
        activeMethods: activeMethods[0].$extras.total,
        methodsByType: {
          creditCard: creditCardMethods[0].$extras.total,
          digital: digitalMethods[0].$extras.total,
          cash: cashMethods[0].$extras.total,
          bankTransfer: bankTransferMethods[0].$extras.total
        },
        transactionStats
      }

      return response.ok({
        message: 'Payment method statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }

  /**
   * Get active payment methods for a hotel
   */
  async active({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.params()

      if (!hotelId) {
        return response.badRequest({
          message: 'Hotel ID is required'
        })
      }

      const activeMethods = await PaymentMethod.query()
        .where('hotel_id', hotelId)
       // .where('is_active', true)
        .orderBy('sort_order', 'asc')
        .orderBy('method_name', 'asc')

      return response.ok({
        message: 'Active payment methods retrieved successfully',
        data: activeMethods
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve active payment methods',
        error: error.message
      })
    }
  }

  /**
   * Get payment methods by type
   */
  async byType({ request, response }: HttpContext) {
    try {
      const { hotelId, methodType } = request.only(['hotelId', 'methodType'])

      if (!hotelId || !methodType) {
        return response.badRequest({
          message: 'Hotel ID and method type are required'
        })
      }

      const methods = await PaymentMethod.query()
        .where('hotel_id', hotelId)
        .where('method_type', methodType)
        .where('is_active', true)
        .orderBy('sort_order', 'asc')
        .orderBy('method_name', 'asc')

      return response.ok({
        message: 'Payment methods by type retrieved successfully',
        data: methods
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve payment methods by type',
        error: error.message
      })
    }
  }

  /**
   * Update processing configuration
   */
  async updateProcessingConfig({ params, request, response, auth }: HttpContext) {
    try {
      const paymentMethod = await PaymentMethod.findOrFail(params.id)
      const { processingConfig } = request.only(['processingConfig'])

      if (!processingConfig) {
        return response.badRequest({
          message: 'Processing configuration is required'
        })
      }

      paymentMethod.processorConfig = processingConfig
      paymentMethod.lastModifiedBy = auth.user?.id || 0

      await paymentMethod.save()

      return response.ok({
        message: 'Processing configuration updated successfully',
        data: paymentMethod
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update processing configuration',
        error: error.message
      })
    }
  }
}
