import ZkAccessService from '#services/zk_access_service'
import Door from '#models/door'
import RetryQueue from '#models/retry_queue'
import Logger from '@adonisjs/core/services/logger'


/**
 * Service d'intégration ZKTeco avec le PMS
 *
 * Gère:
 * - Check-in/Check-out avec attribution/révocation d'accès
 * - Badges Master pour le personnel
 * - File d'attente avec retry automatique en cas d'échec
 */
export default class ZkIntegrationService {
  private zkService: ZkAccessService

  constructor() {
    this.zkService = new ZkAccessService()
  }

  /**
   * ==========================================
   * CHECK-IN: Accorder l'accès aux chambres
   * ==========================================
   */
  public async grantAccessOnCheckIn(
    reservationId: number,
    roomIds: number[],
    guestName: string,
    guestId: number
  ): Promise<{
    success: boolean
    message: string
    details: Array<{ roomId: number; doorId?: number; success: boolean; error?: string }>
  }> {
    const details: Array<{ roomId: number; doorId?: number; success: boolean; error?: string }> = []
    let successCount = 0
    let errorCount = 0

    for (const roomId of roomIds) {
      try {
        // Trouver la porte associée à cette chambre
        const door = await Door.query().where('room_id', roomId).where('is_active', true).first()

        if (!door) {
          details.push({
            roomId,
            success: false,
            error: 'No active door found for this room',
          })
          errorCount++
          continue
        }

        // Générer un userId unique pour le terminal (combinaison guestId + roomId)
        const userIdOnDevice = `${guestId}-${roomId}`

        // Tenter d'accorder l'accès
        const result = await this.zkService.grantAccess(door.id, {
          userId: userIdOnDevice,
          name: guestName,
          cardNumber: 0, // À remplacer par l'UID réel du badge si disponible
          password: '123456',
          role: 0, // 0 = utilisateur normal
        })

        if (result.success) {
          successCount++
          details.push({
            roomId,
            doorId: door.id,
            success: true,
          })

          Logger.info(
            `[ZKTeco] Access granted: ${guestName} (${userIdOnDevice}) → Room ${roomId} (Door: ${door.name})`
          )
        } else {
          // Échec: Ajouter à la queue pour retry
          await this.addToQueue({
            reservationId,
            doorId: door.id,
            userIdOnDevice,
            userName: guestName,
            operation: 'grant',
          })

          errorCount++
          details.push({
            roomId,
            doorId: door.id,
            success: false,
            error: `Failed, added to retry queue: ${result.message}`,
          })

          Logger.warn(
            `[ZKTeco] Failed to grant access for ${guestName} on door ${door.name}, added to queue`
          )
        }
      } catch (error) {
        errorCount++
        details.push({
          roomId,
          success: false,
          error: error.message,
        })

        Logger.error(`[ZKTeco] Error granting access for room ${roomId}:`, error)
      }
    }

    const allSuccess = errorCount === 0
    const partialSuccess = successCount > 0 && errorCount > 0

    return {
      success: allSuccess,
      message: allSuccess
        ? `Access granted to all ${successCount} rooms`
        : partialSuccess
          ? `Partial success: ${successCount}/${roomIds.length} rooms granted, ${errorCount} queued for retry`
          : `All access grants failed, ${errorCount} operations queued for retry`,
      details,
    }
  }

