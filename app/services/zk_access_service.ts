import ZKLib from 'node-zklib'
import Door from '#models/door'
import DoorAccessLog from '#models/door_access_log'
import { DateTime } from 'luxon'
import type {
  ZKConnectionOptions,
  ZKUserInfo,
  ZKOperationResult,
  ZKSyncConfig,
} from '../types/zk_types.js'

/**
 * Service de gestion des terminaux de contrôle d'accès ZKTeco
 *
 * Fonctionnalités principales:
 * - Connexion et gestion des terminaux
 * - Ajout/Suppression d'utilisateurs
 * - Ouverture des portes à distance
 * - Synchronisation des logs
 * - Gestion du temps système
 */
export default class ZkAccessService {
  private connectionTimeout: number = 10000 // 10 secondes

  /**
   * Crée une connexion à un terminal ZKTeco
   * @private
   */
  private async connect(door: Door): Promise<ZKLib> {
    const options: ZKConnectionOptions = {
      ip: door.ipAddress,
      port: door.port,
      timeout: this.connectionTimeout,
      inport: 4000,
    }

    const zk = new ZKLib(options.ip, options.port, options.timeout, options.inport)

    try {
      await zk.createSocket()
      console.log(`Connection established with terminal ${door.name} (${door.fullAddress})`)
      return zk
    } catch (error) {
      console.error(`Failed to connect to terminal ${door.name}:`, error)
      throw new Error(
        `Failed to connect to the terminal ${door.name} (${door.fullAddress}): ${error.message}`
      )
    }
  }

  /**
   * Déconnecte proprement du terminal
   * @private
   */
  private async disconnect(zk: ZKLib): Promise<void> {
    try {
      await zk.disconnect()
      console.log('Disconnected from terminal successfully')
    } catch (error) {
      console.warn('Error during terminal disconnection:', error.message)
    }
  }

