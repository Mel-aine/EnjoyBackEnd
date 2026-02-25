import type { HttpContext } from '@adonisjs/core/http'
import Module from '#models/module'
import ActivityLog from '#models/activity_log'

export default class ModulesController {
  public async index({ response }: HttpContext) {
    const modules = await Module.all()
    return response.ok(modules)
  }

  public async store({ request, response, auth }: HttpContext) {
    const data = request.only(['slug', 'name', 'priceMonthly', 'description', 'isActive'])
    const module = await Module.create(data)

    // Log the activity
    const user = auth.user!
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'module.create',
      entityType: 'module',
      entityId: module.id,
      description: `Created module: ${module.name} (${module.slug})`,
      changes: module.serialize(),
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.created(module)
  }

  public async update({ params, request, response, auth }: HttpContext) {
    const module = await Module.findOrFail(params.id)
    
    // Capture old state for logging
    const oldState = module.serialize()
    
    const data = request.only(['slug', 'name', 'priceMonthly', 'description', 'isActive'])
    module.merge(data)
    await module.save()

    // Log the activity
    const user = auth.user!
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'module.update',
      entityType: 'module',
      entityId: module.id,
      description: `Updated module: ${module.name}`,
      changes: {
        before: oldState,
        after: module.serialize()
      },
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.ok(module)
  }

  public async destroy({ params, response, request, auth }: HttpContext) {
    const module = await Module.findOrFail(params.id)
    const moduleName = module.name
    await module.delete()

    // Log the activity
    const user = auth.user!
    await ActivityLog.create({
      userId: user.id,
      username: user.username || user.email,
      action: 'module.delete',
      entityType: 'module',
      entityId: parseInt(params.id),
      description: `Deleted module: ${moduleName}`,
      ipAddress: request.ip(),
      userAgent: request.header('user-agent'),
      createdBy: user.id
    })

    return response.noContent()
  }
}