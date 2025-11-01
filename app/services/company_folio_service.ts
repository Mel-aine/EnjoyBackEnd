import { DateTime } from 'luxon'
import Folio from '#app/models/folio'
import FolioTransaction from '#app/models/folio_transaction'
import CompanyAccount from '#app/models/company_account'
import PaymentMethod from '#app/models/payment_method'
import { FolioType, FolioStatus, SettlementStatus, WorkflowStatus, TransactionType, TransactionCategory, PaymentMethodType, TransactionStatus } from '#app/enums'
import Database from '@adonisjs/lucid/services/db'
import LoggerService from '#app/services/logger_service'
import type { HttpContext } from '@adonisjs/core/http'
import { generateTransactionCode } from '../utils/generate_guest_code.js'
import FolioService from './folio_service.js'
import logger from '@adonisjs/core/services/logger'

export interface CompanyPaymentData {
  companyId: number
  hotelId: number
  amount: number
  description: string
  reference?: string
  voucher?: string
  paymentMethodId?: number
  postedBy: number
  postingDate?: DateTime
  transactionDate?: DateTime
  ctx?: HttpContext
}

export interface PaymentAssignmentData {
  transactionId: number
  assignedAmount: number
  assignedBy: number
  assignmentDate?: DateTime
  notes?: string
  ctx?: HttpContext
}

export interface BulkAssignmentMapping {
  transactionId: number
  newAssignedAmount: number
}

export interface BulkPaymentAssignmentData {
  mappings: BulkAssignmentMapping[]
  assignedBy: number
  assignmentDate?: DateTime
  notes?: string
  paymentTransactionId?: number
  ctx?: HttpContext
}

export interface CompanyPaymentWithAssignmentData {
  companyId: number
  hotelId: number
  amount: number
  description: string
  reference?: string
  voucher?: string
  paymentMethodId?: number
  postedBy: number
  postingDate?: DateTime
  transactionDate?: DateTime
  transactionId?: number
  // Assignment data
  mappings: BulkAssignmentMapping[]
  assignedBy: number
  assignmentDate?: DateTime
  notes?: string
  ctx?: HttpContext
}

export default class CompanyFolioService {
  /**
   * Get or create a folio for a company account
   */
  public async getOrCreateCompanyFolio(companyId: number, hotelId: number, userId?: number): Promise<Folio> {
    // Check if company folio already exists
    let folio = await Folio.query()
      .where('companyId', companyId)
      .where('hotelId', hotelId)
      .first()

    if (folio) {
      return folio
    }

    // Get company account details
    const company = await CompanyAccount.findOrFail(companyId)

    // Generate folio number
    const folioNumber = await this.generateCompanyFolioNumber(hotelId)

    // Create new company folio
    folio = await Folio.create({
      hotelId,
      companyId,
      folioNumber,
      folioName: `Company Folio - ${company.companyName}`,
      folioType: FolioType.COMPANY,
      status: FolioStatus.OPEN,
      settlementStatus: SettlementStatus.PENDING,
      workflowStatus: WorkflowStatus.ACTIVE,
      openedDate: DateTime.now(),
      openedBy: userId || 1, // Use authenticated user or fallback to system user
      balance: 0,
      creditLimit: company.creditLimit || 0,
      currencyCode: 'XAF', // Should be configurable
      exchangeRate: 1,
      //  baseCurrencyAmount: 0,
      createdBy: userId || 1, // Use authenticated user or fallback to system user
      lastModifiedBy: userId || 1,
    })

    return folio
  }