  /**
   * ==========================================
   * CHECK-OUT: Révoquer l'accès aux chambres
   * ==========================================
   */
  public async revokeAccessOnCheckOut(
    reservationId: number,
    roomIds: number[],
    guestId: number
  ): Promise<{
    success: boolean
    message: string
    details: Array<{ roomId: number; doorId?: number; success: boolean; error?: string }>
  }> {
    const details: Array<{ roomId: number; doorId?: number; success: boolean; error?: string }> = []
    let successCount = 0
    let errorCount = 0

    for (const roomId of roomIds) {
      try {
        // Trouver la porte associée
        const door = await Door.query().where('room_id', roomId).where('is_active', true).first()

        if (!door) {
          details.push({
            roomId,
            success: false,
            error: 'No active door found for this room',
          })
          errorCount++
          continue
        }

        const userIdOnDevice = `${guestId}-${roomId}`

        // Tenter de révoquer l'accès
        const result = await this.zkService.revokeAccess(door.id, userIdOnDevice)

        if (result.success) {
          successCount++
          details.push({
            roomId,
            doorId: door.id,
            success: true,
          })

          Logger.info(
            `[ZKTeco] Access revoked: User ${userIdOnDevice} → Room ${roomId} (Door: ${door.name})`
          )
        } else {
          // Échec: Ajouter à la queue
          await this.addToQueue({
            reservationId,
            doorId: door.id,
            userIdOnDevice,
            operation: 'revoke',
          })

          errorCount++
          details.push({
            roomId,
            doorId: door.id,
            success: false,
            error: `Failed, added to retry queue: ${result.message}`,
          })

          Logger.warn(
            `[ZKTeco] Failed to revoke access for user ${userIdOnDevice} on door ${door.name}, added to queue`
          )
        }
      } catch (error) {
        errorCount++
        details.push({
          roomId,
          success: false,
          error: error.message,
        })

        Logger.error(`[ZKTeco] Error revoking access for room ${roomId}:`, error)
      }
    }

    const allSuccess = errorCount === 0

    return {
      success: allSuccess,
      message: allSuccess
        ? `Access revoked from all ${successCount} rooms`
        : `Partial revocation: ${successCount}/${roomIds.length} succeeded, ${errorCount} queued for retry`,
      details,
    }
  }

  /**
   * ==========================================
   * BADGE MASTER: Accès à toutes les portes
   * ==========================================
   */
  public async grantStaffMasterAccess(
    staffId: number,
    staffName: string,
    cardNumber?: string
  ): Promise<{
    success: boolean
    message: string
    details: Array<{ doorId: number; doorName: string; success: boolean; error?: string }>
  }> {
    Logger.info(`[ZKTeco] Granting master access to staff ${staffName} (ID: ${staffId})`)

    // Récupérer TOUS les terminaux actifs
    const allDoors = await Door.query().where('is_active', true)

    if (allDoors.length === 0) {
      return {
        success: false,
        message: 'No active doors found in the system',
        details: [],
      }
    }

    const details: Array<{ doorId: number; doorName: string; success: boolean; error?: string }> =
      []
    let successCount = 0
    let errorCount = 0

    const userIdOnDevice = `STAFF-${staffId}`

    for (const door of allDoors) {
      try {
        const result = await this.zkService.grantAccess(door.id, {
          userId: userIdOnDevice,
          name: staffName,
          cardNumber: cardNumber ? parseInt(cardNumber) : 0,
          password: '123456',
          role: 1, // 1 = Admin/Master role
        })

        if (result.success) {
          successCount++
          details.push({
            doorId: door.id,
            doorName: door.name,
            success: true,
          })

          Logger.info(`[ZKTeco] Master access granted on door: ${door.name}`)
        } else {
          // Ajouter à la queue
          await this.addToQueue({
            doorId: door.id,
            userIdOnDevice,
            userName: staffName,
            cardNumber,
            operation: 'grant'
          })

          errorCount++
          details.push({
            doorId: door.id,
            doorName: door.name,
            success: false,
            error: `Failed, queued for retry: ${result.message}`,
          })
        }
      } catch (error) {
        errorCount++
        details.push({
          doorId: door.id,
          doorName: door.name,
          success: false,
          error: error.message,
        })
      }
    }

    const allSuccess = errorCount === 0

    return {
      success: allSuccess,
      message: allSuccess
        ? `Master access granted on all ${successCount} doors`
        : `Partial success: ${successCount}/${allDoors.length} doors, ${errorCount} queued for retry`,
      details,
    }
  }

