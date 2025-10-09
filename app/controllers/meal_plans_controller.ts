import type { HttpContext } from '@adonisjs/core/http'
import MealPlan from '#models/meal_plan'
import MealPlanComponent from '#models/meal_plan_component'

export default class MealPlansController {
  // List meal plans for a hotel
  public async index({ params, request, response }: HttpContext) {
    try {
      const { hotelId } = params
      const page = request.input('page', 1)
      const limit = request.input('limit', 10)
      const search = request.input('search')

      if (!hotelId) {
        return response.badRequest({ success: false, message: 'hotelId is required' })
      }

      const query = MealPlan.query()
        .where('hotel_id', Number(hotelId))
        .preload('components', (q) => q.preload('extraCharge'))
        .preload('extraCharges')
        .preload('hotel')
        .preload('createdByUser')
        .preload('lastModifiedByUser')

      if (search) {
        query.where((builder) => {
          builder
            .where('name', 'LIKE', `%${search}%`)
            .orWhere('short_code', 'LIKE', `%${search}%`)
            .orWhere('description', 'LIKE', `%${search}%`)
        })
      }

      const mealPlans = await query.orderBy('name', 'asc').paginate(page, limit)

      return response.ok({ success: true, data: mealPlans })
    } catch (error) {
      return response.internalServerError({ success: false, message: error.message })
    }
  }

  // Get a single meal plan by id (scoped by hotel)
  public async show({ params, response }: HttpContext) {
    try {
      const { id, hotelId } = params
      const mealPlan = await MealPlan.query()
        .where('id', id)
        .where('hotel_id', Number(hotelId))
        .preload('components', (q) => q.preload('extraCharge'))
        .preload('extraCharges')
        .preload('hotel')
        .preload('createdByUser')
        .preload('lastModifiedByUser')
        .firstOrFail()

      return response.ok({ success: true, data: mealPlan })
    } catch (error) {
      return response.notFound({ success: false, message: 'MealPlan not found' })
    }
  }

  // Create a meal plan
  public async store({ params, request, response, auth }: HttpContext) {
    try {
      const { hotelId } = params
      const user = auth.user
      if (!hotelId) return response.badRequest({ success: false, message: 'hotelId is required' })

      const body = request.body()

      const mealPlan = await MealPlan.create({
        hotelId: Number(hotelId),
        name: body.name,
        shortCode: body.shortCode,
        description: body.description,
        status: body.status ?? 'Active',
        isAllInclusive: body.isAllInclusive ?? false,
        createdBy: user?.id ?? null,
        lastModifiedBy: user?.id ?? null,
      })

      // Optionally attach components
      const components = body.components as Array<{
        extraChargeId: number
        quantityPerDay?: number
        targetGuestType?: string
      }> | undefined

      if (components?.length) {
        for (const comp of components) {
          await MealPlanComponent.create({
            hotelId: Number(hotelId),
            mealPlanId: mealPlan.id,
            extraChargeId: comp.extraChargeId,
            quantityPerDay: comp.quantityPerDay ?? 1,
            targetGuestType: comp.targetGuestType ?? 'adult',
            createdBy: user?.id ?? null,
            lastModifiedBy: user?.id ?? null,
          })
        }
      }

      await mealPlan.load('components', (q) => q.preload('extraCharge'))
      await mealPlan.load('extraCharges')
      await mealPlan.load('hotel')

      return response.created({ success: true, data: mealPlan })
    } catch (error) {
      return response.badRequest({ success: false, message: error.message })
    }
  }

  // Update a meal plan
  public async update({ params, request, response, auth }: HttpContext) {
    try {
      const { id, hotelId } = params
      const user = auth.user
      const body = request.body()

      const mealPlan = await MealPlan.query()
        .where('id', id)
        .where('hotel_id', Number(hotelId))
        .firstOrFail()

      mealPlan.merge({
        name: body.name ?? mealPlan.name,
        shortCode: body.shortCode ?? mealPlan.shortCode,
        description: body.description ?? mealPlan.description,
        status: body.status ?? mealPlan.status,
        isAllInclusive: body.isAllInclusive ?? mealPlan.isAllInclusive,
        lastModifiedBy: user?.id ?? mealPlan.lastModifiedBy,
      })
      await mealPlan.save()

      // Optionally update components (simple replace strategy if provided)
      const components = body.components as Array<{
        extraChargeId: number
        quantityPerDay?: number
        targetGuestType?: string
      }> | undefined

      if (components) {
        // Remove existing components and recreate
        await MealPlanComponent.query()
          .where('meal_plan_id', mealPlan.id)
          .where('hotel_id', Number(hotelId))
          .delete()

        for (const comp of components) {
          await MealPlanComponent.create({
            hotelId: Number(hotelId),
            mealPlanId: mealPlan.id,
            extraChargeId: comp.extraChargeId,
            quantityPerDay: comp.quantityPerDay ?? 1,
            targetGuestType: comp.targetGuestType ?? 'adult',
            createdBy: user?.id ?? null,
            lastModifiedBy: user?.id ?? null,
          })
        }
      }

      await mealPlan.load('components', (q) => q.preload('extraCharge'))
      await mealPlan.load('extraCharges')
      await mealPlan.load('hotel')

      return response.ok({ success: true, data: mealPlan })
    } catch (error) {
      return response.badRequest({ success: false, message: error.message })
    }
  }
}