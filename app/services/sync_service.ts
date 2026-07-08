import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import SyncOperation from '#models/sync_operation'
import SyncConflict from '#models/sync_conflict'
import SyncCheckpoint from '#models/sync_checkpoint'
import logger from '@adonisjs/core/services/logger'

interface SyncOperationInput {
  operationId: string
  operationType: 'create' | 'update' | 'delete'
  resourceType: string
  resourceId?: number
  payload: Record<string, any>
  clientTimestamp: string
  priority?: number
}

interface SyncBatchRequest {
  hotelId: number
  userId: number
  deviceId: string
  lastSyncVersion: number
  operations: SyncOperationInput[]
}

interface SyncBatchResponse {
  processed: Array<{
    operationId: string
    status: 'completed' | 'conflicted' | 'failed'
    serverId?: number
    version?: number
    error?: string
  }>
  conflicts: Array<{
    operationId: string
    resourceType: string
    resourceId: number
    clientVersion: number
    serverVersion: number
    clientData: Record<string, any>
    serverData: Record<string, any>
    resolution: 'server_wins' | 'client_wins'
  }>
  errors: Array<{
    operationId: string
    error: string
    retryable: boolean
  }>
  serverTime: string
  newCheckpoint: number
}

interface PullRequest {
  hotelId: number
  userId: number
  deviceId: string
  lastSyncVersion: number
  resourceTypes: string[]
}

interface PullChanges {
  [resourceType: string]: {
    created: any[]
    updated: any[]
    deleted: { id: number; deletedAt: string }[]
  }
}

export default class SyncService {
  /**
   * Version unique globale pour le suivi des changements
   */
  static async nextVersion(): Promise<number> {
    const result = await db.rawQuery("SELECT nextval('sync_version_seq') as version")
    return Number(result.rows[0].version)
  }

  /**
   * Traite un lot d'opérations hors ligne
   */
  static async processBatch(input: SyncBatchRequest): Promise<SyncBatchResponse> {
    const processed: SyncBatchResponse['processed'] = []
    const conflicts: SyncBatchResponse['conflicts'] = []
    const errors: SyncBatchResponse['errors'] = []

    // Trier par priorité (décroissante) puis par timestamp (croissant)
    const sortedOps = [...input.operations].sort((a, b) => {
      const priorityDiff = (b.priority || 0) - (a.priority || 0)
      if (priorityDiff !== 0) return priorityDiff
      return new Date(a.clientTimestamp).getTime() - new Date(b.clientTimestamp).getTime()
    })

    for (const op of sortedOps) {
      try {
        // Vérifier si déjà traité (idempotence)
        const existing = await SyncOperation.findBy('operation_id', op.operationId)
        if (existing) {
          if (existing.status === 'completed') {
            processed.push({
              operationId: op.operationId,
              status: 'completed',
              serverId: existing.resourceId ?? undefined,
              version: 0,
            })
            continue
          }
          if (existing.status === 'failed') {
            errors.push({
              operationId: op.operationId,
              error: existing.errorMessage || 'Previous operation failed',
              retryable: false,
            })
            continue
          }
        }

        // Enregistrer l'opération
        const syncOp = await SyncOperation.create({
          hotelId: input.hotelId,
          userId: input.userId,
          operationId: op.operationId,
          operationType: op.operationType,
          resourceType: op.resourceType,
          resourceId: op.resourceId || null,
          payload: op.payload,
          status: 'processing',
          priority: op.priority || 0,
          clientTimestamp: DateTime.fromISO(op.clientTimestamp),
        })

        // Exécuter l'opération selon le type
        const result = await this.executeOperation(op, input.hotelId, input.userId)

        // Marquer comme complété
        syncOp.status = 'completed'
        syncOp.resourceId = result.serverId
        syncOp.serverTimestamp = DateTime.now()
        await syncOp.save()

        processed.push({
          operationId: op.operationId,
          status: 'completed',
          serverId: result.serverId,
          version: result.version,
        })
      } catch (error: any) {
        if (this.isConflictError(error)) {
          // Conflit de version
          const conflictRecord = await this.createConflict(op, error, input.hotelId)
          conflicts.push({
            operationId: op.operationId,
            resourceType: op.resourceType,
            resourceId: op.resourceId || 0,
            clientVersion: op.payload?.version || 1,
            serverVersion: error.serverVersion,
            clientData: op.payload,
            serverData: error.serverData,
            resolution: 'server_wins',
          })

          // Marquer comme conflicted
          const syncOp = await SyncOperation.findBy('operation_id', op.operationId)
          if (syncOp) {
            syncOp.status = 'conflicted'
            syncOp.conflictData = {
              conflictId: conflictRecord.id,
              serverVersion: error.serverVersion,
              clientVersion: op.payload?.version || 1,
            }
            syncOp.errorMessage = `Version conflict: server v${error.serverVersion} > client v${op.payload?.version || 1}`
            await syncOp.save()
          }

          processed.push({
            operationId: op.operationId,
            status: 'conflicted',
          })
        } else {
          const retryable = this.isRetryable(error)
          errors.push({
            operationId: op.operationId,
            error: error.message || 'Unknown error',
            retryable,
          })

          // Marquer comme échoué
          const syncOp = await SyncOperation.findBy('operation_id', op.operationId)
          if (syncOp) {
            syncOp.status = 'failed'
            syncOp.errorMessage = error.message
            syncOp.retryCount = (syncOp.retryCount || 0) + 1
            await syncOp.save()
          }

          processed.push({
            operationId: op.operationId,
            status: 'failed',
            error: error.message,
          })
        }
      }
    }

    // Mettre à jour le checkpoint global
    const version = await this.nextVersion()
    await SyncCheckpoint.updateOrCreate(
      { hotelId: input.hotelId, userId: input.userId, deviceId: input.deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: version }
    )

    return {
      processed,
      conflicts,
      errors,
      serverTime: DateTime.now().toISO()!,
      newCheckpoint: version,
    }
  }