  /**
   * ==========================================
   * RÉVOQUER BADGE MASTER
   * ==========================================
   */
  public async revokeStaffMasterAccess(
    staffId: number,
    staffName: string
  ): Promise<{
    success: boolean
    message: string
    details: Array<{ doorId: number; doorName: string; success: boolean; error?: string }>
  }> {
    Logger.info(`[ZKTeco] Revoking master access from staff ${staffName} (ID: ${staffId})`)

    const allDoors = await Door.query().where('is_active', true)
    const details: Array<{ doorId: number; doorName: string; success: boolean; error?: string }> =
      []
    let successCount = 0
    let errorCount = 0

    const userIdOnDevice = `STAFF-${staffId}`

    for (const door of allDoors) {
      try {
        const result = await this.zkService.revokeAccess(door.id, userIdOnDevice)

        if (result.success) {
          successCount++
          details.push({
            doorId: door.id,
            doorName: door.name,
            success: true,
          })
        } else {
          await this.addToQueue({
            doorId: door.id,
            userIdOnDevice,
            operation: 'revoke',
          })

          errorCount++
          details.push({
            doorId: door.id,
            doorName: door.name,
            success: false,
            error: `Failed, queued for retry: ${result.message}`,
          })
        }
      } catch (error) {
        errorCount++
        details.push({
          doorId: door.id,
          doorName: door.name,
          success: false,
          error: error.message,
        })
      }
    }

    return {
      success: errorCount === 0,
      message:
        errorCount === 0
          ? `Master access revoked from all ${successCount} doors`
          : `Partial revocation: ${successCount}/${allDoors.length} succeeded`,
      details,
    }
  }

  /**
   * ==========================================
   * AJOUTER UNE OPÉRATION À LA QUEUE
   * ==========================================
   */
  private async addToQueue(params: {
    reservationId?: number
    doorId: number
    userIdOnDevice: string
    userName?: string
    cardNumber?: string
    operation: 'grant' | 'revoke'
  }): Promise<void> {
    await RetryQueue.create({
      reservationId: params.reservationId || null,
      doorId: params.doorId,
      userIdOnDevice: params.userIdOnDevice,
      userName: params.userName || null,
      cardNumber: params.cardNumber || null,
      operation: params.operation,
      status: 'pending',
      retryCount: 0,
      maxRetries: 5,
    })

    Logger.info(
      `[Queue] Added ${params.operation} operation for user ${params.userIdOnDevice} on door ${params.doorId}`
    )
  }

  /**
   * ==========================================
   * TRAITER LA QUEUE
   * ==========================================
   */
  public async processQueue(): Promise<{
    processed: number
    succeeded: number
    failed: number
    remaining: number
  }> {
    // Récupérer les tâches en attente
    const pendingTasks = await RetryQueue.query()
      .where('status', 'pending')
      .where('retry_count', '<', 5)
      .orderBy('created_at', 'asc')
      .limit(50) // Traiter 50 tâches max par batch

    if (pendingTasks.length === 0) {
      return { processed: 0, succeeded: 0, failed: 0, remaining: 0 }
    }

    let succeeded = 0
    let failed = 0

    for (const task of pendingTasks) {
      try {
        // Marquer comme en cours
        task.status = 'processing'
        await task.save()

        let result

        if (task.operation === 'grant') {
          result = await this.zkService.grantAccess(task.doorId!, {
            userId: task.userIdOnDevice,
            name: task.userName || 'Guest',
            cardNumber: task.cardNumber ? parseInt(task.cardNumber) : 0,
            password: '123456',
            role: 0,
          })
        } else {
          result = await this.zkService.revokeAccess(task.doorId!, task.userIdOnDevice)
        }

        if (result.success) {
          task.markAsCompleted()
          succeeded++
          Logger.info(
            `[Queue] Successfully processed ${task.operation} for user ${task.userIdOnDevice} on door ${task.doorId}`
          )
        } else {
          task.status = 'pending'
          task.incrementRetry(result.message)
          failed++
          Logger.warn(
            `[Queue] Retry ${task.retryCount}/${task.maxRetries} failed for task ${task.id}: ${result.message}`
          )
        }

        await task.save()
      } catch (error) {
        task.status = 'pending'
        task.incrementRetry(error.message)
        await task.save()
        failed++

        Logger.error(`[Queue] Error processing task ${task.id}:`, error)
      }
    }

    // Compter les tâches restantes
    const remaining = await RetryQueue.query()
      .where('status', 'pending')
      .where('retry_count', '<', 5)
      .count('* as total')

    return {
      processed: pendingTasks.length,
      succeeded,
      failed,
      remaining: Number(remaining[0].$extras.total),
    }
  }