  /**
   * Post a payment transaction to a company folio
   */
  public async postCompanyPayment(paymentData: CompanyPaymentData): Promise<FolioTransaction> {
    const trx = await Database.transaction()

    try {
      // Get or create company folio
      const folio = await this.getOrCreateCompanyFolio(paymentData.companyId, paymentData.hotelId, paymentData.postedBy)

      // Get city ledger payment method if not specified
      let paymentMethodId = paymentData.paymentMethodId
      if (!paymentMethodId) {
        const cityLedgerPaymentMethod = await this.getCityLedgerPaymentMethod(
          paymentData.companyId,
          paymentData.hotelId
        )
        paymentMethodId = cityLedgerPaymentMethod?.id
      }

      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(paymentData.hotelId)
      const transactionCode = generateTransactionCode('TXN');

      // Create payment transaction
      const transaction = await FolioTransaction.create(
        {
          hotelId: paymentData.hotelId,
          folioId: folio.id,
          transactionNumber,
          transactionCode,
          transactionType: TransactionType.PAYMENT,
          category: TransactionCategory.PAYMENT,
          description: paymentData.description,
          totalAmount: Math.abs(paymentData.amount),
          amount: Math.abs(paymentData.amount), // Ensure positive amount for payments
          postingDate: paymentData.postingDate || DateTime.now(),
          transactionDate: paymentData.transactionDate || DateTime.now(),
          paymentMethodId,
          reference: paymentData.reference,
          voucher: paymentData.voucher,
          // postedBy: paymentData.postedBy,
          isVoided: false,
          assignedAmount: 0, // Initially unassigned
          unassignedAmount: Math.abs(paymentData.amount),
          createdBy: paymentData.postedBy,
          lastModifiedBy: paymentData.postedBy,
        },
        { client: trx }
      )

      // Recalculate folio totals and set transaction running balance
      await FolioService.updateFolioTotals(folio.id, trx)
      const updatedFolio = await Folio.query({ client: trx }).where('id', folio.id).first()
      if (updatedFolio) {
        await FolioTransaction.query({ client: trx })
          .where('id', transaction.id)
          .update({ balance: updatedFolio.balance })
      }

      // Log payment creation
      if (paymentData.ctx) {
        await LoggerService.log({
          actorId: paymentData.postedBy,
          action: 'CREATE',
          entityType: 'FolioTransaction',
          entityId: transaction.id,
          description: `Created payment transaction: ${paymentData.description}`,
          meta: {
            amount: paymentData.amount,
            companyId: paymentData.companyId,
            folioId: folio.id,
            paymentMethodId,
            reference: paymentData.reference,
            voucher: paymentData.voucher
          },
          hotelId: paymentData.hotelId,
          ctx: paymentData.ctx
        })
      }

      await trx.commit()
      return transaction
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Post a payment transaction with automatic bulk assignment to a company folio
   */
  public async postCompanyPaymentWithAssignment(
    paymentData: CompanyPaymentWithAssignmentData
  ): Promise<FolioTransaction> {
    const trx = await Database.transaction()

    try {
      // Get or create company folio
      const folio = await this.getOrCreateCompanyFolio(paymentData.companyId, paymentData.hotelId, paymentData.postedBy)

      // Get city ledger payment method if not specified
      let paymentMethodId = paymentData.paymentMethodId
      if (!paymentMethodId) {
        const cityLedgerPaymentMethod = await this.getCityLedgerPaymentMethod(
          paymentData.companyId,
          paymentData.hotelId
        )
        paymentMethodId = cityLedgerPaymentMethod?.id
      }

      // Calculate total assigned amount from mappings
      const totalAssignedAmount = paymentData.mappings.reduce(
        (sum, mapping) => sum + mapping.newAssignedAmount,
        0
      )

      // Validate assignment amount
      const paymentAmount = Math.abs(paymentData.amount)
      if (totalAssignedAmount > paymentAmount) {
        throw new Error(
          `Cannot assign ${totalAssignedAmount}. Maximum assignable amount is ${paymentAmount}`
        )
      }

      // Generate transaction number
      const transactionNumber = await this.generateTransactionNumber(paymentData.hotelId)
      const transactionCode =  generateTransactionCode('TXN');

      // Create payment transaction
      const transaction = await FolioTransaction.create(
        {
          hotelId: paymentData.hotelId,
          folioId: folio.id,
          transactionNumber,
          transactionCode,
          transactionType: TransactionType.PAYMENT,
          category: TransactionCategory.PAYMENT,
          description: paymentData.description,
          amount: paymentAmount,
          totalAmount: Math.abs(paymentAmount),
          postingDate: paymentData.postingDate || DateTime.now(),
          transactionDate: paymentData.transactionDate || DateTime.now(),
          paymentMethodId,
          // reference: paymentData.reference,
          voucher: paymentData.voucher,
          //postedBy: paymentData.postedBy,
          isVoided: false,
          transactionTime: paymentData.transactionDate?.toFormat('HH:mm:ss')??'00:00:00',
          assignedAmount: totalAssignedAmount,
          unassignedAmount: paymentAmount - totalAssignedAmount,
          assignmentHistory: {},
          createdBy: paymentData.postedBy,
          lastModifiedBy: paymentData.postedBy,
        },
        { client: trx }
      )

      // Apply bulk assignments to existing transactions
      const assignmentDate = paymentData.assignmentDate || DateTime.now()
      const assignmentTimestamp = assignmentDate.toISO()

      for (const mapping of paymentData.mappings) {
        // Get the target transaction to assign to
        const targetTransaction = await FolioTransaction.findOrFail(mapping.transactionId)

        // Update the target transaction's assignment
        const currentAssignedAmount = targetTransaction.assignedAmount || 0
        const newAssignedAmount = mapping.newAssignedAmount
        const assignmentDifference = newAssignedAmount - currentAssignedAmount

        // Update assignment history
        const currentHistory = targetTransaction.assignmentHistory || {}
        currentHistory[assignmentTimestamp] = {
          assignedAmount: newAssignedAmount,
          assignedBy: paymentData.assignedBy,
          assignmentDate: assignmentDate,
          notes: paymentData.notes || `Bulk assignment from payment ${transaction.transactionNumber}`,
          autoAssigned: true,
          unassignedAmount :assignmentDifference,
          paymentTransactionId: transaction.id
        }

        await targetTransaction
          .merge({
            assignedAmount: newAssignedAmount,
            unassignedAmount: targetTransaction.amount - newAssignedAmount,
            assignmentHistory: currentHistory,
            lastModifiedBy: paymentData.assignedBy,
          })
          .useTransaction(trx)
          .save()
      }

      // Recalculate folio totals and set transaction running balance
      await FolioService.updateFolioTotals(folio.id, trx)
      const updatedFolio = await Folio.query({ client: trx }).where('id', folio.id).first()
      if (updatedFolio) {
        await FolioTransaction.query({ client: trx })
          .where('id', transaction.id)
          .update({ balance: updatedFolio.balance })
      }
      // Bulk logging for payment creation and assignments
      if (paymentData.ctx) {
        const logEntries = []

        // Log payment creation
        logEntries.push({
          actorId: paymentData.postedBy,
          action: 'CREATE',
          entityType: 'FolioTransaction',
          entityId: transaction.id,
          description: `Created payment transaction with bulk assignment: ${paymentData.description}`,
          meta: {
            amount: paymentData.amount,
            companyId: paymentData.companyId,
            folioId: folio.id,
            paymentMethodId,
            reference: paymentData.reference,
            voucher: paymentData.voucher,
            totalAssignedAmount,
            assignmentCount: paymentData.mappings.length
          },
          hotelId: paymentData.hotelId,
          ctx: paymentData.ctx
        })

        // Log each assignment update
        for (const mapping of paymentData.mappings) {
          logEntries.push({
            actorId: paymentData.assignedBy,
            action: 'UPDATE',
            entityType: 'FolioTransaction',
            entityId: mapping.transactionId,
            description: `Updated assignment via bulk payment: ${mapping.newAssignedAmount}`,
            meta: {
              newAssignedAmount: mapping.newAssignedAmount,
              paymentTransactionId: transaction.id,
              assignmentDate: assignmentDate.toISO(),
              notes: paymentData.notes,
              autoAssigned: true
            },
            hotelId: paymentData.hotelId,
            ctx: paymentData.ctx
          })
        }

        // Bulk log all entries
        await LoggerService.bulkLog(logEntries)
      }

      await trx.commit()
      return transaction
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Update payment assignment for a transaction
   */
  public async updatePaymentAssignment(
    assignmentData: PaymentAssignmentData
  ): Promise<FolioTransaction> {
    const transaction = await FolioTransaction.findOrFail(assignmentData.transactionId)

    // Validate assignment amount
    const maxAssignable = transaction.amount - transaction.assignedAmount
    if (assignmentData.assignedAmount > maxAssignable) {
      throw new Error(
        `Cannot assign ${assignmentData.assignedAmount}. Maximum assignable amount is ${maxAssignable}`
      )
    }

    // Update assignment amounts
    const newAssignedAmount = transaction.assignedAmount + assignmentData.assignedAmount
    const newUnassignedAmount = transaction.amount - newAssignedAmount

    await transaction.merge({
      assignedAmount: newAssignedAmount,
      unassignedAmount: newUnassignedAmount,
      lastModifiedBy: assignmentData.assignedBy,
      assignmentHistory: {
        ...transaction.assignmentHistory,
        [DateTime.now().toISO()]: {
          assignedAmount: assignmentData.assignedAmount,
          assignedBy: assignmentData.assignedBy,
          assignmentDate: assignmentData.assignmentDate || DateTime.now(),
          notes: assignmentData.notes,
        },
      },
    }).save()

    // Log assignment update
    if (assignmentData.ctx) {
      await LoggerService.log({
        actorId: assignmentData.assignedBy,
        action: 'UPDATE',
        entityType: 'FolioTransaction',
        entityId: transaction.id,
        description: `Updated payment assignment: ${assignmentData.assignedAmount}`,
        changes: LoggerService.extractChanges(
          { assignedAmount: transaction.assignedAmount - assignmentData.assignedAmount, unassignedAmount: transaction.unassignedAmount + assignmentData.assignedAmount },
          { assignedAmount: newAssignedAmount, unassignedAmount: newUnassignedAmount }
        ),
        meta: {
          assignedAmount: assignmentData.assignedAmount,
          newTotalAssigned: newAssignedAmount,
          remainingUnassigned: newUnassignedAmount,
          notes: assignmentData.notes
        },
        hotelId: transaction.hotelId,
        ctx: assignmentData.ctx
      })
    }

    return transaction
  }

  /**
   * Update multiple payment assignments atomically
   */
  public async updateBulkPaymentAssignments(
    bulkAssignmentData: CompanyPaymentWithAssignmentData
  ): Promise<FolioTransaction[]> {
    const trx = await Database.transaction()

    try {
      const updatedTransactions: FolioTransaction[] = []
      const assignmentDate = bulkAssignmentData.assignmentDate || DateTime.now()
      const assignmentTimestamp = assignmentDate.toISO()

      // Optional: load payment transaction to reference transaction number and update its totals later
      let paymentTransaction: FolioTransaction | null = null
      if (bulkAssignmentData.transactionId) {
        paymentTransaction = await FolioTransaction.findOrFail(bulkAssignmentData.transactionId, { client: trx })
      }

      // Validate and process each mapping
      for (const mapping of bulkAssignmentData.mappings) {
        const transaction = await FolioTransaction.findOrFail(mapping.transactionId, { client: trx })

        // Validate that the new assigned amount doesn't exceed the transaction amount
        if (mapping.newAssignedAmount > Math.abs(transaction.unassignedAmount)) {
          throw new Error(
            `Cannot assign ${mapping.newAssignedAmount} to transaction ${mapping.transactionId}. Maximum assignable amount is ${Math.abs(transaction.amount)}`
          )
        }

        // Calculate assignment difference relative to current assigned
        const currentAssignedAmount = transaction.assignedAmount || 0
        const newAssignedAmount = mapping.newAssignedAmount
        const assignmentTotal = Math.abs(Number(newAssignedAmount)) + currentAssignedAmount

        // Calculate new unassigned amount based on new assignment value
        const newUnassignedAmount = Math.abs(transaction.unassignedAmount) - newAssignedAmount

        // Update the transaction with new assignment values and history
        await transaction.useTransaction(trx).merge({
          assignedAmount: assignmentTotal,
          unassignedAmount: newUnassignedAmount,
          lastModifiedBy: bulkAssignmentData.assignedBy,
          assignmentHistory: {
            ...transaction.assignmentHistory,
            [assignmentTimestamp]: {
              assignedAmount: newAssignedAmount,
              assignedBy: bulkAssignmentData.assignedBy,
              assignmentDate: assignmentDate,
              notes: bulkAssignmentData.notes || (paymentTransaction ? `Bulk assignment from payment ${paymentTransaction.transactionNumber}` : 'Bulk assignment update'),
              autoAssigned: Boolean(paymentTransaction),
              unassignedAmount: newUnassignedAmount,
              paymentTransactionId: paymentTransaction?.id
            },
          },
        }).save()

        updatedTransactions.push(transaction)
      }

      // If a payment transaction is provided, update its assigned/unassigned totals to reflect mappings
      logger.info(paymentTransaction)
      if (paymentTransaction) {
        const totalAssignedAmount = bulkAssignmentData.mappings.reduce(
          (sum, m) => sum + m.newAssignedAmount,
          0
        )

        const paymentNewAssigned = Number(paymentTransaction.assignedAmount) + totalAssignedAmount
        const paymentNewUnassigned = Math.abs(paymentTransaction.unassignedAmount) - totalAssignedAmount

        await paymentTransaction.useTransaction(trx).merge({
          assignedAmount: paymentNewAssigned,
          unassignedAmount: paymentNewUnassigned,
          lastModifiedBy: bulkAssignmentData.assignedBy,
          assignmentHistory: {
            ...paymentTransaction.assignmentHistory,
            [assignmentTimestamp]: {
              assignedAmount: paymentNewAssigned,
              assignedBy: bulkAssignmentData.assignedBy,
              assignmentDate: assignmentDate,
              notes: bulkAssignmentData.notes || 'Payment assignment totals updated from bulk mappings',
              bulkUpdate: true,
            },
          },
        }).save()
      }

      // Bulk logging for assignment updates
      if (bulkAssignmentData.ctx) {
        const logEntries = bulkAssignmentData.mappings.map((mapping, index) => {
          const transaction = updatedTransactions[index]
          return {
            actorId: bulkAssignmentData.assignedBy,
            action: 'UPDATE',
            entityType: 'FolioTransaction',
            entityId: mapping.transactionId,
            description: `Bulk assignment update: ${mapping.newAssignedAmount}`,
            changes: LoggerService.extractChanges(
              { assignedAmount: transaction.assignedAmount - mapping.newAssignedAmount, unassignedAmount: transaction.unassignedAmount + mapping.newAssignedAmount },
              { assignedAmount: mapping.newAssignedAmount, unassignedAmount: Math.abs(transaction.amount) - mapping.newAssignedAmount }
            ),
            meta: {
              previousAssignedAmount: transaction.assignedAmount,
              newAssignedAmount: mapping.newAssignedAmount,
              assignmentDate: assignmentDate.toISO(),
              notes: bulkAssignmentData.notes,
              autoAssigned: Boolean(paymentTransaction),
              paymentTransactionId: paymentTransaction?.id,
              bulkUpdate: true,
              batchSize: bulkAssignmentData.mappings.length
            },
            hotelId: transaction.hotelId,
            ctx: bulkAssignmentData.ctx
          }
        })

        // Add a log entry for the payment transaction total update
        if (paymentTransaction) {
          logEntries.push({
            actorId: bulkAssignmentData.assignedBy,
            action: 'UPDATE',
            entityType: 'FolioTransaction',
            entityId: paymentTransaction.id,
            description: `Updated payment assignment totals via bulk mappings: ${paymentTransaction.assignedAmount}`,
            meta: {
              newTotalAssigned: paymentTransaction.assignedAmount,
              remainingUnassigned: paymentTransaction.unassignedAmount,
              assignmentDate: assignmentDate.toISO(),
              batchSize: bulkAssignmentData.mappings.length
            },
            hotelId: paymentTransaction.hotelId,
            ctx: bulkAssignmentData.ctx
          })
        }

        await LoggerService.bulkLog(logEntries)
      }

      await trx.commit()
      return updatedTransactions

    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Void a company payment transaction and update subsequent balances and folio totals
   */
  public async voidCompanyPaymentTransaction(params: {
    transactionId: number
    voidedBy: number
    voidReason: string
    ctx?: HttpContext
  }): Promise<{ transaction: FolioTransaction; updatedCount: number; folio: Folio }>
  {
    const trx = await Database.transaction()

    try {
      const transaction = await FolioTransaction.findOrFail(params.transactionId, { client: trx })

      if (transaction.transactionType !== TransactionType.PAYMENT) {
        throw new Error('Only payment transactions can be voided via this route')
      }

      transaction.isVoided = true
      transaction.voidedAt = DateTime.now()
      transaction.voidedDate = DateTime.now()
      transaction.voidedBy = params.voidedBy
      transaction.voidReason = params.voidReason!
      transaction.status = TransactionStatus.VOIDED
      transaction.lastModifiedBy = params.voidedBy
      await transaction.useTransaction(trx).save()

      // Adjust balances of transactions created after the voided one
      const delta = Math.abs(transaction.totalAmount || transaction.amount || 0)
      const subsequentTransactions = await FolioTransaction.query({ client: trx })
        .where('folioId', transaction.folioId)
        .where('isVoided', false)
        .where('created_at', '>', transaction.createdAt?.toSQL()!)

      let updatedCount = 0
      for (const t of subsequentTransactions) {
        logger.info(t.balance)
        logger.info(t.totalAmount)
        const newBalance = Number((t.balance || 0)) + Number(delta)
        await t.merge({ balance: newBalance, lastModifiedBy: params.voidedBy }).useTransaction(trx).save()
        updatedCount++
      }

      // Recalculate folio totals after void
      await FolioService.updateFolioTotals(transaction.folioId, trx)
      const folio = await Folio.query({ client: trx }).where('id', transaction.folioId).firstOrFail()

      // Log void action
      if (params.ctx) {
        await LoggerService.log({
          actorId: params.voidedBy,
          action: 'VOID',
          entityType: 'FolioTransaction',
          entityId: transaction.id,
          description: 'Voided company payment transaction',
          meta: {
            deltaApplied: delta,
            subsequentUpdatedCount: updatedCount,
            folioId: transaction.folioId
          },
          hotelId: transaction.hotelId,
          ctx: params.ctx
        })
      }

      await trx.commit()
      return { transaction, updatedCount, folio }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Get city ledger payment method for a company
   */
  private async getCityLedgerPaymentMethod(
    companyId: number,
    hotelId: number
  ): Promise<PaymentMethod | null> {
    const company = await CompanyAccount.find(companyId)
    if (!company) return null

    return PaymentMethod.query()
      .where('hotelId', hotelId)
      .where('paymentMethodType', PaymentMethodType.CITY_LEDGER)
      .where('name', 'like', `%${company.companyName}%`)
      .where('isActive', true)
      .first()
  }

  /**
   * Generate folio number for company
   */
  private async generateCompanyFolioNumber(hotelId: number): Promise<string> {
    const lastFolio = await Folio.query()
      .where('hotelId', hotelId)
      .where('folioType', FolioType.COMPANY)
      .orderBy('id', 'desc')
      .first()

    const nextNumber = lastFolio ? parseInt(lastFolio.folioNumber.replace(/\D/g, '')) + 1 : 1
    return `CF${nextNumber.toString().padStart(6, '0')}`
  }

  /**
   * Generate transaction number
   */
  private async generateTransactionNumber(hotelId: number): Promise<number> {
    const lastTransaction = await FolioTransaction.query()
      .where('hotelId', hotelId)
      .orderBy('id', 'desc')
      .first()

    const nextNumber = lastTransaction
      ? (lastTransaction.transactionNumber || 0) + 1
      : 1
    return nextNumber
  }

  /**
   * Get company folio with transactions
   */
  public async getCompanyFolioWithTransactions(
    companyId: number,
    hotelId: number
  ): Promise<Folio | null> {
    return Folio.query()
      .where('companyId', companyId)
      .where('hotelId', hotelId)
      // .where('status', FolioStatus.OPEN)
      .preload('transactions', (query) => {
        query.orderBy('postingDate', 'desc')
      })
      .first()
  }

  /**
   * Get unassigned payment amount for a company
   */
  public async getUnassignedPaymentAmount(
    companyId: number,
    hotelId: number
  ): Promise<number> {
    const result = await Database.from('folio_transactions')
      .join('folios', 'folio_transactions.folio_id', 'folios.id')
      .where('folios.company_id', companyId)
      .where('folios.hotel_id', hotelId)
      .where('folio_transactions.transaction_type', TransactionType.PAYMENT)
      .where('folio_transactions.is_voided', false)
      .sum('folio_transactions.unassigned_amount as total')
      .first()

    return result?.total || 0
  }
}
