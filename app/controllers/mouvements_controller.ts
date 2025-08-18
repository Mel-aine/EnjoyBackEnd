import Mouvement from '#models/mouvement'
import CrudService from '#services/crud_service'
import CrudController from './crud_controller.js'
import Expense from '#models/expense'
import LoggerService from '#services/logger_service'


import { DateTime } from 'luxon'

import { HttpContext } from '@adonisjs/core/http'
const mouvementService = new CrudService(Mouvement)

export default class MouvementsController extends CrudController<typeof Mouvement> {
  constructor() {
    super(mouvementService)
  }

 public async storeMouvement(ctx: HttpContext) {
  const { request, response,auth } = ctx
    try {

      const data = request.only([
        'product_id',
        'stock_category_id',
        'date',
        'type',
        'quantity',
        // 'source',
        'department_id',
        'user',
        'notes',
        'service_id',
        'created_by',
        'last_modified_by'
      ])


      const mouvement = await Mouvement.create({
        product_id: data.product_id ?? null,
        stock_category_id: data.stock_category_id ?? null,
        date: data.date ? DateTime.fromISO(data.date) : DateTime.local(),
        type: data.type ?? 'entry',
        quantity: data.quantity ?? 0,
        // source: data.source ?? null,
        department_id: data.department_id ?? null,
        user: data.user ?? null,
        notes: data.notes ?? null,
        hotel_id: data.service_id ?? null,
        created_by: data.created_by ?? null,
        last_modified_by: data.last_modified_by?? null,
      })
      

      if (mouvement.type === 'Entry') {
        await mouvement.load('productService')
        const product = mouvement.productService

        if (!product) {
          return response.badRequest({ message: 'Produit introuvable pour ce mouvement.' })
        }

        const price = product.price || 0
        const quantity = mouvement.quantity

        const amountBeforeTax = price * quantity
        const taxRate = 0.1925
        const taxAmount = amountBeforeTax * taxRate
        const totalAmount = amountBeforeTax + taxAmount

        await Expense.create({
          department_id: mouvement.department_id,
          supplier_id: null,
          expense_category_id: mouvement.stock_category_id ?? 1,
          invoice_number: null,
          description: `Entrée stock produit ${product.name}`,
          amount_before_tax: amountBeforeTax,
          tax_rate: taxRate * 100,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          expense_date: mouvement.date.toJSDate(),
          due_date: null,
          payment_date: null,
          payment_method: 'stock',
          payment_reference: null,
          receipt_image: null,
          status: 'paid',
          notes: mouvement.notes,
          created_by: mouvement.created_by,
          last_modified_by: mouvement.last_modified_by,
          hotel_id: mouvement.hotel_id,
        })
        
      }
      if (mouvement.created_by) {
          await LoggerService.log({
            actorId: auth.user!.id,
            action: 'CREATE',
            entityType: 'Mouvement',
            entityId: mouvement.id,
            description: `Mouvement #${mouvement.id} créé avec succès.`,
            ctx: ctx,
          })
        }

      return response.created(mouvement)
    } catch (error) {
      console.error(error)
      return response.internalServerError({ message: 'Erreur lors de la création du mouvement.' })
    }
  }
}
