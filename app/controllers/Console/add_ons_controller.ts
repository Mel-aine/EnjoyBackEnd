import type { HttpContext } from '@adonisjs/core/http'
import vine from '@vinejs/vine'
import AddOn from '#models/add_on'
import Module from '#models/module'
import LoggerService from '#services/logger_service'

const createSchema = vine.compile(
  vine.object({
    moduleId: vine.number(),
    min: vine.number(),
    max: vine.number(),
    priceMonth: vine.number(),
    priceYear: vine.number(),
  })
)

const updateSchema = vine.compile(
  vine.object({
    moduleId: vine.number().optional(),
    min: vine.number().optional(),
    max: vine.number().optional(),
    priceMonth: vine.number().optional(),
    priceYear: vine.number().optional(),
  })
)

export default class AddOnsController {
  public async indexByModule({ params, request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)

    const addOns = await AddOn.query()
      .where('module_id', Number(params.module_id))
      .preload('module', (q) => q.select(['id', 'slug', 'name']))
      .orderBy('created_at', 'desc')
      .paginate(page, limit)

    return response.ok(addOns)
  }

  public async index({ request, response }: HttpContext) {
    const page = request.input('page', 1)
    const limit = request.input('limit', 10)
    const moduleId = request.input('moduleId')

    const query = AddOn.query().preload('module', (q) => q.select(['id', 'slug', 'name']))

    if (moduleId !== undefined && moduleId !== null && moduleId !== '') {
      query.where('module_id', Number(moduleId))
    }

    const addOns = await query.orderBy('created_at', 'desc').paginate(page, limit)
    return response.ok(addOns)
  }

  public async show({ params, response }: HttpContext) {
    const addOn = await AddOn.query()
      .where('id', Number(params.id))
      .preload('module', (q) => q.select(['id', 'slug', 'name']))
      .firstOrFail()
    return response.ok(addOn)
  }

  public async store(ctx: HttpContext) {
    const { request, response, auth } = ctx
    const data = await request.validateUsing(createSchema)

    if (data.min > data.max) {
      return response.badRequest({ message: 'min cannot be greater than max' })
    }

    await Module.findOrFail(data.moduleId)

    const addOn = await AddOn.create({
      moduleId: data.moduleId,
      min: data.min,
      max: data.max,
      priceMonth: data.priceMonth,
      priceYear: data.priceYear,
    })

    await addOn.load('module')

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'add_on.create',
      resourceType: 'AddOn',
      resourceId: addOn.id,
      description: 'Add-on created',
      details: addOn.serialize(),
      ctx,
    })

    return response.created(addOn)
  }

  public async storeForModule(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const data = await request.validateUsing(
      vine.compile(
        vine.object({
          min: vine.number(),
          max: vine.number(),
          priceMonth: vine.number(),
          priceYear: vine.number(),
        })
      )
    )

    const moduleId = Number(params.module_id)
    if (data.min > data.max) {
      return response.badRequest({ message: 'min cannot be greater than max' })
    }

    await Module.findOrFail(moduleId)

    const addOn = await AddOn.create({
      moduleId,
      min: data.min,
      max: data.max,
      priceMonth: data.priceMonth,
      priceYear: data.priceYear,
    })

    await addOn.load('module')

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'add_on.create',
      resourceType: 'AddOn',
      resourceId: addOn.id,
      description: 'Add-on created',
      details: addOn.serialize(),
      ctx,
    })

    return response.created(addOn)
  }

  public async update(ctx: HttpContext) {
    const { params, request, response, auth } = ctx
    const addOn = await AddOn.findOrFail(params.id)
    const before = addOn.serialize()
    const data = await request.validateUsing(updateSchema)

    if (data.moduleId !== undefined) {
      await Module.findOrFail(data.moduleId)
    }

    const nextMin = data.min ?? addOn.min
    const nextMax = data.max ?? addOn.max
    if (nextMin > nextMax) {
      return response.badRequest({ message: 'min cannot be greater than max' })
    }

    addOn.merge({
      moduleId: data.moduleId,
      min: data.min,
      max: data.max,
      priceMonth: data.priceMonth,
      priceYear: data.priceYear,
    })

    await addOn.save()
    await addOn.load('module')

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'add_on.update',
      resourceType: 'AddOn',
      resourceId: addOn.id,
      description: 'Add-on updated',
      details: LoggerService.extractChanges(before as any, addOn.serialize() as any),
      ctx,
    })

    return response.ok(addOn)
  }

  public async destroy({ params, response, auth, request }: HttpContext) {
    const addOn = await AddOn.findOrFail(params.id)
    const before = addOn.serialize()
    await addOn.delete()

    await LoggerService.logActivity({
      userId: auth.user?.id,
      action: 'add_on.delete',
      resourceType: 'AddOn',
      resourceId: Number(params.id),
      description: 'Add-on deleted',
      details: before,
      ctx: { request, response, auth } as any,
    })

    return response.noContent()
  }
}
