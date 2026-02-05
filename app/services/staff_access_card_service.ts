// app/services/staff_access_card_service.ts

import StaffAccessCard from '#models/staff_access_card'
import Door from '#models/door'
import ZkIntegrationService from '#services/zk_integration_service'
import { DateTime } from 'luxon'
import Logger from '@adonisjs/core/services/logger'

export default class StaffAccessCardService {
  private zkIntegrationService: ZkIntegrationService

  constructor() {
    this.zkIntegrationService = new ZkIntegrationService()
  }

  /**
   * Créer un badge Master (accès toutes portes)
   * Supporte maintenant les staff AVEC ou SANS compte user
   */
  public async createMasterCard(params: {
    // Option 1: Staff avec compte user
    userId?: number

    // Option 2: Staff sans compte user (standalone)
    staffFirstName?: string
    staffLastName?: string
    staffPosition?: string
    staffPhoneNumber?: string
    staffEmployeeId?: string

    // Commun
    cardUid: string
    issuedBy: number
    validFrom?: DateTime
    validUntil?: DateTime
    notes?: string
  }) {
    // Validation: au moins userId OU (firstName + lastName)
    if (!params.userId && (!params.staffFirstName || !params.staffLastName)) {
      throw new Error('Either userId or staff name (firstName + lastName) is required')
    }

    // Générer userIdOnDevice
    let userIdOnDevice: string
    let staffName: string

    if (params.userId) {
      // Staff avec compte user
      userIdOnDevice = `STAFF-USER-${params.userId}`

      // Charger le user pour récupérer son nom
      const { default: User } = await import('#models/user')
      const user = await User.findOrFail(params.userId)
      staffName = `${user.firstName} ${user.lastName}`
    } else {
      // Staff standalone (sans compte user)
      // Utiliser l'employeeId ou générer un ID unique
      const uniqueId = params.staffEmployeeId || `STANDALONE-${Date.now()}`
      userIdOnDevice = `STAFF-${uniqueId}`
      staffName = `${params.staffFirstName} ${params.staffLastName}`
    }

    // Créer l'enregistrement en base
    const card = await StaffAccessCard.create({
      userId: params.userId || null,
      staffFirstName: params.staffFirstName || null,
      staffLastName: params.staffLastName || null,
      staffPosition: params.staffPosition || null,
      staffPhoneNumber: params.staffPhoneNumber || null,
      cardUid: params.cardUid,
      userIdOnDevice,
      accessType: 'master',
      status: 'active',
      validFrom: params.validFrom || null,
      validUntil: params.validUntil || null,
      notes: params.notes || null,
      issuedBy: params.issuedBy,
      issuedAt: DateTime.now(),
      syncStatus: 'pending',
    })

    // Synchroniser avec TOUS les terminaux
    const result = await this.zkIntegrationService.grantStaffMasterAccess(
      params.userId || card.id, // Utiliser card.id si pas de userId
      staffName,
      params.cardUid
    )

    // Mettre à jour le statut de sync
    if (result.success) {
      card.syncStatus = 'synced'
      card.syncedDoorsCount = result.details.filter((d) => d.success).length
      card.lastSyncedAt = DateTime.now()
    } else {
      card.syncStatus = 'failed'
      card.syncedDoorsCount = result.details.filter((d) => d.success).length
    }

    await card.save()

    return { card, syncResult: result }
  }

  /**
   * Créer un badge à accès limité (certaines portes uniquement)
   */
  public async createLimitedCard(params: {
    userId?: number
    staffFirstName?: string
    staffLastName?: string
    staffPosition?: string
    staffPhoneNumber?: string
    staffEmployeeId?: string
    cardUid: string
    doorIds: number[]
    issuedBy: number
    validFrom?: DateTime
    validUntil?: DateTime
    notes?: string
  }) {
    // Validation
    if (!params.userId && (!params.staffFirstName || !params.staffLastName)) {
      throw new Error('Either userId or staff name is required')
    }

    let userIdOnDevice: string
    let staffName: string

    if (params.userId) {
      userIdOnDevice = `STAFF-USER-${params.userId}`
      const { default: User } = await import('#models/user')
      const user = await User.findOrFail(params.userId)
      staffName = `${user.firstName} ${user.lastName}`
    } else {
      const uniqueId = params.staffEmployeeId || `STANDALONE-${Date.now()}`
      userIdOnDevice = `STAFF-${uniqueId}`
      staffName = `${params.staffFirstName} ${params.staffLastName}`
    }

    const card = await StaffAccessCard.create({
      userId: params.userId || null,
      staffFirstName: params.staffFirstName || null,
      staffLastName: params.staffLastName || null,
      staffPosition: params.staffPosition || null,
      staffPhoneNumber: params.staffPhoneNumber || null,
      cardUid: params.cardUid,
      userIdOnDevice,
      accessType: 'limited',
      status: 'active',
      validFrom: params.validFrom || null,
      validUntil: params.validUntil || null,
      notes: params.notes || null,
      issuedBy: params.issuedBy,
      issuedAt: DateTime.now(),
      syncStatus: 'pending',
    })

    const doorSyncResults: { [doorId: number]: { success: boolean; grantedAt: DateTime | null } } = {}

  for (const doorId of params.doorIds) {
    try {
      const door = await Door.findOrFail(doorId)


      const result = await this.zkIntegrationService.grantStaffAccessToDoor(
        door,
        params.userId || card.id,
        staffName,
        params.cardUid
      )

      doorSyncResults[doorId] = {
        success: result.success,
        grantedAt: result.success ? DateTime.now() : null
      }
    } catch (error) {
      Logger.error(`Erreur sync door ${doorId}:`, error)
      doorSyncResults[doorId] = { success: false, grantedAt: null }
    }
  }

  // Attacher les portes avec granted_at
  const pivotData: { [doorId: number]: { granted_at: DateTime } } = {}

  for (const doorId of params.doorIds) {
    pivotData[doorId] = {
      granted_at: doorSyncResults[doorId].grantedAt || DateTime.now()
    }
  }

  await card.related('doors').attach(pivotData)

  // Compter les succès
  const successCount = Object.values(doorSyncResults).filter(r => r.success).length

  card.syncStatus = successCount === params.doorIds.length ? 'synced' : 'failed'
  card.syncedDoorsCount = successCount
  card.lastSyncedAt = DateTime.now()
  await card.save()

  return card
}

