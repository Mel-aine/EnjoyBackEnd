import type { HttpContext } from '@adonisjs/core/http'
import CompanyFolioService from '#app/services/company_folio_service'
import { DateTime } from 'luxon'
import vine from '@vinejs/vine'
export default class CompanyFolioController {
  private companyFolioService = new CompanyFolioService()

  /**
   * Get company folio with transactions
   */
  public async show({ params, response }: HttpContext) {
    try {
      const { companyId, hotelId } = params
      
      const folio = await this.companyFolioService.getCompanyFolioWithTransactions(
        parseInt(companyId),
        parseInt(hotelId)
      )

      if (!folio) {
        return response.notFound({
          message: 'Company folio not found',
        })
      }

      return response.ok({
        success: true,
        data: folio,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve company folio',
        error: error.message,
      })
    }
  }

  /**
   * Post a payment to company folio
   */
  public async postPayment({ request, response }: HttpContext) {
    try {
      // Validate request data
      const validator = vine.compile(
        vine.object({
          companyId: vine.number().positive(),
          hotelId: vine.number().positive(),
          amount: vine.number().positive(),
          description: vine.string().minLength(1),
          reference: vine.string().optional().nullable(),
          voucher: vine.string().optional().nullable(),
          paymentMethodId: vine.number().positive().optional(),
          postedBy: vine.number().positive(),
          postingDate: vine.string().optional(),
          transactionDate: vine.string().optional(),
        })
      )

      const payload = await request.validateUsing(validator)

      // Convert dates if provided
      const paymentData = {
        ...payload,
        postingDate: payload.postingDate ? DateTime.fromISO(payload.postingDate) : undefined,
        transactionDate: payload.transactionDate ? DateTime.fromISO(payload.transactionDate) : undefined,
        ctx: { request, response } as HttpContext,
      }

      const transaction = await this.companyFolioService.postCompanyPayment(paymentData)

      return response.created({
        success: true,
        message: 'Payment posted successfully',
        data: {
          transactionId: transaction.id,
          transactionNumber: transaction.transactionNumber,
          amount: transaction.amount,
          folioId: transaction.folioId,
          assignedAmount: transaction.assignedAmount,
          unassignedAmount: transaction.unassignedAmount,
        },
      })
    } catch (error) {
      // Handle validation errors specifically
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failure',
          errors: error.messages,
          details: 'Please check the following validation errors:',
        })
      }

      return response.badRequest({
        success: false,
        message: 'Failed to post payment',
        error: error.message,
      })
    }
  }

  /**
   * Post payment with automatic assignment
   */
  public async postPaymentWithAssignment(ctx: HttpContext) {
  const  {request, auth, response} = ctx;
    try {
      // Validate request data
      const validator = vine.compile(
        vine.object({
          companyId: vine.number().positive(),
          hotelId: vine.number().positive(),
          amount: vine.number().positive(),
          description: vine.string().minLength(1),
          reference: vine.string().optional().nullable(),
          voucher: vine.string().optional().nullable(),
          paymentMethodId: vine.number().positive().optional(),
          //postedBy: vine.number().positive(),
          postingDate:vine.string().optional(),
          transactionDate: vine.string().optional(),
          mappings: vine.array(
            vine.object({
              transactionId: vine.number().positive(),
              newAssignedAmount: vine.number().min(0),
            })
          ).optional(),
          //assignedBy: vine.number().positive(),
          assignmentDate: vine.string().optional(),
          notes: vine.string().optional().nullable(),
        })
      )

      const payload = await request.validateUsing(validator)

      // Convert dates if provided
      const paymentData = {
        ...payload,
        postingDate: payload.postingDate ? DateTime.fromISO(payload.postingDate) : undefined,
        transactionDate: payload.transactionDate ? DateTime.fromISO(payload.transactionDate) : undefined,
        assignmentDate: payload.assignmentDate ? DateTime.fromISO(payload.assignmentDate) : undefined,
        postedBy:auth.user?.id,
        assignedBy:auth.user?.id,
        ctx: ctx,
      }

      const transaction = await this.companyFolioService.postCompanyPaymentWithAssignment(paymentData)

      return response.created({
        success: true,
        message: 'Payment posted with bulk assignment successfully',
        data: {
          transactionId: transaction.id,
          transactionNumber: transaction.transactionNumber,
          amount: transaction.amount,
          folioId: transaction.folioId,
          assignedAmount: transaction.assignedAmount,
          unassignedAmount: transaction.unassignedAmount,
          assignmentHistory: transaction.assignmentHistory,
          mappingsApplied: paymentData.mappings.length,
        },
      })
    } catch (error) {
      // Handle validation errors specifically
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failure',
          errors: error.messages,
          details: 'Please check the following validation errors:',
        })
      }

      return response.badRequest({
        success: false,
        message: 'Failed to post payment with bulk assignment',
        error: error.message,
      })
    }
  }

  /**
   * Update payment assignment
   */
  public async updateAssignment({ request, response }: HttpContext) {
    try {
      // Validate request data
      const validator = vine.compile(
        vine.object({
          transactionId: vine.number().positive(),
          assignedAmount: vine.number().positive(),
          assignedBy: vine.number().positive(),
          assignmentDate: vine.string().optional(),
          notes: vine.string().optional().nullable(),
        })
      )

      const payload = await request.validateUsing(validator)

      // Convert date if provided
      const assignmentData = {
        ...payload,
        assignmentDate: payload.assignmentDate ? DateTime.fromISO(payload.assignmentDate) : undefined,
        ctx: { request, response } as HttpContext,
      }

      const transaction = await this.companyFolioService.updatePaymentAssignment(assignmentData)

      return response.ok({
        success: true,
        message: 'Payment assignment updated successfully',
        data: {
          transactionId: transaction.id,
          assignedAmount: transaction.assignedAmount,
          unassignedAmount: transaction.unassignedAmount,
          assignmentHistory: transaction.assignmentHistory,
        },
      })
    } catch (error) {
      // Handle validation errors specifically
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failure',
          errors: error.messages,
          details: 'Please check the following validation errors:',
        })
      }

      return response.badRequest({
        success: false,
        message: 'Failed to update payment assignment',
        error: error.message,
      })
    }
  }

  /**
   * Update multiple payment assignments with mapping functionality
   */
  public async updateBulkAssignments({ request, response }: HttpContext) {
    try {
      // Validate request data
      const validator = vine.compile(
        vine.object({
          mappings: vine.array(
            vine.object({
              transactionId: vine.number().positive(),
              newAssignedAmount: vine.number().min(0),
            })
          ).minLength(1),
          assignedBy: vine.number().positive(),
          assignmentDate: vine.string().optional(),
          notes: vine.string().optional().nullable(),
        })
      )

      const payload = await request.validateUsing(validator)

      // Convert date if provided
      const bulkAssignmentData = {
        ...payload,
        assignmentDate: payload.assignmentDate ? DateTime.fromISO(payload.assignmentDate) : undefined,
        ctx: { request, response } as HttpContext,
      }

      const updatedTransactions = await this.companyFolioService.updateBulkPaymentAssignments(bulkAssignmentData)

      return response.ok({
        success: true,
        message: 'Bulk payment assignments updated successfully',
        data: {
          updatedCount: updatedTransactions.length,
          transactions: updatedTransactions.map(transaction => ({
            transactionId: transaction.id,
            assignedAmount: transaction.assignedAmount,
            unassignedAmount: transaction.unassignedAmount,
            totalAmount: Math.abs(transaction.amount),
          })),
        },
      })
    } catch (error) {
      // Handle validation errors specifically
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failure',
          errors: error.messages,
          details: 'Please check the following validation errors:',
        })
      }

      return response.badRequest({
        success: false,
        message: 'Failed to update bulk payment assignments',
        error: error.message,
      })
    }
  }

  /**
   * Get unassigned payment amount for a company
   */
  public async getUnassignedAmount({ params, response }: HttpContext) {
    try {
      const { companyId, hotelId } = params
      
      const unassignedAmount = await this.companyFolioService.getUnassignedPaymentAmount(
        parseInt(companyId),
        parseInt(hotelId)
      )

      return response.ok({
        success: true,
        data: {
          companyId: parseInt(companyId),
          hotelId: parseInt(hotelId),
          unassignedAmount,
        },
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to retrieve unassigned amount',
        error: error.message,
      })
    }
  }

  /**
   * Create or get company folio
   */
  public async createOrGet({ request, response }: HttpContext) {
    try {
      // Validate request data
      const validator = vine.compile(
        vine.object({
          companyId: vine.number().positive(),
          hotelId: vine.number().positive(),
        })
      )

      const { companyId, hotelId } = await request.validateUsing(validator)

      const folio = await this.companyFolioService.getOrCreateCompanyFolio(companyId, hotelId)

      return response.ok({
        success: true,
        message: folio.createdAt.diffNow().milliseconds < 1000 ? 'Company folio created' : 'Company folio retrieved',
        data: {
          folioId: folio.id,
          folioNumber: folio.folioNumber,
          folioName: folio.folioName,
          companyId: folio.companyId,
          balance: folio.balance,
          creditLimit: folio.creditLimit,
          status: folio.status,
        },
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create or retrieve company folio',
        error: error.message,
      })
    }
  }
}