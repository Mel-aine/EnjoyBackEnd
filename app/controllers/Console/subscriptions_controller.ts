import type { HttpContext } from '@adonisjs/core/http'
import Subscription from '#models/subscription'
import Hotel from '#models/hotel'
import Module from '#models/module'
import ActivityLog from '#models/activity_log'
import { DateTime } from 'luxon'

export default class SubscriptionsController {
  public async index({ params, response }: HttpContext) {
    const hotel = await Hotel.findOrFail(params.hotel_id)
    await hotel.load('subscriptions', (query) => query.preload('module'))
    return response.ok(hotel.subscriptions)
  }

  public async store({ params, request, response, auth }: HttpContext) {
    const hotel = await Hotel.findOrFail(params.hotel_id)
    const moduleId = request.input('module_id')
    const billingCycle = request.input('billing_cycle', 'monthly')
    const module = await Module.findOrFail(moduleId)
    const user = auth.user!

    // General check: Prevent duplicate active subscription for the exact same module
    const existingSameSub = await hotel.related('subscriptions')
      .query()
      .where('module_id', moduleId)
      .where('status', 'active')
      .where('ends_at', '>', DateTime.now().toSQL())
      .first()

    if (existingSameSub) {
      return response.badRequest({
        message: 'You already have an active subscription for this module/pack.',
        code: 'DUPLICATE_SUBSCRIPTION'
      })
    }

    // Check for dependencies (e.g., Channel Manager requires PMS)
    if (module.slug === 'channel_manager') {
      const hasPMS = await hotel.hasAccessTo('pms')
      if (!hasPMS) {
        return response.badRequest({
          message: 'You must have an active PMS subscription to purchase Channel Manager.',
          code: 'DEPENDENCY_MISSING'
        })
      }
    }

    // Check if the module is a bundle
    if (module.isBundle && module.includedModulesJson) {
      // 1. Check for existing active subscriptions for included modules
      const includedSlugs = module.includedModulesJson
      
      const existingSubs = await hotel.related('subscriptions')
        .query()
        .where('status', 'active')
        .where('ends_at', '>', DateTime.now().toSQL())
        .preload('module')

      for (const sub of existingSubs) {
        // If the existing subscription is for a module included in the bundle
        if (includedSlugs.includes(sub.module.slug)) {
          // Upgrade Logic: Cancel old subscription
          // Ideally, we would calculate pro-rata here and apply credit
          sub.status = 'canceled' // or 'upgraded' if you add that status enum
          sub.endsAt = DateTime.now()
          await sub.save()
        }
      }
    } else {
      // 2. Check if the module is already included in an active bundle
      const hasAccess = await hotel.hasAccessTo(module.slug)
      if (hasAccess) {
        return response.badRequest({
          message: 'Hotel already has access to this module (directly or via a pack)',
          code: 'DUPLICATE_SUBSCRIPTION'
        })
      }
    }

    let endsAt = DateTime.now()
    if (billingCycle === 'monthly') {
      endsAt = endsAt.plus({ months: 1 })
    } else {
      endsAt = endsAt.plus({ years: 1 })
    }

    const subscription = await hotel.related('subscriptions').create({
      moduleId,
      startsAt: DateTime.now(),
      endsAt: endsAt,
      status: 'active',
      billingCycle,
      price: module.priceMonthly,
      paymentStatus: 'pending'
    })

    // Log the activity
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'subscription.create',
      entityType: 'subscription',
      entityId: subscription.id,
      hotelId: hotel.id,
      description: `Purchased ${module.isBundle ? 'pack' : 'module'}: ${module.name} (${module.slug})`,
      changes: {
        moduleId: module.id,
        moduleName: module.name,
        billingCycle,
        price: module.priceMonthly,
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.created(subscription)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    const subscription = await Subscription.findOrFail(params.id)
    const user = auth.user!
    
    // Capture old state for logging
    const oldState = subscription.serialize()
    
    const data = request.only(['status', 'endsAt', 'limitCount', 'paymentStatus'])
    subscription.merge(data)
    await subscription.save()
    
    // Log the activity
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'subscription.update',
      entityType: 'subscription',
      entityId: subscription.id,
      hotelId: subscription.hotelId, // Assuming Subscription has hotelId
      description: `Updated subscription for module ID: ${subscription.moduleId}`,
      changes: {
        before: oldState,
        after: subscription.serialize()
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.ok(subscription)
  }

  public async destroy({ params, response, request, auth }: HttpContext) {
    const subscription = await Subscription.findOrFail(params.id)
    const user = auth.user!
    const hotelId = subscription.hotelId
    const moduleId = subscription.moduleId

    await subscription.delete()

    // Log the activity
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'subscription.delete',
      entityType: 'subscription',
      entityId: subscription.id, // Note: ID might be gone if hard deleted, but usually helpful for reference
      hotelId: hotelId,
      description: `Deleted subscription for module ID: ${moduleId}`,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.noContent()
  }
}