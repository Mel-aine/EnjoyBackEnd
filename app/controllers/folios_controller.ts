import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Folio from '#models/folio'
import { createFolioValidator, updateFolioValidator } from '#validators/folio'

export default class FoliosController {
  /**
   * Display a list of folios
   */
  async index({ request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')
      const hotelId = request.input('hotel_id')
      const guestId = request.input('guest_id')
      const reservationId = request.input('reservation_id')
      const folioType = request.input('folio_type')
      const status = request.input('status')
      const hasBalance = request.input('has_balance')
      const isOverdue = request.input('is_overdue')
      const dateFrom = request.input('date_from')
      const dateTo = request.input('date_to')

      const query = Folio.query()

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      if (guestId) {
        query.where('guest_id', guestId)
      }

      if (reservationId) {
        query.where('reservation_id', reservationId)
      }

      if (search) {
        query.where((builder) => {
          builder
            .where('folio_number', 'ILIKE', `%${search}%`)
            .orWhereHas('guest', (guestQuery) => {
              guestQuery
                .where('first_name', 'ILIKE', `%${search}%`)
                .orWhere('last_name', 'ILIKE', `%${search}%`)
                .orWhere('email', 'ILIKE', `%${search}%`)
            })
        })
      }

      if (folioType) {
        query.where('folio_type', folioType)
      }

      if (status) {
        query.where('status', status)
      }

      if (hasBalance === 'true') {
        query.where('balance', '>', 0)
      } else if (hasBalance === 'false') {
        query.where('balance', '<=', 0)
      }

      if (isOverdue === 'true') {
        query.where('due_date', '<', new Date()).where('balance', '>', 0)
      }

      if (dateFrom) {
        query.where('opened_date', '>=', new Date(dateFrom))
      }

      if (dateTo) {
        query.where('opened_date', '<=', new Date(dateTo))
      }

      const folios = await query
        .preload('hotel')
        .preload('guest')
        .preload('transactions')
        .orderBy('opened_date', 'desc')
        .paginate(page, limit)

      return response.ok({
        message: 'Folios retrieved successfully',
        data: folios
      })
    } catch (error) {
      return response.internalServerError({
        message: 'Failed to retrieve folios',
        error: error.message
      })
    }
  }

  /**
   * Create a new folio
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createFolioValidator)
      
      // Generate folio number
      const lastFolio = await Folio.query()
        .where('hotel_id', payload.hotel_id)
        .orderBy('created_at', 'desc')
        .first()
      
      const folioNumber = `F-${payload.hotel_id}-${String((lastFolio?.id || 0) + 1).padStart(8, '0')}`
      
      const folio = await Folio.create({
        ...payload,
        folioNumber,
        openedBy: auth.user?.id,
        createdBy: auth.user?.id
      })

      await folio.load('hotel')
      await folio.load('guest')

      return response.created({
        message: 'Folio created successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create folio',
        error: error.message
      })
    }
  }

  /**
   * Show a specific folio
   */
  async show({ params, response }: HttpContext) {
    try {
      const folio = await Folio.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('guest')
        .preload('transactions', (query) => {
          query.orderBy('transaction_date', 'desc')
        })
        .firstOrFail()

      return response.ok({
        message: 'Folio retrieved successfully',
        data: folio
      })
    } catch (error) {
      return response.notFound({
        message: 'Folio not found',
        error: error.message
      })
    }
  }

  /**
   * Update a folio
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const folio = await Folio.findOrFail(params.id)
      const payload = await request.validateUsing(updateFolioValidator)

      folio.merge({
        ...payload,
        lastModifiedBy: auth.user?.id || 0
      })

      await folio.save()
      await folio.load('hotel')
      await folio.load('guest')

      return response.ok({
        message: 'Folio updated successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to update folio',
        error: error.message
      })
    }
  }

  /**
   * Delete a folio
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const folio = await Folio.findOrFail(params.id)
      
      // Check if folio has transactions
      const transactionCount = await folio.related('transactions').query().count('* as total')
      if (transactionCount[0].$extras.total > 0) {
        return response.badRequest({
          message: 'Cannot delete folio with existing transactions'
        })
      }

      await folio.delete()

      return response.ok({
        message: 'Folio deleted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to delete folio',
        error: error.message
      })
    }
  }

  /**
   * Close a folio
   */
  async close({ params, request, response, auth }: HttpContext) {
    try {
      const folio = await Folio.findOrFail(params.id)
      const { notes } = request.only(['notes'])
      
      if (folio.status === 'closed') {
        return response.badRequest({
          message: 'Folio is already closed'
        })
      }

      if (folio.balance > 0) {
        return response.badRequest({
          message: 'Cannot close folio with outstanding balance'
        })
      }

      folio.status = 'closed'
      folio.closedDate = DateTime.now()
      folio.closedBy = auth.user?.id || 0
      folio.internalNotes = notes
      folio.lastModifiedBy = auth.user?.id || 0
      
      await folio.save()

      return response.ok({
        message: 'Folio closed successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to close folio',
        error: error.message
      })
    }
  }

