import type { HttpContext } from '@adonisjs/core/http'
import ExtraCharge from '#models/extra_charge'
import { createExtraChargeValidator, updateExtraChargeValidator } from '#validators/extra_charge'
import { DateTime } from 'luxon'

export default class ExtraChargesController {
  /**
   * Display a list of extra charges
   */
  public async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId
      const search = request.input('search')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = ExtraCharge.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('taxRates')
        .preload('createdByUser')
        .preload('updatedByUser')

      query.where('hotel_id', Number(hotelId))

      if (search) {
        query.where((builder) => {
          builder
            .where('name', 'LIKE', `%${search}%`)
            .orWhere('short_code', 'LIKE', `%${search}%`)
            .orWhere('description', 'LIKE', `%${search}%`)
        })
      }

      const extraCharges = await query.orderBy('front_desk_sort_key', 'asc').paginate(page, limit)

      return response.ok({
        success: true,
        data: extraCharges,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des frais supplémentaires',
      })
    }
  }

  /**
   * Show form for creating a new extra charge
   */
  public async create({}: HttpContext) {}

  /**
   * Handle form submission for the create action
   */
 public async store({ request, response, auth }: HttpContext) {
  try {
    const payload = await request.validateUsing(createExtraChargeValidator)
    const user = auth.user!

    console.log('📥 Payload reçu:', payload)
    console.log('👤 Utilisateur connecté:', user)

    const { taxRateIds, validFrom, validTo, ...extraChargeData } = payload

    const dataToSave = {
      ...extraChargeData,
      validFrom: validFrom ? DateTime.fromJSDate(validFrom) : DateTime.now(),
      validTo: validTo ? DateTime.fromJSDate(validTo) : DateTime.now().plus({ years: 1 }),
      createdByUserId: user.id,
      updatedByUserId: user.id,
      rateInclusiveTax: payload.rateInclusiveTax || 0,
      fixedPrice: payload.fixedPrice || false,
      frontDeskSortKey: payload.frontDeskSortKey || 1,
      publishOnWeb: payload.publishOnWeb || false,
      voucherNo: payload.voucherNo || 'auto_general',
      webResSortKey: payload.webResSortKey || 0,
      chargeAppliesOn: payload.chargeAppliesOn || 'per_quantity',
      applyChargeOn: payload.applyChargeOn || 'only_on_check_in',
      applyChargeAlways: payload.applyChargeAlways || false,
      isDeleted: false,
    }

    console.log('📝 Données préparées pour création:', dataToSave)

    const extraCharge = await ExtraCharge.create(dataToSave)

    console.log('✅ ExtraCharge créé:', extraCharge.toJSON())

    // Attach tax rates if provided
    if (taxRateIds && taxRateIds.length > 0) {
      await extraCharge.related('taxRates').attach(taxRateIds)
      console.log('🔗 Taxes attachées:', taxRateIds)
    }

    await extraCharge.load('hotel')
    await extraCharge.load('taxRates')
    await extraCharge.load('createdByUser')

    console.log('📦 ExtraCharge complet avec relations:', extraCharge.toJSON())

    return response.created({
      success: true,
      message: 'Frais supplémentaire créé avec succès',
      data: extraCharge,
    })
  } catch (error) {
    console.error('❌ Erreur lors de la création du frais supplémentaire:', error)
    return response.badRequest({
      success: false,
      message: error.message || 'Erreur lors de la création du frais supplémentaire',
    })
  }
}


  /**
   * Show individual extra charge
   */
  public async show({ params, response }: HttpContext) {
    try {
      const extraCharge = await ExtraCharge.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('taxRates')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: extraCharge,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Frais supplémentaire non trouvé',
      })
    }
  }


  /**
   * Handle form submission for the edit action
   */
  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateExtraChargeValidator)
      const user = auth.user!

      const extraCharge = await ExtraCharge.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      const { taxRateIds, validFrom, validTo, ...extraChargeData } = payload

      const updateData: any = {
        ...extraChargeData,
        updatedByUserId: user.id,
      }

      if (validFrom) {
        updateData.validFrom = DateTime.fromJSDate(validFrom)
      }
      if (validTo) {
        updateData.validTo = DateTime.fromJSDate(validTo)
      }

      extraCharge.merge(updateData)

      await extraCharge.save()

      // Update tax rates if provided
      if (taxRateIds !== undefined) {
        await extraCharge.related('taxRates').sync(taxRateIds)
      }

      await extraCharge.load('hotel')
      await extraCharge.load('taxRates')
      await extraCharge.load('updatedByUser')

      return response.ok({
        success: true,
        message: 'Frais supplémentaire mis à jour avec succès',
        data: extraCharge,
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Erreur lors de la mise à jour du frais supplémentaire',
      })
    }
  }

  /**
   * Delete (soft delete) the extra charge
   */
  public async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const extraCharge = await ExtraCharge.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      extraCharge.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await extraCharge.save()

      return response.ok({
        success: true,
        message: 'Frais supplémentaire supprimé avec succès',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: error.message || 'Erreur lors de la suppression du frais supplémentaire',
      })
    }
  }

  /**
   * Get extra charges by hotel
   */
  public async getByHotel({ params, response }: HttpContext) {
    try {
      const extraCharges = await ExtraCharge.query()
        .where('hotel_id', params.hotelId)
        .where('is_deleted', false)
        .where('valid_from', '<=', DateTime.now().toSQLDate())
        .where('valid_to', '>=', DateTime.now().toSQLDate())
        .preload('taxRates')
        .orderBy('front_desk_sort_key', 'asc')

      return response.ok({
        success: true,
        data: extraCharges,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des frais supplémentaires',
      })
    }
  }

  /**
   * Get web-published extra charges
   */
  public async getWebPublished({ params, response }: HttpContext) {
    try {
      const extraCharges = await ExtraCharge.query()
        .where('hotel_id', params.hotelId)
        .where('is_deleted', false)
        .where('publish_on_web', true)
        .where('valid_from', '<=', DateTime.now().toSQLDate())
        .where('valid_to', '>=', DateTime.now().toSQLDate())
        .preload('taxRates')
        .orderBy('web_res_sort_key', 'asc')

      return response.ok({
        success: true,
        data: extraCharges,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: error.message || 'Erreur lors de la récupération des frais supplémentaires web',
      })
    }
  }
}