  /**
   * Révoquer un badge
   */
  public async revokeCard(cardId: number, revokedBy: number, reason?: string) {
    const card = await StaffAccessCard.findOrFail(cardId)

    if (card.status === 'revoked') {
      throw new Error('Badge déjà révoqué')
    }

    // Récupérer le nom du staff (avec ou sans user)
    const staffName = card.getStaffName()

    // Révoquer sur tous les terminaux
    const result = await this.zkIntegrationService.revokeStaffMasterAccess(
      card.userId || card.id,
      staffName
    )

    // Mettre à jour le statut
    card.status = 'revoked'
    card.revokedBy = revokedBy
    card.revokedAt = DateTime.now()
    card.notes = reason ? `${card.notes || ''}\nRévoqué: ${reason}` : card.notes
    card.syncedDoorsCount = 0
    await card.save()

    return { card, syncResult: result }
  }

  /**
 * Re-synchroniser une carte existante avec tous les terminaux
 */
public async syncCard(cardId: number) {
  const card = await StaffAccessCard.query()
    .where('id', cardId)
    .preload('user')
    .preload('doors')
    .firstOrFail()

  if (card.status === 'revoked') {
    throw new Error('Cannot sync a revoked card. Please create a new card instead.')
  }

  // Récupérer le nom du staff
  const staffName = card.user
    ? `${card.user.firstName} ${card.user.lastName}`
    : `${card.staffFirstName} ${card.staffLastName}`

  let result

  // Synchroniser selon le type d'accès
  if (card.accessType === 'master' || card.accessType === 'temporary') {
    // Re-synchroniser avec TOUS les terminaux
    result = await this.zkIntegrationService.grantStaffMasterAccess(
      card.userId || card.id,
      staffName,
      card.cardUid
    )

    // Mettre à jour le statut
    card.syncStatus = result.success ? 'synced' : 'failed'
    card.syncedDoorsCount = result.details.filter((d) => d.success).length
    card.lastSyncedAt = DateTime.now()

  } else if (card.accessType === 'limited') {
    // Re-synchroniser uniquement avec les portes assignées
    const doorIds = card.doors.map(d => d.id)
    let successCount = 0

    for (const door of card.doors) {
      try {
        const syncResult = await this.zkIntegrationService.grantStaffAccessToDoor(
          door,
          card.userId || card.id,
          staffName,
          card.cardUid
        )

        if (syncResult.success) successCount++
      } catch (error) {
        Logger.error(`Erreur sync door ${door.id}:`, error)
      }
    }

    card.syncStatus = successCount === doorIds.length ? 'synced' : 'failed'
    card.syncedDoorsCount = successCount
    card.lastSyncedAt = DateTime.now()

    result = {
      success: successCount > 0,
      totalDoors: doorIds.length,
      syncedDoors: successCount,
      failedDoors: doorIds.length - successCount
    }
  }

  await card.save()

  return { card, syncResult: result }
}

/**
 * Suspendre temporairement un badge (avec sync terminaux)
 */
public async suspendCard(cardId: number, suspendedBy: number, reason?: string) {
  const card = await StaffAccessCard.findOrFail(cardId)

  if (card.status === 'revoked') {
    throw new Error('Cannot suspend a revoked card')
  }

  const staffName = card.getStaffName()

  //  Retirer des terminaux (comme revoke)
  const result = await this.zkIntegrationService.revokeStaffMasterAccess(
    card.userId || card.id,
    staffName
  )

  //
  card.status = 'suspended'
  // card.suspendedBy = suspendedBy // Ajoutez ce champ dans la table
  // card.suspendedAt = DateTime.now() // Ajoutez ce champ dans la table
  // card.suspensionReason = reason || null // Ajoutez ce champ dans la table
  card.syncedDoorsCount = 0
  await card.save()

  return { card, syncResult: result }
}

/**
 * Réactiver un badge suspendu
 */
// public async reactivateCard(cardId: number) {
//   const card = await StaffAccessCard.findOrFail(cardId)

//   if (card.status !== 'suspended') {
//     throw new Error('Only suspended cards can be reactivated')
//   }

//   const staffName = card.getStaffName()

//   // 👇 Re-synchroniser avec les terminaux
//   let result
//   if (card.accessType === 'master' || card.accessType === 'temporary') {
//     result = await this.zkIntegrationService.grantStaffMasterAccess(
//       card.userId || card.id,
//       staffName,
//       card.cardUid
//     )
//   } else if (card.accessType === 'limited') {
//     // Re-sync avec les portes limitées
//     // ... (code similaire à createLimitedCard)
//   }

//   card.status = 'active'
//   // card.suspendedBy = null
//   // card.suspendedAt = null
//   // card.suspensionReason = null
//   card.lastSyncedAt = DateTime.now()
//   await card.save()

//   return { card, syncResult: result }
// }
}