  /**
   * process pour un terminal
   */

public async processQueueForDoor(
  doorId: number
): Promise<{
  processed: number
  succeeded: number
  failed: number
  remaining: number
}> {
  const pendingTasks = await RetryQueue.query()
    .where('status', 'pending')
    .where('retry_count', '<', 5)
    .where('door_id', doorId)
    .orderBy('created_at', 'asc')
    .limit(20)

  if (pendingTasks.length === 0) {
    return { processed: 0, succeeded: 0, failed: 0, remaining: 0 }
  }

  let succeeded = 0
  let failed = 0

  for (const task of pendingTasks) {
    try {
      task.status = 'processing'
      await task.save()

      let result

      if (task.operation === 'grant') {
        result = await this.zkService.grantAccess(task.doorId!, {
          userId: task.userIdOnDevice,
          name: task.userName || 'Guest',
          cardNumber: task.cardNumber ? parseInt(task.cardNumber) : 0,
          password: '123456',
          role: 0,
        })
      } else {
        result = await this.zkService.revokeAccess(
          task.doorId!,
          task.userIdOnDevice
        )
      }

      if (result.success) {
        task.markAsCompleted()
        succeeded++
      } else {
        task.status = 'pending'
        task.incrementRetry(result.message)
        failed++
      }

      await task.save()
    } catch (error) {
      task.status = 'pending'
      task.incrementRetry(error.message)
      await task.save()
      failed++
    }
  }

  const remaining = await RetryQueue.query()
    .where('status', 'pending')
    .where('retry_count', '<', 5)
    .where('door_id', doorId)
    .count('* as total')

  return {
    processed: pendingTasks.length,
    succeeded,
    failed,
    remaining: Number(remaining[0].$extras.total),
  }
}


/**
 * ==========================================
 * BADGE LIMITÉ: Accès à une porte spécifique
 * ==========================================
 * Utilisé pour les cartes "limited" où le staff n'a accès
 * qu'à certaines portes (contrairement au master qui a accès partout)
 */
public async grantStaffAccessToDoor(
  door: Door,
  staffId: number,
  staffName: string,
  cardNumber?: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  Logger.info(`[ZKTeco] Granting limited access to staff ${staffName} (ID: ${staffId}) on door ${door.name}`)

  const userIdOnDevice = `STAFF-${staffId}`

  try {
    const result = await this.zkService.grantAccess(door.id, {
      userId: userIdOnDevice,
      name: staffName,
      cardNumber: cardNumber ? parseInt(cardNumber) : 0,
      password: '123456',
      role: 0, // 0 = utilisateur normal (pas admin comme master)
    })

    if (result.success) {
      Logger.info(`[ZKTeco] Limited access granted on door: ${door.name}`)
      return {
        success: true,
        message: `Access granted to ${door.name}`
      }
    } else {
      // Ajouter à la queue pour retry
      await this.addToQueue({
        doorId: door.id,
        userIdOnDevice,
        userName: staffName,
        cardNumber,
        operation: 'grant'
      })

      Logger.warn(
        `[ZKTeco] Failed to grant limited access for ${staffName} on door ${door.name}, added to queue`
      )

      return {
        success: false,
        error: `Failed, queued for retry: ${result.message}`
      }
    }
  } catch (error) {
    Logger.error(`[ZKTeco] Error granting access to door ${door.id}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * ==========================================
 * RÉVOQUER ACCÈS D'UNE PORTE SPÉCIFIQUE
 * ==========================================
 */
public async revokeStaffAccessFromDoor(
  door: Door,
  staffId: number,
  staffName: string
): Promise<{
  success: boolean
  message?: string
  error?: string
}> {
  Logger.info(`[ZKTeco] Revoking access from staff ${staffName} (ID: ${staffId}) on door ${door.name}`)

  const userIdOnDevice = `STAFF-${staffId}`

  try {
    const result = await this.zkService.revokeAccess(door.id, userIdOnDevice)

    if (result.success) {
      Logger.info(`[ZKTeco] Access revoked from door: ${door.name}`)
      return {
        success: true,
        message: `Access revoked from ${door.name}`
      }
    } else {
      // Ajouter à la queue
      await this.addToQueue({
        doorId: door.id,
        userIdOnDevice,
        operation: 'revoke'
      })

      return {
        success: false,
        error: `Failed, queued for retry: ${result.message}`
      }
    }
  } catch (error) {
    Logger.error(`[ZKTeco] Error revoking access from door ${door.id}:`, error)
    return {
      success: false,
      error: error.message
    }
  }
}
}
