import type { HttpContext } from '@adonisjs/core/http'
import TemplateCategory from '#models/template_category'
import { createTemplateCategoryValidator, updateTemplateCategoryValidator } from '#validators/template_category'
import { DateTime } from 'luxon'

export default class TemplateCategoriesController {
  /**
   * Display a list of template categories
   */
  async index({ params, request, response }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const hotelId = params.hotelId

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = TemplateCategory.query()
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')

      query.where('hotel_id', Number(hotelId))

      const templateCategories = await query.paginate(page, limit)

      return response.ok({
        success: true,
        data: templateCategories,
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Failed to fetch template categories',
        error: error.message,
      })
    }
  }

  /**
   * Create a new template category
   */
  async store({ request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(createTemplateCategoryValidator)
      const user = auth.user!

      const templateCategory = await TemplateCategory.create({
        ...payload,
        createdByUserId: user.id,
        updatedByUserId: user.id,
        isDeleted: false,
      })

      await templateCategory.load('hotel')
      await templateCategory.load('createdByUser')
      await templateCategory.load('updatedByUser')

      return response.created({
        success: true,
        data: templateCategory,
        message: 'Template category created successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to create template category',
        error: error.message,
      })
    }
  }

  /**
   * Show a specific template category
   */
  async show({ params, response }: HttpContext) {
    try {
      const templateCategory = await TemplateCategory.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .preload('hotel')
        .preload('createdByUser')
        .preload('updatedByUser')
        .firstOrFail()

      return response.ok({
        success: true,
        data: templateCategory,
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Template category not found',
      })
    }
  }

  /**
   * Update a template category
   */
  async update({ params, request, response, auth }: HttpContext) {
    try {
      const payload = await request.validateUsing(updateTemplateCategoryValidator)
      const user = auth.user!

      const templateCategory = await TemplateCategory.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      templateCategory.merge({
        ...payload,
        updatedByUserId: user.id,
      })

      await templateCategory.save()
      await templateCategory.load('hotel')
      await templateCategory.load('createdByUser')
      await templateCategory.load('updatedByUser')

      return response.ok({
        success: true,
        data: templateCategory,
        message: 'Template category updated successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to update template category',
        error: error.message,
      })
    }
  }

  /**
   * Soft delete a template category
   */
  async destroy({ params, response, auth }: HttpContext) {
    try {
      const user = auth.user!
      const templateCategory = await TemplateCategory.query()
        .where('id', params.id)
        .where('is_deleted', false)
        .firstOrFail()

      templateCategory.merge({
        isDeleted: true,
        deletedAt: DateTime.now(),
        updatedByUserId: user.id,
      })

      await templateCategory.save()

      return response.ok({
        success: true,
        message: 'Template category deleted successfully',
      })
    } catch (error) {
      return response.badRequest({
        success: false,
        message: 'Failed to delete template category',
        error: error.message,
      })
    }
  }
}