  /**
   * Table de correspondance resourceType → nom de table PostgreSQL
   */
  private static readonly TABLE_MAP: Record<string, string> = {
    reservation: 'reservations',
    guest: 'guests',
    room: 'rooms',
    folio: 'folios',
    folio_transaction: 'folio_transactions',
    room_type: 'room_types',
    rate_type: 'rate_types',
    room_rate: 'room_rates',
    extra_charge: 'extra_charges',
    booking_source: 'booking_sources',
    payment_method: 'payment_methods',
    tax_rate: 'tax_rates',
    discount: 'discounts',
    work_order: 'work_orders',
    room_block: 'room_blocks',
    vip_status: 'vip_statuses',
    black_list_reason: 'black_list_reasons',
    notification: 'notifications',
    business_source: 'business_sources',
    market_code: 'market_codes',
    reservation_room: 'reservation_rooms',
    reservation_type: 'reservation_types',
    reservation_guest: 'reservation_guests',
    announcement: 'announcements',
  }

  /**
   * Retourne le nom de la table pour un type de ressource
   */
  private static getTableName(resourceType: string): string | null {
    return this.TABLE_MAP[resourceType] ?? null
  }

  /**
   * Exécute une opération individuelle
   */
  private static async executeOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.resourceType) {
      // Types existants
      case 'reservation':
        return this.executeReservationOperation(op, hotelId, userId)
      case 'guest':
        return this.executeGuestOperation(op, hotelId, userId)
      case 'folio_transaction':
        return this.executeFolioTransactionOperation(op, hotelId, userId)
      case 'room':
        return this.executeRoomOperation(op, hotelId, userId)
      case 'folio':
        return this.executeFolioOperation(op, hotelId, userId)

      // Types de configuration (CRUD simple)
      case 'room_type':
      case 'rate_type':
      case 'room_rate':
      case 'extra_charge':
      case 'booking_source':
      case 'payment_method':
      case 'tax_rate':
      case 'discount':
      case 'vip_status':
      case 'black_list_reason':
        return this.executeConfigOperation(op, hotelId, userId)

      // Types opérationnels
      case 'work_order':
        return this.executeWorkOrderOperation(op, hotelId, userId)
      case 'room_block':
        return this.executeRoomBlockOperation(op, hotelId, userId)

      // Types système
      case 'notification':
        return this.executeNotificationOperation(op, hotelId, userId)
      case 'announcement':
        return this.executeAnnouncementOperation(op, hotelId, userId)

      default:
        throw new Error(`Unsupported resource type: ${op.resourceType}`)
    }
  }

  /**
   * Exécute une opération de réservation
   */
  private static async executeReservationOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: Reservation } = await import('#models/reservation')
        const reservation = await Reservation.create({
          ...op.payload,
          hotelId,
          createdBy: userId,
        })
        return { serverId: reservation.id, version: (reservation as any).version || 1 }
      }
      case 'update': {
        await this.checkVersionConflict('reservations', op.resourceId!, op.payload?.version)
        const { default: Reservation } = await import('#models/reservation')
        const existing = await Reservation.findOrFail(op.resourceId!)
        existing.merge({ ...op.payload, lastModifiedBy: userId })
        await existing.save()
        return { serverId: existing.id, version: (existing as any).version || 1 }
      }
      case 'delete': {
        const { default: Reservation } = await import('#models/reservation')
        const existing = await Reservation.findOrFail(op.resourceId!)
        existing.merge({ reservationStatus: 'Cancelled', lastModifiedBy: userId })
        await existing.save()
        return { serverId: existing.id, version: (existing as any).version || 1 }
      }
      default:
        throw new Error(`Unknown operation type: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de client
   */
  private static async executeGuestOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: Guest } = await import('#models/guest')
        const guest = await Guest.create({
          ...op.payload,
          hotelId,
          createdBy: userId,
        })
        return { serverId: guest.id, version: (guest as any).version || 1 }
      }
      case 'update': {
        await this.checkVersionConflict('guests', op.resourceId!, op.payload?.version)
        const { default: Guest } = await import('#models/guest')
        const existing = await Guest.findOrFail(op.resourceId!)
        existing.merge({ ...op.payload, lastModifiedBy: userId })
        await existing.save()
        return { serverId: existing.id, version: (existing as any).version || 1 }
      }
      default:
        throw new Error(`Unknown operation type for guest: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de transaction financière
   */
  private static async executeFolioTransactionOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: FolioService } = await import('#services/folio_service')
        const transaction = await FolioService.postTransaction({
          folioId: op.payload.folioId,
          transactionType: op.payload.transactionType,
          category: op.payload.category,
          description: op.payload.description,
          amount: op.payload.amount,
          paymentMethodId: op.payload.paymentMethodId,
          postedBy: userId,
          transactionDate: op.payload.transactionDate
            ? DateTime.fromISO(op.payload.transactionDate)
            : undefined,
        })
        return { serverId: transaction.id, version: (transaction as any).version || 1 }
      }
      default:
        throw new Error(`Unknown operation type for folio_transaction: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de chambre
   */
  private static async executeRoomOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'update': {
        const { default: Room } = await import('#models/room')
        const room = await Room.findOrFail(op.resourceId!)
        room.merge({
          status: op.payload.status ?? room.status,
          housekeepingStatus: op.payload.housekeepingStatus ?? room.housekeepingStatus,
          lastModifiedBy: userId,
        })
        await room.save()
        return { serverId: room.id, version: (room as any).version || 1 }
      }
      default:
        throw new Error(`Unknown operation type for room: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de folio
   */
  private static async executeFolioOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'update': {
        await this.checkVersionConflict('folios', op.resourceId!, op.payload?.version)
        const { default: Folio } = await import('#models/folio')
        const folio = await Folio.findOrFail(op.resourceId!)
        folio.merge({ ...op.payload, lastModifiedBy: userId })
        await folio.save()
        return { serverId: folio.id, version: (folio as any).version || 1 }
      }
      default:
        throw new Error(`Unknown operation type for folio: ${op.operationType}`)
    }
  }

  /**
   * Mapping des colonnes d'audit par table de configuration.
   * Chaque table a ses propres conventions de nommage.
   */
  private static readonly AUDIT_COLUMNS: Record<string, {
    createdBy: string
    updatedBy: string
    hotelRef: string
  }> = {
    room_types: { createdBy: 'created_by_user_id', updatedBy: 'updated_by_user_id', hotelRef: 'hotel_id' },
    rate_types: { createdBy: 'created_by_user_id', updatedBy: 'updated_by_user_id', hotelRef: 'hotel_id' },
    extra_charges: { createdBy: 'created_by_user_id', updatedBy: 'updated_by_user_id', hotelRef: 'hotel_id' },
    black_list_reasons: { createdBy: 'created_by_user_id', updatedBy: 'updated_by_user_id', hotelRef: 'hotel_id' },
    booking_sources: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
    payment_methods: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
    tax_rates: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
    discounts: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
    vip_statuses: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
    room_rates: { createdBy: 'created_by', updatedBy: 'last_modified_by', hotelRef: 'hotel_id' },
  }

  /**
   * Exécute une opération CRUD générique pour les tables de configuration
   */
  private static async executeConfigOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    const table = this.getTableName(op.resourceType)
    if (!table) {
      throw new Error(`No table mapping for resource type: ${op.resourceType}`)
    }

    // Récupérer les noms de colonnes d'audit pour cette table
    const auditCols = this.AUDIT_COLUMNS[table]

    switch (op.operationType) {
      case 'create': {
        // Nettoyer le payload des champs de suivi offline
        const cleanPayload: Record<string, any> = {}
        for (const [key, value] of Object.entries(op.payload)) {
          if (['_pending', '_operationId', '_tempId', 'id', 'version'].includes(key)) continue
          if (value === undefined) continue
          // Convertir camelCase en snake_case
          const columnName = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          cleanPayload[columnName] = value
        }

        // Ajouter les colonnes d'audit selon la table
        if (auditCols) {
          cleanPayload[auditCols.hotelRef] = hotelId
          cleanPayload[auditCols.createdBy] = userId
          cleanPayload[auditCols.updatedBy] = userId
        } else {
          // Fallback générique
          cleanPayload.hotel_id = hotelId
          cleanPayload.created_by = userId
        }

        const result = await db.insertQuery().table(table).insert(cleanPayload).returning('id')
        const serverId = typeof result[0] === 'number' ? result[0] : result[0].id
        return { serverId, version: 1 }
      }

      case 'update': {
        await this.checkVersionConflict(table, op.resourceId!, op.payload?.version)

        const cleanPayload: Record<string, any> = {}
        for (const [key, value] of Object.entries(op.payload)) {
          if (['_pending', '_operationId', '_tempId', 'id', 'version', 'createdAt', 'created_at'].includes(key)) continue
          if (value === undefined) continue
          // Convertir camelCase en snake_case
          const columnName = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          cleanPayload[columnName] = value
        }

        // Ajouter les colonnes de mise à jour
        if (auditCols) {
          cleanPayload[auditCols.updatedBy] = userId
        }
        cleanPayload.updated_at = new Date().toISOString()

        await db.from(table).where('id', op.resourceId!).update(cleanPayload)
        return { serverId: op.resourceId!, version: (op.payload?.version || 1) + 1 }
      }

      case 'delete': {
        // Soft delete si la table supporte is_deleted, sinon hard delete
        const softDeleteTables = ['room_types', 'rate_types', 'extra_charges', 'black_list_reasons']
        if (softDeleteTables.includes(table)) {
          const deletePayload: Record<string, any> = {
            is_deleted: true,
            deleted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
          if (auditCols) {
            deletePayload[auditCols.updatedBy] = userId
          }
          await db.from(table).where('id', op.resourceId!).update(deletePayload)
        } else {
          await db.from(table).where('id', op.resourceId!).delete()
        }
        return { serverId: op.resourceId!, version: 0 }
      }

      default:
        throw new Error(`Unknown operation type for config: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de work order
   */
  private static async executeWorkOrderOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: WorkOrder } = await import('#models/work_order')
        const orderNumber = WorkOrder.generateOrderNumber()
        const workOrder = await WorkOrder.create({
          ...op.payload,
          orderNumber: op.payload.orderNumber || orderNumber,
          hotelId,
          createdAt: DateTime.now(),
          updatedAt: DateTime.now(),
        })
        return { serverId: workOrder.id, version: (workOrder as any).version || 1 }
      }
      case 'update': {
        await this.checkVersionConflict('work_orders', op.resourceId!, op.payload?.version)
        const { default: WorkOrder } = await import('#models/work_order')
        const existing = await WorkOrder.findOrFail(op.resourceId!)
        existing.merge(op.payload)
        await existing.save()
        return { serverId: existing.id, version: (existing as any).version || 1 }
      }
      case 'delete': {
        const { default: WorkOrder } = await import('#models/work_order')
        const existing = await WorkOrder.findOrFail(op.resourceId!)
        await existing.delete()
        return { serverId: op.resourceId!, version: 0 }
      }
      default:
        throw new Error(`Unknown operation type for work_order: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de room block
   */
  private static async executeRoomBlockOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: RoomBlock } = await import('#models/room_block')
        const roomBlock = await RoomBlock.create({
          ...op.payload,
          hotelId,
          blockedByUserId: userId,
        })
        return { serverId: roomBlock.id, version: (roomBlock as any).version || 1 }
      }
      case 'update': {
        await this.checkVersionConflict('room_blocks', op.resourceId!, op.payload?.version)
        const { default: RoomBlock } = await import('#models/room_block')
        const existing = await RoomBlock.findOrFail(op.resourceId!)
        existing.merge(op.payload)
        await existing.save()
        return { serverId: existing.id, version: (existing as any).version || 1 }
      }
      case 'delete': {
        const { default: RoomBlock } = await import('#models/room_block')
        const existing = await RoomBlock.findOrFail(op.resourceId!)
        await existing.delete()
        return { serverId: op.resourceId!, version: 0 }
      }
      default:
        throw new Error(`Unknown operation type for room_block: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération de notification
   */
  private static async executeNotificationOperation(
    op: SyncOperationInput,
    hotelId: number,
    userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: Notification } = await import('#models/notification')
        const notification = await Notification.create({
          ...op.payload,
          hotelId,
          createdBy: userId,
        })
        return { serverId: notification.id, version: 1 }
      }
      case 'update': {
        const { default: Notification } = await import('#models/notification')
        const existing = await Notification.findOrFail(op.resourceId!)
        existing.merge(op.payload)
        await existing.save()
        return { serverId: existing.id, version: 1 }
      }
      case 'delete': {
        const { default: Notification } = await import('#models/notification')
        const existing = await Notification.findOrFail(op.resourceId!)
        await existing.delete()
        return { serverId: op.resourceId!, version: 0 }
      }
      default:
        throw new Error(`Unknown operation type for notification: ${op.operationType}`)
    }
  }

  /**
   * Exécute une opération d'annonce
   */
  private static async executeAnnouncementOperation(
    op: SyncOperationInput,
    _hotelId: number,
    _userId: number
  ): Promise<{ serverId: number; version: number }> {
    switch (op.operationType) {
      case 'create': {
        const { default: Announcement } = await import('#models/announcement')
        const announcement = await Announcement.create({
          ...op.payload,
          createdAt: DateTime.now(),
        })
        return { serverId: Number(announcement.id), version: 1 }
      }
      case 'update': {
        const { default: Announcement } = await import('#models/announcement')
        const existing = await Announcement.findOrFail(op.resourceId!)
        existing.merge(op.payload)
        await existing.save()
        return { serverId: Number(existing.id), version: 1 }
      }
      case 'delete': {
        const { default: Announcement } = await import('#models/announcement')
        const existing = await Announcement.findOrFail(op.resourceId!)
        await existing.delete()
        return { serverId: Number(op.resourceId!), version: 0 }
      }
      default:
        throw new Error(`Unknown operation type for announcement: ${op.operationType}`)
    }
  }

  /**
   * Récupère les changements depuis le serveur (PULL)
   */
  static async pullChanges(input: PullRequest): Promise<{
    changes: PullChanges
    serverTime: string
    checkpoint: number
  }> {
    const changes: PullChanges = {}
    const fromVersion = input.lastSyncVersion

    const typesToFetch = input.resourceTypes.length > 0
      ? input.resourceTypes
      : ['reservation', 'guest', 'room', 'folio', 'folio_transaction']

    for (const resourceType of typesToFetch) {
      changes[resourceType] = await this.getChanges(resourceType, fromVersion, input.hotelId)
    }

    const newVersion = await this.nextVersion()

    // Mettre à jour le checkpoint
    await SyncCheckpoint.updateOrCreate(
      { hotelId: input.hotelId, userId: input.userId, deviceId: input.deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: newVersion }
    )

    return {
      changes,
      serverTime: DateTime.now().toISO()!,
      checkpoint: newVersion,
    }
  }

  /**
   * Récupère les changements d'un type de ressource depuis une version donnée
   */
  private static async getChanges(
    resourceType: string,
    fromVersion: number,
    hotelId: number
  ): Promise<{ created: any[]; updated: any[]; deleted: { id: number; deletedAt: string }[] }> {
    const table = this.getTableName(resourceType)
    if (!table) return { created: [], updated: [], deleted: [] }

    try {
      // Récupérer les enregistrements modifiés depuis la date du dernier checkpoint
      const checkpoint = await SyncCheckpoint.query()
        .where('hotel_id', hotelId)
        .where('resource_type', resourceType)
        .orderBy('last_sync_at', 'desc')
        .first()

      const lastSyncDate = checkpoint?.lastSyncAt?.toISO() || '1970-01-01T00:00:00.000Z'

      const records = await db.rawQuery(
        `SELECT * FROM "${table}"
         WHERE hotel_id = ? AND updated_at > ?
         ORDER BY updated_at ASC`,
        [hotelId, lastSyncDate]
      )

      const created: any[] = []
      const updated: any[] = []
      const deleted: { id: number; deletedAt: string }[] = []

      for (const row of records.rows) {
        if (row.is_deleted || row.status === 'deleted' || row.is_deleted === true) {
          deleted.push({ id: row.id, deletedAt: row.updated_at || row.deleted_at })
        } else if (row.created_at === row.updated_at) {
          created.push(row)
        } else {
          updated.push(row)
        }
      }

      return { created, updated, deleted }
    } catch (error) {
      logger.warn(`Failed to fetch changes for ${resourceType}: ${String(error)}`)
      return { created: [], updated: [], deleted: [] }
    }
  }

  /**
   * Vérifie les conflits de version
   */
  private static async checkVersionConflict(
    table: string,
    resourceId: number,
    clientVersion?: number
  ): Promise<void> {
    if (!clientVersion) return

    const result = await db.rawQuery(
      `SELECT * FROM "${table}" WHERE id = ?`,
      [resourceId]
    )

    if (result.rows.length === 0) {
      throw new Error(`Resource not found: ${table}:${resourceId}`)
    }

    const serverVersion = result.rows[0].version
    if (serverVersion > clientVersion) {
      const error = new Error('Version conflict detected') as any
      error.serverVersion = serverVersion
      error.serverData = result.rows[0]
      error.code = 'VERSION_CONFLICT'
      throw error
    }
  }

  /**
   * Détecte si une erreur est un conflit de version
   */
  private static isConflictError(error: any): boolean {
    return error.code === 'VERSION_CONFLICT'
  }

  /**
   * Détermine si une erreur est réessayable
   */
  private static isRetryable(error: any): boolean {
    const nonRetryable = [
      'VALIDATION_ERROR',
      'AUTHORIZATION_ERROR',
      'NOT_FOUND',
      'INVALID_STATE',
    ]
    return !nonRetryable.includes(error.code) && error.status !== 400 && error.status !== 404 && error.status !== 403
  }

  /**
   * Crée un enregistrement de conflit
   */
  private static async createConflict(
    op: SyncOperationInput,
    error: any,
    hotelId: number
  ): Promise<SyncConflict> {
    const syncOp = await SyncOperation.findBy('operation_id', op.operationId)

    return SyncConflict.create({
      syncOperationId: syncOp?.id || null,
      hotelId,
      resourceType: op.resourceType,
      resourceId: op.resourceId || 0,
      clientVersion: op.payload?.version || 1,
      serverVersion: error.serverVersion,
      clientData: op.payload,
      serverData: error.serverData,
      resolution: 'pending',
    })
  }

  /**
   * Résout un conflit
   */
  static async resolveConflict(
    conflictId: number,
    resolution: 'client_wins' | 'server_wins' | 'merged',
    resolvedBy: number
  ): Promise<void> {
    const conflict = await SyncConflict.findOrFail(conflictId)

    if (resolution === 'client_wins') {
      // Appliquer les données du client en mettant à jour les colonnes individuelles
      const table = this.getTableName(conflict.resourceType)
      if (table && conflict.clientData && typeof conflict.clientData === 'object') {
        const clientData = conflict.clientData as Record<string, any>

        // Exclure les champs techniques qui ne doivent pas être écrits en base
        const excludeFields = [
          'id', 'version', 'created_at', 'createdAt',
          '_pending', '_operationId', '_tempId',
          'serverTimestamp', 'clientTimestamp',
          'createdBy', 'created_by', 'created_by_user_id',
          'updatedAt', 'updated_at',
          'hotelId', 'hotel_id',
        ]

        const setClauses: string[] = []
        const params: any[] = []

        for (const [key, value] of Object.entries(clientData)) {
          if (excludeFields.includes(key)) continue
          // Ignorer les champs undefined
          if (value === undefined) continue

          // Convertir camelCase en snake_case pour les noms de colonnes
          const columnName = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
          setClauses.push(`"${columnName}" = ?`)
          params.push(value !== null && value !== undefined ? value : null)
        }

        if (setClauses.length > 0) {
          // Ajouter les champs de version et mise à jour
          setClauses.push('"version" = COALESCE("version", 0) + 1')
          setClauses.push('"updated_at" = NOW()')

          params.push(conflict.resourceId)

          await db.rawQuery(
            `UPDATE "${table}" SET ${setClauses.join(', ')} WHERE "id" = ?`,
            params
          )
        }
      }
    }
    // Si 'server_wins', ne rien faire (les données serveur sont conservées)
    // 'merged' non implémenté — nécessite une logique métier par type

    conflict.resolution = resolution
    conflict.resolvedBy = resolvedBy
    conflict.resolvedAt = DateTime.now()
    await conflict.save()
  }

  /**
   * Chargement initial complet pour un nouveau device
   * 
   * @param dateFrom - Date ISO (YYYY-MM-DD) à partir de laquelle charger les réservations.
   *                   Par défaut : 15 jours avant la date courante.
   */
  static async initialLoad(
    hotelId: number,
    userId: number,
    deviceId: string,
    dateFrom?: string
  ): Promise<{
    data: Record<string, any[]>
    checkpoint: number
  }> {
    const { default: Hotel } = await import('#models/hotel')
    const { default: RoomType } = await import('#models/room_type')
    const { default: Room } = await import('#models/room')
    const { default: RateType } = await import('#models/rate_type')
    const { default: RoomRate } = await import('#models/room_rate')
    const { default: ExtraCharge } = await import('#models/extra_charge')
    const { default: TaxRate } = await import('#models/tax_rate')
    const { default: Discount } = await import('#models/discount')
    const { default: Reservation } = await import('#models/reservation')
    const { default: GuestModel } = await import('#models/guest')
    const { default: Folio } = await import('#models/folio')
    const { default: FolioTransaction } = await import('#models/folio_transaction')
    const { default: BookingSource } = await import('#models/booking_source')
    const { default: VipStatus } = await import('#models/vip_status')
    const { default: BlackListReason } = await import('#models/black_list_reason')
    const { default: WorkOrder } = await import('#models/work_order')
    const { default: RoomBlock } = await import('#models/room_block')
    const { default: Notification } = await import('#models/notification')
    const { default: Announcement } = await import('#models/announcement')
    const { default: ReservationType } = await import('#models/reservation_type')
    const { default: ReservationRoom } = await import('#models/reservation_room')

    // ── Déterminer la date de début ─────────────────────────────
    // Si dateFrom est fourni, on l'utilise; sinon 15 jours en arrière
    const fromDate = dateFrom
      ? DateTime.fromISO(dateFrom)
      : DateTime.now().minus({ days: 30 })

    const fromDateSQL = fromDate.toSQL()

    // ── Hôtel avec relations ────────────────────────────────────
    const hotel = await Hotel.query()
      .where('id', hotelId)
      .preload('roomTypes', (q) => q.preload('rooms'))
      .preload('paymentMethods')
      .firstOrFail()

    // ── Réservations : de dateFrom jusqu'à l'infini ─────────────
    // Inclut toutes les réservations avec une date d'arrivée >= dateFrom
    // ou une date de départ >= dateFrom, pour couvrir les séjours en cours
    const recentReservations = await Reservation.query()
      .where('hotelId', hotelId)
      .where((q) => {
        q.where('arrived_date', '>=', fromDateSQL!)
          .orWhere('depart_date', '>=', fromDateSQL!)
      })
      .preload('guest')
      .preload('reservationRooms', (q) => q.preload('room'))
      .preload('folios', (q) => q.preload('transactions'))

    // ── Clients (guests) : tous pour cet hôtel ──────────────────
    const guests = await GuestModel.query()
      .where('hotelId', hotelId)
      .limit(2000)
      .orderBy('updated_at', 'desc')

    // ── Chambres et types de chambres ───────────────────────────
    const allRoomTypes = await RoomType.query().where('hotel_id', hotelId)
    const allRooms = await Room.query().where('hotel_id', hotelId)

    // ── Tarifs : à partir de dateFrom ───────────────────────────
    const rates = await RoomRate.query()
      .whereIn('room_type_id', hotel.roomTypes.map((rt) => rt.id))
      .where('rate_date', '>=', fromDateSQL!)

    // ── Folios : ouverts ou mis à jour récemment ────────────────
    const folios = await Folio.query()
      .where('hotelId', hotelId)
      .where((q) => {
        q.whereNull('closedDate')
          .orWhere('updatedAt', '>=', fromDateSQL!)
      })

    // ── Transactions : toutes les transactions des folios ouverts ──
    // On récupère toutes les transactions des 30 derniers jours + des folios ouverts
    const thirtyDaysAgo = DateTime.now().minus({ days: 30 }).toSQL()
    const recentTransactions = await FolioTransaction.query()
      .whereIn('folio_id', folios.map((f) => f.id))
      .where('transaction_date', '>=', thirtyDaysAgo!)
      .orderBy('transaction_date', 'desc')

    // ── Données de référence ────────────────────────────────────
    const rateTypes = await RateType.query().where('hotel_id', hotelId)
    const taxRates = await TaxRate.query().where('hotel_id', hotelId)
    const extraCharges = await ExtraCharge.query().where('hotel_id', hotelId)
    const discounts = await Discount.query().where('hotel_id', hotelId)
    const bookingSources = await BookingSource.query().where('hotel_id', hotelId)
    const workOrders = await WorkOrder.query().where('hotel_id', hotelId)
    const roomBlocks = await RoomBlock.query().where('hotel_id', hotelId)
    const vipStatuses = await VipStatus.query().where('hotel_id', hotelId)
    const blackListReasons = await BlackListReason.query().where('hotel_id', hotelId)
    const reservationTypes = await ReservationType.query().where('hotel_id', hotelId)
    const reservationRooms = await ReservationRoom.query()
      .whereIn('reservation_id', recentReservations.map((r) => r.id))
      
    const notifications = await Notification.query().where('hotel_id', hotelId).where('recipient_type', 'STAFF')
    const announcements = await Announcement.query().where('is_active', true)

    // ── Checkpoint initial ──────────────────────────────────────
    const version = await this.nextVersion()
    await SyncCheckpoint.updateOrCreate(
      { hotelId, userId, deviceId, resourceType: '*' },
      { lastSyncAt: DateTime.now(), lastVersion: version }
    )

    return {
      data: {
        hotel: [hotel.serialize()],
        roomTypes: allRoomTypes.map((r) => r.serialize()),
        rooms: allRooms.map((r) => r.serialize()),
        paymentMethods: hotel.paymentMethods.map((pm) => pm.serialize()),
        rateTypes: rateTypes.map((r) => r.serialize()),
        rates: rates.map((r) => r.serialize()),
        taxRates: taxRates.map((r) => r.serialize()),
        extraCharges: extraCharges.map((r) => r.serialize()),
        discounts: discounts.map((r) => r.serialize()),
        bookingSources: bookingSources.map((r) => r.serialize()),
        workOrders: workOrders.map((w) => w.serialize()),
        roomBlocks: roomBlocks.map((b) => b.serialize()),
        vipStatuses: vipStatuses.map((v) => v.serialize()),
        blackListReasons: blackListReasons.map((b) => b.serialize()),
      notifications: notifications.map((n) => n.serialize()),
      announcements: announcements.map((a) => a.serialize()),
        reservationTypes: reservationTypes.map((r) => r.serialize()),
        reservationRooms: reservationRooms.map((r) => r.serialize()),
        reservations: recentReservations.map((r) => r.serialize()),
        guests: guests.map((g) => g.serialize()),
        folios: folios.map((f) => f.serialize()),
        folioTransactions: recentTransactions.map((t) => t.serialize()),
      },
      checkpoint: version,
    }
  }
}