  /**
   * Reopen a folio
   */
  async reopen({ params, request, response, auth }: HttpContext) {
    try {
      const folio = await Folio.findOrFail(params.id)
      const { reason } = request.only(['reason'])
      
      if (folio.status !== 'closed') {
        return response.badRequest({
          message: 'Can only reopen closed folios'
        })
      }

      folio.status = 'open'
      folio.closedDate = null
      folio.closedBy = null
      folio.internalNotes = reason
      folio.lastModifiedBy = auth.user?.id || 0
      
      await folio.save()

      return response.ok({
        message: 'Folio reopened successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to reopen folio',
        error: error.message
      })
    }
  }

  /**
   * Get folio balance
   */
  async balance({ params, response }: HttpContext) {
    try {
      const folio = await Folio.findOrFail(params.id)
      
      const balance = {
        folioNumber: folio.folioNumber,
        totalCharges: folio.totalCharges,
        totalPayments: folio.totalPayments,
        totalAdjustments: folio.totalAdjustments,
        totalTaxes: folio.totalTaxes,
        totalServiceCharges: folio.totalServiceCharges,
        totalDiscounts: folio.totalDiscounts,
        balance: folio.balance,
        creditLimit: folio.creditLimit,
        availableCredit: folio.creditLimit - folio.balance
      }

      return response.ok({
        message: 'Folio balance retrieved successfully',
        data: balance
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve folio balance',
        error: error.message
      })
    }
  }

  /**
   * Get folio statement
   */
  async statement({ params, response }: HttpContext) {
    try {
      const folio = await Folio.query()
        .where('id', params.id)
        .preload('hotel')
        .preload('guest')
        .preload('transactions', (query) => {
          query.orderBy('transaction_date', 'asc')
        })
        .firstOrFail()

      return response.ok({
        message: 'Folio statement retrieved successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve folio statement',
        error: error.message
      })
    }
  }

  /**
   * Transfer charges between folios
   */
  async transfer({ params, request, response, auth }: HttpContext) {
    try {
      const fromFolio = await Folio.findOrFail(params.id)
      const { toFolioId, amount } = request.only([
        'toFolioId', 'amount'
      ])
      
      if (!toFolioId || !amount) {
        return response.badRequest({
          message: 'Destination folio ID and amount are required'
        })
      }

      const toFolio = await Folio.findOrFail(toFolioId)
      
      if (fromFolio.balance < amount) {
        return response.badRequest({
          message: 'Insufficient balance for transfer'
        })
      }

      // Update balances
      fromFolio.balance -= amount
      fromFolio.transferredAmount = (fromFolio.transferredAmount || 0) + amount
      fromFolio.transferredTo = toFolioId
      if (auth.user?.id) {
        fromFolio.lastModifiedBy = auth.user.id
      }
      
      toFolio.balance += amount
      toFolio.transferredFrom = fromFolio.id
      if (auth.user?.id) {
        toFolio.lastModifiedBy = auth.user.id
      }
      
      await fromFolio.save()
      await toFolio.save()

      return response.ok({
        message: 'Transfer completed successfully',
        data: {
          fromFolio: {
            id: fromFolio.id,
            folioNumber: fromFolio.folioNumber,
            newBalance: fromFolio.balance
          },
          toFolio: {
            id: toFolio.id,
            folioNumber: toFolio.folioNumber,
            newBalance: toFolio.balance
          },
          transferAmount: amount
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to transfer charges',
        error: error.message
      })
    }
  }

  /**
   * Get overdue folios
   */
  async overdue({ request, response }: HttpContext) {
    try {
      const { hotelId } = request.only(['hotelId'])
      
      const query = Folio.query()
        .where('due_date', '<', new Date())
        .where('balance', '>', 0)
        .where('status', 'open')
      
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      const overdueFolios = await query
        .preload('hotel')
        .preload('guest')
        .orderBy('due_date', 'asc')

      return response.ok({
        message: 'Overdue folios retrieved successfully',
        data: overdueFolios
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve overdue folios',
        error: error.message
      })
    }
  }

  /**
   * Get folio statistics
   */
  async stats({ request, response }: HttpContext) {
    try {
      const { hotelId, period } = request.only(['hotelId', 'period'])
      
      const query = Folio.query()
      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Apply period filter if provided
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
        
        query.where('opened_date', '>=', startDate)
      }

      const totalFolios = await query.clone().count('* as total')
      const openFolios = await query.clone().where('status', 'open').count('* as total')
      const closedFolios = await query.clone().where('status', 'closed').count('* as total')
      const foliosWithBalance = await query.clone().where('balance', '>', 0).count('* as total')
      const overdueFolios = await query.clone()
        .where('due_date', '<', new Date())
        .where('balance', '>', 0)
        .count('* as total')
      
      const totalRevenue = await query.clone().sum('total_charges as revenue')
      const totalPayments = await query.clone().sum('total_payments as payments')
      const outstandingBalance = await query.clone().sum('balance as balance')

      const stats = {
        totalFolios: totalFolios[0].$extras.total,
        openFolios: openFolios[0].$extras.total,
        closedFolios: closedFolios[0].$extras.total,
        foliosWithBalance: foliosWithBalance[0].$extras.total,
        overdueFolios: overdueFolios[0].$extras.total,
        totalRevenue: totalRevenue[0].$extras.revenue || 0,
        totalPayments: totalPayments[0].$extras.payments || 0,
        outstandingBalance: outstandingBalance[0].$extras.balance || 0
      }

      return response.ok({
        message: 'Folio statistics retrieved successfully',
        data: stats
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve statistics',
        error: error.message
      })
    }
  }
}