  /**
   * Teste la connectivité avec un terminal
   */
  public async testConnection(doorId: number): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)

    try {
      const zk = await this.connect(door)
      const info = await zk.getInfo()
      await this.disconnect(zk)

      // Mettre à jour la date de dernière synchronisation
      door.lastSyncedAt = DateTime.now()
      await door.save()

      return {
        success: true,
        message: `Connection successful with ${door.name}`,
        data: info,
      }
    } catch (error) {
      return {
        success: false,
        message: error.message,
      }
    }
  }

  /**
   * Accorde l'accès à un utilisateur (Check-in)
   *
   * @param doorId - ID de la porte
   * @param userInfo - Informations de l'utilisateur
   */
  public async grantAccess(doorId: number, userInfo: ZKUserInfo): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)

    if (!door.isActive) {
      return {
        success: false,
        message: `The terminal ${door.name} is disabled`,
      }
    }

    const zk = await this.connect(door)

    try {
      // Ajouter l'utilisateur au terminal

      await zk.setUser(
        parseInt(userInfo.userId), // User ID (numérique)
        userInfo.password || '123456', // Password (par défaut '123456')
        userInfo.name, // Nom
        userInfo.cardNumber || 0, // Card number
        userInfo.role || 0, // Rôle
      )

      console.log(`Access granted to ${userInfo.name} at ${door.name}`)

      return {
        success: true,
        message: `Access granted to ${userInfo.name}`,
        data: { userId: userInfo.userId, doorName: door.name },
      }
    } catch (error) {
      console.error(`Failed to grant access to ${userInfo.name}:`, error)
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Révoque l'accès d'un utilisateur (Check-out)
   *
   * @param doorId - ID de la porte
   * @param userId - ID de l'utilisateur sur le terminal
   */
  public async revokeAccess(doorId: number, userId: string): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      // Supprimer l'utilisateur du terminal
      await zk.deleteUser(parseInt(userId))

      console.log(`Access revoked for user ${userId} at ${door.name}`)

      return {
        success: true,
        message: `Access revoked for user ${userId}`,
      }
    } catch (error) {
      console.error(`Failed to revoke access for user ${userId}:`, error)
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Ouvre la porte à distance (déverrouillage temporaire)
   *
   * @param doorId - ID de la porte
   * @param duration - Durée d'ouverture en secondes (par défaut 10 secondes)
   */
  public async unlockDoor(doorId: number, duration: number = 10): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      await zk.unlock(duration)

      console.log(`Door ${door.name} unlocked for ${duration} seconds`)

      return {
        success: true,
        message: `Door ${door.name} unlocked`,
        data: { duration },
      }
    } catch (error) {
      console.error(`Error during unlocking:`, error)
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Récupère les logs d'accès depuis le terminal et les enregistre en base
   *
   * @param doorId - ID de la porte
   * @param clearAfterSync - Effacer les logs du terminal après synchronisation
   */
  public async syncLogs(doorId: number, clearAfterSync: boolean = false): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      // Récupérer tous les logs d'accès
      const logs = await zk.getAttendances()

      console.log(`${logs.data.length} logs retrieved from ${door.name}`)

      let newLogsCount = 0

      // Enregistrer chaque log en base de données
      for (const log of logs.data) {
        // Vérifier si le log existe déjà pour éviter les doublons
        const exists = await DoorAccessLog.query()
          .where('door_id', door.id)
          .where('user_id_on_device', log.deviceUserId)
          .where('access_time', DateTime.fromJSDate(log.recordTime).toJSDate())
          .first()

        if (!exists) {
          await DoorAccessLog.create({
            doorId: door.id,
            userIdOnDevice: log.deviceUserId,
            verifyMode: log.verifyMode,
            inOutStatus: log.inOutMode,
            accessTime: DateTime.fromJSDate(log.recordTime),
            accessGranted: true, // Par défaut, si c'est dans les logs c'est que l'accès a été accordé
          })
          newLogsCount++
        }
      }

      // Effacer les logs du terminal si demandé
      if (clearAfterSync && logs.data.length > 0) {
        await zk.clearAttendance()
        console.log(`Logs cleared from terminal ${door.name}`)
      }

      // Mettre à jour la date de dernière synchronisation
      door.lastSyncedAt = DateTime.now()
      await door.save()

      return {
        success: true,
        message: `${newLogsCount} new logs synchronized`,
        data: { totalLogs: logs.data.length, newLogs: newLogsCount },
      }
    } catch (error) {
      console.error(`Failed to synchronize logs from terminal ${door.name}:`, error)
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Synchronise l'heure du terminal avec le serveur
   */
  public async syncTime(doorId: number): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      const now = new Date()
      await zk.setTime(now)

      console.log(`Time synchronized for ${door.name}`)

      return {
        success: true,
        message: `Time of terminal synchronized`,
        data: { time: now },
      }
    } catch (error) {
      console.error(`Error during time synchronization:`, error)
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Récupère les informations du terminal
   */
  public async getDeviceInfo(doorId: number): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      const info = await zk.getInfo()

      return {
        success: true,
        data: info,
      }
    } catch (error) {
      return {
        success: false,
        message: `Erreur: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Efface tous les utilisateurs d'un terminal
   *  ATTENTION: Cette action est irréversible
   */
  public async clearAllUsers(doorId: number): Promise<ZKOperationResult> {
    const door = await Door.findOrFail(doorId)
    const zk = await this.connect(door)

    try {
      await zk.clearAllUser()

      console.log(`All users cleared from terminal ${door.name}`)

      return {
        success: true,
        message: `All users cleared from terminal ${door.name}`,
      }
    } catch (error) {
      return {
        success: false,
        message: `Error: ${error.message}`,
      }
    } finally {
      await this.disconnect(zk)
    }
  }

  /**
   * Synchronisation complète d'un terminal
   */
  public async fullSync(doorId: number, config?: ZKSyncConfig): Promise<ZKOperationResult> {
    const results = {
      time: { success: false },
      logs: { success: false },
      info: { success: false },
    }

    try {
      // Synchroniser l'heure
      if (config?.syncTime !== false) {
        results.time = await this.syncTime(doorId)
      }

      // Synchroniser les logs
      if (config?.syncLogs !== false) {
        results.logs = await this.syncLogs(doorId, config?.clearLogsAfterSync || false)
      }

      // Récupérer les infos
      results.info = await this.getDeviceInfo(doorId)

      const allSuccess = Object.values(results).every((r) => r.success)

      return {
        success: allSuccess,
        message: allSuccess ? 'Full synchronization successful' : 'Partial synchronization',
        data: results,
      }
    } catch (error) {
      return {
        success: false,
        message: `Error during full synchronization: ${error.message}`,
        data: results,
      }
    }
  }
}
