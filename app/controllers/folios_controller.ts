import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import Folio from '#models/folio'
import FolioService from '#services/folio_service'
import ReservationFolioService from '#services/reservation_folio_service'
import CheckoutService from '#services/checkout_service'
import FolioInquiryService from '#services/folio_inquiry_service'
import LoggerService from '#services/logger_service'
import Discount from '#models/discount'
import FolioTransaction from '#models/folio_transaction'
import db from '@adonisjs/lucid/services/db'
import { applyFolioDiscountValidator } from '#validators/folio_apply_discount'
import { TransactionType, TransactionCategory, TransactionStatus } from '#app/enums'
import {
  updateFolioValidator,
  postTransactionValidator,
  settleFolioValidator,
  transferChargesValidator,
  splitFolioValidator,
  splitFolioByTypeValidator,
  cutFolioValidator,
  addRoomChargeValidator,
  updateRoomChargeValidator,
  createFolioServiceValidator,
  createReservationFolioValidator,
  createWalkInFolioValidator,
  createGroupFoliosValidator,
  postRoomChargesValidator,
  postTaxesAndFeesValidator,
  checkoutValidator,
  reservationCheckoutValidator,
  forceCloseValidator,
  updateTransactionValidator

} from '#validators/folio'
import { addFolioAdjustmentValidator , updateFolioAdjustmentValidator } from '#validators/folio_adjustment'
import { FolioStatus, ReservationStatus } from '../enums.js'
import logger from '@adonisjs/core/services/logger'
import { generateTransactionCode } from '../utils/generate_guest_code.js'

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
  async store(ctx: HttpContext) {
    const { request, response, auth } = ctx;
    const payload = await request.validateUsing(createFolioServiceValidator)

    try {
      const folio = await FolioService.createFolio({
        ...payload,
        createdBy: auth.user!.id
      })

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'CREATE',
        entityType: 'Folio',
        entityId: folio.id,
        hotelId: folio.hotelId,
        description: `Folio "${folio.folioName}" created successfully`,
        changes: LoggerService.extractChanges({}, folio.toJSON()),
        ctx:ctx
      })

      return response.created({
        message: 'Folio created successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({ message: error.message })
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
          query.orderBy('transactionDate', 'desc')
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
  async update(ctx: HttpContext) {
    const { params, request, response, auth } = ctx;
    try {
      const folio = await Folio.findOrFail(params.id)
      const oldData = folio.toJSON()
      const payload = await request.validateUsing(updateFolioValidator)

      folio.merge({
        ...payload,
        lastModifiedBy: auth.user?.id || 0
      })

      await folio.save()
      await folio.load('hotel')
      await folio.load('guest')

      const changes = LoggerService.extractChanges(oldData, payload)
      if (Object.keys(changes).length > 0) {
        await LoggerService.log({
          actorId: auth.user?.id || 0,
          action: 'UPDATE',
          entityType: 'Folio',
          entityId: folio.id,
          hotelId: folio.hotelId,
          description: `Folio "${folio.folioName}" updated successfully`,
          changes: changes,
          ctx: ctx
        })
      }

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
  async destroy(ctx: HttpContext) {
   const  { params,  response, auth } = ctx;
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

      await LoggerService.log({
        actorId: auth.user?.id || 0,
        action: 'DELETE',
        entityType: 'Folio',
        entityId: folio.id,
        hotelId: folio.hotelId,
        description: `Folio "${folio.folioName}" deleted successfully`,
        changes: {},
        ctx: ctx
      })

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

      folio.status = FolioStatus.CLOSED
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

      folio.status = FolioStatus.OPEN
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
        .preload('transactions', (query) => {
          query.where('isVoided', false)
          query.select(['id', 'transactionDate', 'description', 'amount'])
          query.orderBy('transactionDate', 'asc')
        })
        .preload('reservationRoom', (roomQuery) => {
          roomQuery.select(['id', 'roomId'])
          roomQuery.preload('room')
        }).select('id', 'folioNumber', 'reservationRoomId')
        .firstOrFail()

      // Format the response with only necessary fields
      const formattedTransactions = folio.transactions.map(transaction => ({
        folio: folio.folioNumber,
        id: transaction.id,
        transactionDate: transaction.transactionDate,
        room: folio.reservationRoom?.room?.roomNumber || null,
        description: transaction.description,
        amount: transaction.amount
      }))

      return response.ok({
        message: 'Folio statement retrieved successfully',
        data: formattedTransactions
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve folio statement',
        error: error.message
      })
    }
  }

  /**
   * Apply a discount to a folio by creating a discount transaction
   */
  async applyDiscount(ctx: HttpContext) {
    logger.info('enterhere')
    const { request, response, auth } = ctx;
    const payload = await request.validateUsing(applyFolioDiscountValidator)

    try {
      const folio = await Folio.findOrFail(payload.folioId)

      if (!folio.canBeModified) {
        return response.badRequest({ message: 'Folio cannot be modified - finalized or closed' })
      }

      // Validate reservation/hotel context match when provided
      if (payload.reservationId && folio.reservationId && folio.reservationId !== payload.reservationId) {
        return response.badRequest({ message: 'Reservation mismatch for folio' })
      }
      if (payload.hotelId && folio.hotelId !== payload.hotelId) {
        return response.badRequest({ message: 'Hotel mismatch for folio' })
      }

      const discount = await Discount.findOrFail(payload.discountId)
      if (discount.status !== 'active' || discount.isDeleted) {
        return response.badRequest({ message: 'Discount is not active or has been deleted' })
      }

      // Determine applicable base amount for discount based on applyOn
      // room_charge -> sum of CHARGE transactions in ROOM category
      // extra_charge -> sum of CHARGE transactions in EXTRACT_CHARGE category
      const baseAmountResult = await db
        .from('folio_transactions')
        .where('folio_id', folio.id)
        .where('is_voided', false)
        .where('transaction_type', TransactionType.CHARGE)
        .sum('amount as total')
        .first()

      const applicableBase = parseFloat(`${baseAmountResult?.total || 0}`)

      // Calculate discount amount
      let discountAmount = 0
      if (discount.type === 'percentage') {
        discountAmount = applicableBase * (discount.value / 100)
      } else {
        // flat
        discountAmount = Math.min(discount.value, applicableBase)
      }

      // If there is no base to apply on, return gracefully
      if (!discountAmount || discountAmount <= 0) {
        return response.badRequest({ message: 'No applicable charges found to apply discount' })
      }

      // Generate a transaction number similar to service logic (sequential per hotel)
      const lastTx = await FolioTransaction.query()
        .where('hotelId', folio.hotelId)
        .orderBy('transactionNumber', 'desc')
        .first()
      const transactionNumber = Number((lastTx?.transactionNumber || 0)) + 1
      // Ensure transaction code respects 20-char DB limit
      const transactionCode = generateTransactionCode('DSC')

      // Build particular/description
      const category = TransactionCategory.DISCOUNT
      const particular = discount.name;
      const description = payload.notes?.trim() || `${discount.name} (${discount.shortCode})`

      // Create discount transaction: amount negative, discountAmount tracked
      const transaction = await FolioTransaction.create({
        hotelId: folio.hotelId,
        folioId: folio.id,
        reservationId: folio.reservationId ?? undefined,
        transactionNumber,
        transactionType: TransactionType.DISCOUNT,
        category,
        particular,
        description,
        amount: -Math.abs(discountAmount),
        totalAmount: -Math.abs(discountAmount),
        quantity: 1,
        unitPrice: -Math.abs(discountAmount),
        taxAmount: 0,
        serviceChargeAmount: 0,
        discountAmount: Math.abs(discountAmount),
        discountId: discount.id,
        netAmount: -Math.abs(discountAmount),
        grossAmount: -Math.abs(discountAmount),
        transactionCode: transactionCode,
        transactionTime: DateTime.now().toISOTime(),
        postingDate: DateTime.now(),
        transactionDate: payload.transactionDate ? DateTime.fromJSDate(new Date(payload.transactionDate)) : DateTime.now(),
        status: TransactionStatus.POSTED,
        createdBy: auth.user?.id || 0,
        lastModifiedBy: auth.user?.id || 0
      })

      // Update folio totals using the same logic as service controller
      // Sum of discountAmount is what reduces folio balance
      const transactions = await FolioTransaction.query()
        .where('folioId', folio.id)
        .where('isVoided', false)

      let totalCharges = 0
      let totalPayments = 0
      let totalAdjustments = 0
      let totalTaxes = 0
      let totalServiceCharges = 0
      let totalDiscounts = 0

      for (const tx of transactions) {
        switch (tx.transactionType) {
          case TransactionType.CHARGE:
            totalCharges += parseFloat(`${tx.amount ?? 0}`)
            break
          case TransactionType.PAYMENT:
            totalPayments += Math.abs(parseFloat(`${tx.amount ?? 0}`))
            break
          case TransactionType.ADJUSTMENT:
            totalAdjustments += parseFloat(`${tx.amount ?? 0}`)
            break
        }
        totalTaxes += parseFloat(`${tx.taxAmount ?? 0}`) || 0
        totalServiceCharges += parseFloat(`${tx.serviceChargeAmount ?? 0}`) || 0
        totalDiscounts += parseFloat(`${tx.discountAmount ?? 0}`) || 0
      }

      folio.totalCharges = totalCharges
      folio.totalPayments = totalPayments
      folio.totalAdjustments = totalAdjustments
      folio.totalTaxes = totalTaxes
      folio.totalServiceCharges = totalServiceCharges
      folio.totalDiscounts = totalDiscounts
      folio.balance = totalCharges + totalAdjustments + totalTaxes + totalServiceCharges - totalPayments - totalDiscounts
      folio.lastModifiedBy = auth.user?.id || 0
      await folio.save()

      // Enrich response for client-side folio operation reloads
      await transaction.load('hotel')
      await transaction.load('folio')

      await LoggerService.log({
        actorId: auth.user?.id || 0,
        action: 'CREATE',
        entityType: 'FolioTransaction',
        entityId: transaction.id,
        hotelId: folio.hotelId,
        description: `Applied discount "${discount.name}" to folio ${folio.folioNumber}`,
        changes: LoggerService.extractChanges({}, transaction.toJSON()),
        ctx: ctx
      })

      return response.created({
        message: 'Discount applied successfully',
        data: transaction
      })
    } catch (error) {
      logger.info(error)
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * update discount
   */
  public async updateDiscount(ctx: HttpContext) {
  const { request, response, auth } = ctx;
  logger.info('enter update discount')

  const payload = await request.validateUsing(applyFolioDiscountValidator)

  try {
    const transactionId = request.param('id')
    const existingTx = await FolioTransaction.findOrFail(transactionId)

    const folio = await Folio.findOrFail(existingTx.folioId)

    if (!folio.canBeModified) {
      return response.badRequest({ message: 'Folio cannot be modified - finalized or closed' })
    }

    // Validate reservation/hotel context
    if (payload.reservationId && folio.reservationId && folio.reservationId !== payload.reservationId) {
      return response.badRequest({ message: 'Reservation mismatch for folio' })
    }
    if (payload.hotelId && folio.hotelId !== payload.hotelId) {
      return response.badRequest({ message: 'Hotel mismatch for folio' })
    }

    // Validate discount
    const discount = await Discount.findOrFail(payload.discountId)
    if (discount.status !== 'active' || discount.isDeleted) {
      return response.badRequest({ message: 'Discount is not active or has been deleted' })
    }

    // Compute new applicable base
    const baseAmountResult = await db
      .from('folio_transactions')
      .where('folio_id', folio.id)
      .where('is_voided', false)
      .where('transaction_type', TransactionType.CHARGE)
      .sum('amount as total')
      .first()

    const applicableBase = parseFloat(`${baseAmountResult?.total || 0}`)

    // Compute new discount amount
    let discountAmount = 0
    if (discount.type === 'percentage') {
      discountAmount = applicableBase * (discount.value / 100)
    } else {
      discountAmount = Math.min(discount.value, applicableBase)
    }

    if (!discountAmount || discountAmount <= 0) {
      return response.badRequest({ message: 'No applicable charges found to apply discount' })
    }

    // Update transaction fields
    existingTx.merge({
      discountId: discount.id,
      particular: discount.name,
      description: payload.notes?.trim() || `${discount.name} (${discount.shortCode})`,
      amount: -Math.abs(discountAmount),
      totalAmount: -Math.abs(discountAmount),
      unitPrice: -Math.abs(discountAmount),
      discountAmount: Math.abs(discountAmount),
      netAmount: -Math.abs(discountAmount),
      grossAmount: -Math.abs(discountAmount),
      lastModifiedBy: auth.user?.id || 0,
      transactionDate: payload.transactionDate
        ? DateTime.fromJSDate(new Date(payload.transactionDate))
        : DateTime.now(),
    })

    await existingTx.save()

    // --- Recompute folio totals ---
    const transactions = await FolioTransaction.query()
      .where('folioId', folio.id)
      .where('isVoided', false)

    let totalCharges = 0
    let totalPayments = 0
    let totalAdjustments = 0
    let totalTaxes = 0
    let totalServiceCharges = 0
    let totalDiscounts = 0

    for (const tx of transactions) {
      switch (tx.transactionType) {
        case TransactionType.CHARGE:
          totalCharges += parseFloat(`${tx.amount ?? 0}`)
          break
        case TransactionType.PAYMENT:
          totalPayments += Math.abs(parseFloat(`${tx.amount ?? 0}`))
          break
        case TransactionType.ADJUSTMENT:
          totalAdjustments += parseFloat(`${tx.amount ?? 0}`)
          break
      }
      totalTaxes += parseFloat(`${tx.taxAmount ?? 0}`) || 0
      totalServiceCharges += parseFloat(`${tx.serviceChargeAmount ?? 0}`) || 0
      totalDiscounts += parseFloat(`${tx.discountAmount ?? 0}`) || 0
    }

    folio.merge({
      totalCharges,
      totalPayments,
      totalAdjustments,
      totalTaxes,
      totalServiceCharges,
      totalDiscounts,
      balance:
        totalCharges +
        totalAdjustments +
        totalTaxes +
        totalServiceCharges -
        totalPayments -
        totalDiscounts,
      lastModifiedBy: auth.user?.id || 0,
    })
    await folio.save()

    // Logging
    await LoggerService.log({
      actorId: auth.user?.id || 0,
      action: 'UPDATE',
      entityType: 'FolioTransaction',
      entityId: existingTx.id,
      hotelId: folio.hotelId,
      description: `Updated discount "${discount.name}" on folio ${folio.folioNumber}`,
      changes: LoggerService.extractChanges({}, existingTx.toJSON()),
      ctx,
    })

    await existingTx.load('hotel')
    await existingTx.load('folio')

    return response.ok({
      message: 'Discount updated successfully',
      data: existingTx,
    })
  } catch (error) {
    logger.error(error)
    return response.badRequest({ message: error.message })
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
   * Split folio by transferring specified transactions
   */
  async split({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(splitFolioValidator)

      const result = await FolioService.splitFolio({
        ...payload,
        splitBy: auth.user!.id
      })

      return response.ok({
        message: 'Folio split completed successfully',
        data: {
          sourceFolio: {
            id: result.sourceFolio.id,
            folioNumber: result.sourceFolio.folioNumber,
            balance: result.sourceFolio.balance
          },
          destinationFolio: {
            id: result.destinationFolio.id,
            folioNumber: result.destinationFolio.folioNumber,
            balance: result.destinationFolio.balance
          },
          transferredTransactions: result.transferredTransactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: t.amount,
            transactionType: t.transactionType
          }))
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to split folio',
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
   * Get unsettled folios
   */
  async unsettled({ request, response }: HttpContext) {
    try {
      const {
        hotelId,
        search,
        startDate,
        endDate,
        status
      } = request.only([
        'hotelId',
        'search',
        'startDate',
        'endDate',
        'status'
      ])

      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const query = Folio.query()
        .where('balance', '>', 0)
        .where('status', 'open')

      if (hotelId) {
        query.where('hotel_id', hotelId)
      }

      // Filter by search term (folio number, reservation number, guest name, or room number)
      if (search) {
        query.where((searchQuery) => {
          // Search in folio number
          searchQuery.where('folio_number', 'LIKE', `%${search}%`)

            // Search in reservation number or confirmation code
            .orWhereHas('reservation', (reservationQuery) => {
              reservationQuery.where('reservation_number', 'LIKE', `%${search}%`)
                .orWhere('confirmation_code', 'LIKE', `%${search}%`)
            })

            // Search in guest name
            .orWhereHas('guest', (guestQuery) => {
              guestQuery.whereRaw("CONCAT(first_name, ' ', last_name) LIKE ?", [`%${search}%`])
                .orWhere('first_name', 'LIKE', `%${search}%`)
                .orWhere('last_name', 'LIKE', `%${search}%`)
            })

            // Search in room number
            .orWhereHas('reservationRoom', (roomQuery) => {
              roomQuery.whereHas('room', (actualRoomQuery) => {
                actualRoomQuery.where('room_number', 'LIKE', `%${search}%`)
              })
            })
        })
      }

      // Exclude reservations that are confirmed or pending
      query.whereHas('reservation', (reservationQuery) => {
        reservationQuery.whereNotIn('status', [ReservationStatus.CONFIRMED, ReservationStatus.PENDING])
      })

      // Filter by date range (arrival/departure dates)
      if (startDate || endDate) {
        query.whereHas('reservation', (reservationQuery) => {
          if (startDate) {
            reservationQuery.where('scheduled_arrival_date', '>=', startDate)
          }
          if (endDate) {
            reservationQuery.where('scheduled_departure_date', '<=', endDate)
          }
        })
      }

      // Filter by reservation status
      if (status) {
        query.whereHas('reservation', (reservationQuery) => {
          switch (status.toLowerCase()) {
            case 'checkout':
              reservationQuery.where('status', ReservationStatus.CHECKED_OUT)
              break
            case 'inhouse':
              reservationQuery.where('status', ReservationStatus.CHECKED_IN)
              break
            case 'noshow':
              reservationQuery.where('status', ReservationStatus.NOSHOW)
              break
            case 'cancelled':
              reservationQuery.where('status', ReservationStatus.CANCELLED)
              break
            default:
              // If status doesn't match expected values, don't filter
              break
          }
        })
      }

      const unsettledFolios = await query
        .preload('guest')
        .preload('reservation', (reservationQuery) => {
          reservationQuery.whereNotNull('id')
        })
        .preload('reservationRoom', (roomQuery) => {
          roomQuery.preload('room')
        })
        .preload('transactions', (transactionQuery) => {
          transactionQuery.where('is_voided', false).orderBy('transaction_date', 'desc')
        })
        .orderBy('balance', 'desc')
        .paginate(page, limit)

      // Format the response data according to requirements
      const formattedData = {
        ...unsettledFolios.toJSON(),
        data: unsettledFolios.toJSON().data?.map((folio) => {
          const reservation = folio.reservation
          const guest = folio.guest
          const reservationRoom = folio.reservationRoom

          // Determine status based on reservation status
          let displayStatus = reservation.status
          if (reservation) {
            switch (reservation.status) {
              case ReservationStatus.CHECKED_OUT:
                displayStatus = 'checkout'
                break
              case ReservationStatus.CHECKED_IN:
                displayStatus = 'inhouse'
                break
              case 'checked_in':
                displayStatus = 'inhouse'
                break
              case ReservationStatus.NOSHOW:
                displayStatus = 'noshow'
                break
              case ReservationStatus.CANCELLED:
                displayStatus = 'cancelled'
                break
            }
          }

          return {
            folioNumber: folio.folioNumber,
            id: folio.id,
            reservationNumber: reservation?.reservationNumber || reservation?.confirmationCode || 'N/A',
            guestName: guest ? `${guest.displayName}`.trim() : 'N/A',
            arrival: reservation?.arrivedDate?.toFormat('yyyy-MM-dd') || 'N/A',
            departure: reservation?.departDate?.toFormat('yyyy-MM-dd') || 'N/A',
            status: displayStatus,
            balance: folio.balance,
            roomNumber: reservationRoom?.room?.roomNumber || 'N/A',
            reservationId: reservation?.id,
          }
        })
      }

      return response.ok({
        message: 'Unsettled folios retrieved successfully',
        data: formattedData
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve unsettled folios',
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

  /**
   * Post a transaction to a folio
   */
  async postTransaction({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(postTransactionValidator)

      const transaction = await FolioService.postTransaction({
        ...payload,
        postedBy: auth.user!.id
      })

      return response.created({
        message: 'Transaction posted successfully',
        data: transaction
      })
    } catch (error) {
      // Return field-level validation errors when schema fails
      const messages = (error as any)?.messages
      if (Array.isArray(messages)) {
        const errors: Record<string, string[]> = {}
        const fields: string[] = []
        for (const m of messages) {
          const field = m.field || 'unknown'
          if (!errors[field]) errors[field] = []
          errors[field].push(m.message)
          fields.push(field)
        }
        return response.status(422).send({
          message: 'Validation failed',
          errors,
          fields: Array.from(new Set(fields)),
          details: messages.map((m: any) => ({ field: m.field, message: m.message, rule: m.rule }))
        })
      }
      return response.badRequest({ message: (error as any)?.message || 'Failed to post transaction' })
    }
  }

  /**
   * update folio
   */
 async updateTransaction({ request, response, auth, params }: HttpContext) {
  try {

    const payload = await request.validateUsing(updateTransactionValidator)

    const transactionId = Number(params.id)
    if (!transactionId) {
      return response.badRequest({ message: 'Transaction ID is required' })
    }

    const transaction = await FolioService.updateTransaction(transactionId, {
      ...payload,
    }, auth.user!.id)

    return response.ok({
      message: 'Transaction updated successfully',
      data: transaction,
    })
  } catch (error) {
    console.error('Error updating transaction:', error)
    return response.badRequest({
      message: error.message || 'Failed to update transaction',
    })
  }
}


  /**
   * Settle a folio (process payment)
   */
  async settle({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(settleFolioValidator)

      const result = await FolioService.settleFolio({
        ...payload,
        settledBy: auth.user!.id
      })

      return response.ok({
        message: 'Folio settled successfully',
        data: result
      })
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * Transfer charges between folios
   */
  async transferCharges({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(transferChargesValidator)

      const result = await FolioService.transferCharges({
        ...payload,
        transferredBy: auth.user!.id
      })

      return response.ok({
        message: 'Charges transferred successfully',
        data: result
      })
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * Get folio statement with all transactions
   */
  async statementWithService({ params, response }: HttpContext) {
    try {
      const folio = await FolioService.getFolioStatement(params.id)

      return response.ok({
        message: 'Folio statement retrieved successfully',
        data: folio
      })
    } catch (error) {
      return response.notFound({ message: 'Folio not found' })
    }
  }

  /**
   * Close a folio using the service
   */
  async closeWithService({ params, response, auth }: HttpContext) {
    try {
      const folio = await FolioService.closeFolio(params.id, auth.user!.id)

      return response.ok({
        message: 'Folio closed successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * Reopen a folio using the service
   */
  async reopenWithService({ params, response, auth }: HttpContext) {
    try {
      const folio = await FolioService.reopenFolio(params.id, auth.user!.id)

      return response.ok({
        message: 'Folio reopened successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({ message: error.message })
    }
  }

  /**
   * Create folio for reservation
   */
  async createForReservation({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createReservationFolioValidator)
      const folio = await ReservationFolioService.createFolioForReservation(payload)

      return response.created({
        message: 'Folio created successfully for reservation',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create folio for reservation',
        error: error.message
      })
    }
  }

  /**
   * Create folio for walk-in guest
   */
  async createForWalkIn({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createWalkInFolioValidator)
      const folio = await ReservationFolioService.createFolioForWalkIn(payload)

      return response.created({
        message: 'Folio created successfully for walk-in guest',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create folio for walk-in guest',
        error: error.message
      })
    }
  }

  /**
   * Create multiple folios for group reservation
   */
  async createForGroup({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createGroupFoliosValidator)
      const folios = await ReservationFolioService.createFoliosForGroup(
        payload.reservationId,
        payload.guestIds,
        payload.createdBy
      )

      return response.created({
        message: 'Folios created successfully for group reservation',
        data: folios
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to create folios for group reservation',
        error: error.message
      })
    }
  }

  /**
   * Auto-post room charges for reservation
   */
  async postRoomCharges({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(postRoomChargesValidator)
      await ReservationFolioService.postRoomCharges(payload.reservationId, payload.postedBy)

      return response.ok({
        message: 'Room charges posted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to post room charges',
        error: error.message
      })
    }
  }

  /**
   * Auto-post taxes and fees for reservation
   */
  async postTaxesAndFees({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(postTaxesAndFeesValidator)
      await ReservationFolioService.postTaxesAndFees(payload.reservationId, payload.postedBy)

      return response.ok({
        message: 'Taxes and fees posted successfully'
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to post taxes and fees',
        error: error.message
      })
    }
  }

  /**
   * Get all folios for a reservation
   */
  async getReservationFolios({ params, response }: HttpContext) {
    try {
      const folios = await ReservationFolioService.getFoliosForReservation(params.reservationId)

      return response.ok({
        message: 'Reservation folios retrieved successfully',
        data: folios
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve reservation folios',
        error: error.message
      })
    }
  }

  /**
   * Get settlement summary for checkout
   */
  async getSettlementSummary({ params, response }: HttpContext) {
    try {
      const summary = await CheckoutService.getSettlementSummary(params.id)

      return response.ok({
        message: 'Settlement summary retrieved successfully',
        data: summary
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve settlement summary',
        error: error.message
      })
    }
  }

  /**
   * Get checkout summary
   */
  async getCheckoutSummary({ params, response }: HttpContext) {
    try {
      const summary = await CheckoutService.getCheckoutSummary(params.id)

      return response.ok({
        message: 'Checkout summary retrieved successfully',
        data: summary
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve checkout summary',
        error: error.message
      })
    }
  }

  /**
   * Process checkout for a folio
   */
  async processCheckout({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(checkoutValidator)
      const result = await CheckoutService.processCheckout(payload)

      return response.ok({
        message: result.message,
        data: result
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to process checkout',
        error: error.message
      })
    }
  }

  /**
   * Process checkout for entire reservation
   */
  async processReservationCheckout({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(reservationCheckoutValidator)
      const results = await CheckoutService.processReservationCheckout(
        payload.reservationId,
        payload.payments,
        payload.processedBy
      )

      return response.ok({
        message: 'Reservation checkout processed successfully',
        data: results
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to process reservation checkout',
        error: error.message
      })
    }
  }

  /**
   * Force close folio with outstanding balance
   */
  async forceCloseFolio({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(forceCloseValidator)
      const folio = await CheckoutService.forceCloseFolio(
        payload.folioId,
        payload.reason,
        payload.authorizedBy,
        payload.processedBy
      )

      return response.ok({
        message: 'Folio force closed successfully',
        data: folio
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to force close folio',
        error: error.message
      })
    }
  }

  /**
   * Validate checkout eligibility
   */
  async validateCheckout({ params, response }: HttpContext) {
    try {
      const validation = await CheckoutService.validateCheckoutEligibility(params.id)

      return response.ok({
        message: 'Checkout validation completed',
        data: validation
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to validate checkout eligibility',
        error: error.message
      })
    }
  }

  /**
   * Get guest folio view (limited information)
   */
  async getGuestView({ params, request, response }: HttpContext) {
    try {
      const guestId = request.input('guestId')
      if (!guestId) {
        return response.badRequest({
          message: 'Guest ID is required'
        })
      }

      const folioView = await FolioInquiryService.getGuestFolioView(params.id, guestId)

      return response.ok({
        message: 'Guest folio view retrieved successfully',
        data: folioView
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve guest folio view',
        error: error.message
      })
    }
  }

  /**
   * Get staff folio view (comprehensive information)
   */
  async getStaffView({ params, response }: HttpContext) {
    try {
      const folioView = await FolioInquiryService.getStaffFolioView(params.id)

      return response.ok({
        message: 'Staff folio view retrieved successfully',
        data: folioView
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve staff folio view',
        error: error.message
      })
    }
  }

  /**
   * Search folios with advanced filters
   */
  async search({ request, response }: HttpContext) {
    try {
      const filters = request.only([
        'hotelId', 'guestId', 'reservationId', 'folioNumber', 'folioType',
        'status', 'settlementStatus', 'workflowStatus', 'dateFrom', 'dateTo',
        'balanceMin', 'balanceMax', 'createdBy', 'hasOutstandingBalance'
      ])

      const page = request.input('page', 1)
      const limit = request.input('limit', 20)

      const result = await FolioInquiryService.searchFolios(filters, page, limit)

      return response.ok({
        message: 'Folios retrieved successfully',
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to search folios',
        error: error.message
      })
    }
  }

  /**
   * Comprehensive folio search with text search across multiple fields
   */
  async comprehensiveSearch({ request, response }: HttpContext) {
    try {
      // Validate required parameters
      const searchText = request.input('searchText')
      const inhouse = request.input('inhouse')
      const reservation = request.input('reservation')
      const hotelId = request.input('hotelId')

      // Validate hotelId is provided
      if (!hotelId) {
        return response.badRequest({
          message: 'Hotel ID is required for folio search',
          error: 'Missing required parameter: hotelId'
        })
      }

      // Parse boolean parameters
      let inhouseFilter: boolean | undefined
      let reservationFilter: boolean | undefined

      if (inhouse !== undefined && inhouse !== null && inhouse !== '') {
        if (inhouse === 'true' || inhouse === true) {
          inhouseFilter = true
        } else if (inhouse === 'false' || inhouse === false) {
          inhouseFilter = false
        } else {
          return response.badRequest({
            message: 'Invalid inhouse parameter. Must be true or false',
            error: 'Invalid parameter value'
          })
        }
      }

      if (reservation !== undefined && reservation !== null && reservation !== '') {
        if (reservation === 'true' || reservation === true) {
          reservationFilter = true
        } else if (reservation === 'false' || reservation === false) {
          reservationFilter = false
        } else {
          return response.badRequest({
            message: 'Invalid reservation parameter. Must be true or false',
            error: 'Invalid parameter value'
          })
        }
      }

      // Build filters object
      const filters = {
        searchText: searchText || undefined,
        inhouse: inhouseFilter,
        reservation: reservationFilter,
        hotelId: parseInt(hotelId),
        dateFrom: request.input('dateFrom') ? new Date(request.input('dateFrom')) : undefined,
        dateTo: request.input('dateTo') ? new Date(request.input('dateTo')) : undefined,
        folioType: request.input('folioType') || undefined,
        status: request.input('status') || undefined
      }

      // Validate hotelId is a valid number
      if (isNaN(filters.hotelId)) {
        return response.badRequest({
          message: 'Invalid hotel ID. Must be a valid number',
          error: 'Invalid parameter value'
        })
      }

      // Get pagination parameters
      const page = Math.max(1, parseInt(request.input('page', '1')))
      const limit = Math.min(100, Math.max(1, parseInt(request.input('limit', '20'))))

      // Perform search
      const result = await FolioInquiryService.comprehensiveFolioSearch(filters, page, limit)

      return response.ok({
        message: 'Folio search completed successfully',
        data: result.data,
        pagination: result.pagination,
        searchCriteria: {
          searchText: filters.searchText,
          inhouse: filters.inhouse,
          reservation: filters.reservation,
          hotelId: filters.hotelId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          folioType: filters.folioType,
          status: filters.status
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to perform comprehensive folio search',
        error: error.message
      })
    }
  }

  /**
   * Search transactions with filters
   */
  async searchTransactions({ request, response }: HttpContext) {
    try {
      const filters = request.only([
        'folioId', 'transactionType', 'category', 'dateFrom', 'dateTo',
        'amountMin', 'amountMax', 'postedBy', 'departmentId', 'isVoided'
      ])

      const page = request.input('page', 1)
      const limit = request.input('limit', 50)

      const result = await FolioInquiryService.searchTransactions(filters, page, limit)

      return response.ok({
        message: 'Transactions retrieved successfully',
        data: result.data,
        pagination: result.pagination
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to search transactions',
        error: error.message
      })
    }
  }

  /**
   * Get folio activity timeline
   */
  async getTimeline({ params, response }: HttpContext) {
    try {
      const timeline = await FolioInquiryService.getFolioTimeline(params.id)

      return response.ok({
        message: 'Folio timeline retrieved successfully',
        data: timeline
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve folio timeline',
        error: error.message
      })
    }
  }

  /**
   * Get folio statistics
   */
  async getStatistics({ request, response }: HttpContext) {
    try {
      const filters = request.only([
        'hotelId', 'dateFrom', 'dateTo', 'folioType', 'status'
      ])

      const statistics = await FolioInquiryService.getFolioStatistics(filters)

      return response.ok({
        message: 'Folio statistics retrieved successfully',
        data: statistics
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to retrieve folio statistics',
        error: error.message
      })
    }
  }

  /**
    * Split folio by transaction type
    */
  async splitByType({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(splitFolioByTypeValidator)

      const result = await FolioService.splitFolioByType({
        ...payload,
        splitBy: auth.user!.id
      })

      return response.ok({
        message: 'Folio split by type completed successfully',
        data: {
          originalFolio: {
            id: result.originalFolio.id,
            folioNumber: result.originalFolio.folioNumber,
            balance: result.originalFolio.balance
          },
          newFolios: result.newFolios.map(folio => ({
            id: folio.id,
            folioNumber: folio.folioNumber,
            folioName: folio.folioName,
            balance: folio.balance
          })),
          transferredTransactions: result.transferredTransactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: t.amount,
            transactionType: t.transactionType,
            category: t.category
          }))
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to split folio by type',
        error: error.message
      })
    }
  }

  /**
   * Add room charge to folio
   */
  async addRoomCharge({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(addRoomChargeValidator)

      const transaction = await FolioService.addRoomChargeMethod({
        ...payload,
        postedBy: auth.user!.id
      })

      return response.created({
        message: 'Room charge added successfully',
        data: {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          description: transaction.description,
          amount: transaction.amount,
          chargeSubtype: transaction.subcategory,
          complementary: transaction.complementary,
          transactionDate: transaction.transactionDate,
          folioId: transaction.folioId
        }
      })
    } catch (error) {
      // Handle validation errors specifically
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages,
          details: 'Please check the following validation errors and correct the input data'
        })
      }

      return response.badRequest({
        success: false,
        message: 'Failed to add room charge',
        error: error.message
      })
    }
  }

   /**
   * Update room charge to folio
   */
async updateRoomCharge({ request, response, auth }: HttpContext) {
  try {
     const transactionId = request.param('id')
    const payload = await request.validateUsing(updateRoomChargeValidator)

    const transaction = await FolioService.updateRoomChargeMethod(transactionId, {
      ...payload,
      postedBy: auth.user!.id
    })

    return response.ok({
      message: 'Room charge updated successfully',
      data: {
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        description: transaction.description,
        amount: transaction.amount,
        chargeSubtype: transaction.subcategory,
        complementary: transaction.complementary,
        transactionDate: transaction.transactionDate,
        folioId: transaction.folioId
      }
    })
  } catch (error) {
    if (error.code === 'E_VALIDATION_ERROR') {
      return response.badRequest({
        success: false,
        message: 'Validation failed',
        errors: error.messages,
        details: 'Please check the following validation errors and correct the input data'
      })
    }

    return response.badRequest({
      success: false,
      message: 'Failed to update room charge',
      error: error.message
    })
  }
}

  /**
   * Add folio adjustment
  */
  async addAdjustment({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(addFolioAdjustmentValidator)

      const transaction = await db.transaction(async (trx) => {
        const created = await FolioService.addFolioAdjustment({
          ...payload,
          postedBy: auth.user!.id
        }, trx)
        return created
      })

      return response.created({
        message: 'Folio adjustment added successfully',
        data: {
          id: transaction.id,
          transactionNumber: transaction.transactionNumber,
          description: transaction.description,
          particular: transaction.particular,
          amount: transaction.amount,
          type: payload.type,
          category: transaction.category,
          transactionDate: transaction.transactionDate,
          folioId: transaction.folioId
        }
      })
    } catch (error) {
      // Rollback occurs automatically on error; provide validation details if available
      if ((error as any)?.code === 'E_VALIDATION_ERROR') {
        const err: any = error
        const fields = Array.isArray(err.errors)
          ? err.errors.map((e: any) => ({ field: e.field, message: e.message, rule: e.rule }))
          : []

        return response.status(422).send({
          message: 'Validation failed',
          errors: typeof err.messages === 'function' ? err.messages() : err.messages,
          fields,
        })
      }

      return response.badRequest({
        message: 'Failed to add folio adjustment',
        error: (error as any)?.message
      })
    }
  }

  /**
   * update Adjustment Folio
   */

  async updateAdjustment({ request, response, auth }: HttpContext) {
  try {
    const transactionId = request.param('id')

    // Valider d'abord avec les données brutes
    const payload = await request.validateUsing(updateFolioAdjustmentValidator)


    // Convertir la date APRÈS la validation
    const dataForService:any = {
      type: payload.type,
      amount: payload.amount,
      comment: payload.comment,
      date: payload.date,
      postedBy: auth.user!.id,
    }

    const transaction = await FolioService.updateFolioAdjustment(
      transactionId,
      dataForService
    )

    return response.ok({
      message: 'Folio adjustment updated successfully',
      data: {
        id: transaction.id,
        transactionNumber: transaction.transactionNumber,
        description: transaction.description,
        particular: transaction.particular,
        amount: transaction.amount,
        type: transaction.particular,
        category: transaction.category,
        transactionDate: transaction.transactionDate,
        folioId: transaction.folioId,
      }
    })
  } catch (error) {
    console.error('Error in updateAdjustment:', error)
    return response.badRequest({
      message: 'Failed to update folio adjustment',
      error: error.message
    })
  }
}



  /**
   * Cut folio by creating a new folio and transferring transactions based on type flags
   */
  async cut({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(cutFolioValidator)

      const result = await FolioService.cutFolio({
        ...payload,
        cutBy: auth.user!.id
      })

      return response.ok({
        message: 'Folio cut completed successfully',
        data: {
          originalFolio: {
            id: result.originalFolio.id,
            folioNumber: result.originalFolio.folioNumber,
            folioName: result.originalFolio.folioName,
            balance: result.originalFolio.balance
          },
          newFolio: {
            id: result.newFolio.id,
            folioNumber: result.newFolio.folioNumber,
            folioName: result.newFolio.folioName,
            balance: result.newFolio.balance
          },
          transferredTransactions: result.transferredTransactions.map(t => ({
            id: t.id,
            description: t.description,
            amount: t.amount,
            transactionType: t.transactionType,
            category: t.category
          }))
        }
      })
    } catch (error) {
      return response.badRequest({
        message: 'Failed to cut folio',
        error: error.message
      })
    }
  }
}
