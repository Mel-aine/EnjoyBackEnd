import type { HttpContext } from '@adonisjs/core/http'
import SyncService from '#services/sync_service'
import SyncOperation from '#models/sync_operation'
import SyncCheckpoint from '#models/sync_checkpoint'
import SyncConflict from '#models/sync_conflict'
import { syncPushValidator, syncPullValidator, syncInitialLoadValidator, syncResolveConflictValidator } from '#validators/sync'

export default class SyncController {
  /**
   * POST /api/sync/push
   * Envoie un lot d'opérations hors ligne au serveur
   */
  async push({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(syncPushValidator)

    const result = await SyncService.processBatch({
      hotelId: payload.hotelId,
      userId: user.id,
      deviceId: payload.deviceId,
      lastSyncVersion: payload.lastSyncVersion || 0,
      operations: payload.operations,
    })

    return response.ok(result)
  }

  /**
   * POST /api/sync/pull
   * Récupère les changements depuis le serveur
   */
  async pull({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(syncPullValidator)

    const result = await SyncService.pullChanges({
      hotelId: payload.hotelId,
      userId: user.id,
      deviceId: payload.deviceId,
      lastSyncVersion: payload.lastSyncVersion || 0,
      resourceTypes: payload.resourceTypes || ['*'],
    })

    return response.ok(result)
  }

  /**
   * GET /api/sync/status
   * État de la synchronisation pour l'utilisateur
   */
  async status({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const hotelId = request.input('hotelId')

    if (!hotelId) {
      return response.badRequest({ message: 'hotelId is required' })
    }

    const pendingCountResult = await SyncOperation.query()
      .where('hotelId', hotelId)
      .where('userId', user.id)
      .whereIn('status', ['pending', 'processing', 'failed'])
      .count('* as total')

    const pending = Number(pendingCountResult[0].$extras.total || 0)

    const lastCheckpoint = await SyncCheckpoint.query()
      .where('hotelId', hotelId)
      .where('userId', user.id)
      .first()

    // Compter les conflits non résolus
    const conflictsCount = await SyncConflict.query()
      .where('hotelId', hotelId)
      .where('resolution', 'pending')
      .count('* as total')
    const conflicts = Number(conflictsCount[0].$extras.total || 0)

    return response.ok({
      pending,
      conflicts,
      lastSyncAt: lastCheckpoint?.lastSyncAt?.toISO(),
      lastVersion: Number(lastCheckpoint?.lastVersion || 0),
      serverTime: new Date().toISOString(),
    })
  }

  /**
   * GET /api/sync/conflicts
   * Liste les conflits non résolus
   */
  async conflicts({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const hotelId = request.input('hotelId')

    if (!hotelId) {
      return response.badRequest({ message: 'hotelId is required' })
    }

    const conflicts = await SyncConflict.query()
      .where('hotelId', hotelId)
      .where('resolution', 'pending')
      .orderBy('createdAt', 'desc')

    return response.ok({ data: conflicts })
  }

  /**
   * POST /api/sync/conflicts/:id/resolve
   * Résout un conflit
   */
  async resolveConflict({ params, request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(syncResolveConflictValidator)

    await SyncService.resolveConflict(params.id, payload.resolution, user.id)

    return response.ok({ message: 'Conflict resolved' })
  }

  /**
   * POST /api/sync/initial-load
   * Chargement initial complet pour un nouveau device
   */
  async initialLoad({ request, response, auth }: HttpContext) {
    const user = auth.user!
    const payload = await request.validateUsing(syncInitialLoadValidator)

    const result = await SyncService.initialLoad(
      payload.hotelId,
      user.id,
      payload.deviceId
    )

    return response.ok(result)
  }
}
