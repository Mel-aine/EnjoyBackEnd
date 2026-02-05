// app/tasks/access_expiration_task.ts

import cron from 'node-cron'
import ReservationRoom from '#models/reservation_room'
import Reservation from '#models/reservation'
import { DateTime } from 'luxon'
import Logger from '@adonisjs/core/services/logger'
import ZkIntegrationService from '#services/zk_integration_service'

export default class AccessExpirationTask {
  private zkIntegrationService: ZkIntegrationService
  private isRunning: boolean = false

  constructor() {
    this.zkIntegrationService = new ZkIntegrationService()
  }

  public start() {
    Logger.info('Démarrage de la tâche de révocation des accès expirés...')
    this.scheduleAccessExpiration()
    Logger.info('Tâche de révocation démarrée (toutes les minutes)')
  }

  private scheduleAccessExpiration() {
    cron.schedule('* * * * *', async () => {
      if (this.isRunning) {
        Logger.debug('[AccessExpiration] Vérification déjà en cours, ignorée')
        return
      }

      this.isRunning = true
      Logger.info('[AccessExpiration] Vérification des accès expirés...')

      try {
        const now = DateTime.now().toUTC()


        const expiredRooms = await ReservationRoom.query()
          .where('status', 'checked_in')
          .where('access_status', 'granted')
          .whereNotNull('room_id')
          .whereNotNull('door_id')
          .whereNotNull('user_id_on_device')
          .whereNotNull('checkout_time')
          .where('checkout_time', '<', now.toSQL({ includeOffset: false }))
          .preload('reservation', (q) => q.preload('guest'))
          .preload('room')
          .preload('door')

        if (expiredRooms.length === 0) {
          Logger.debug('[AccessExpiration] Aucun accès expiré')
          this.isRunning = false
          return
        }

        Logger.warn(
          `[AccessExpiration]  ${expiredRooms.length} accès expiré(s) détecté(s)`
        )


        const reservationGroups = new Map<number, ReservationRoom[]>()

        for (const room of expiredRooms) {
          if (!reservationGroups.has(room.reservationId)) {
            reservationGroups.set(room.reservationId, [])
          }
          reservationGroups.get(room.reservationId)!.push(room)
        }

        let totalRevoked = 0
        let totalFailed = 0


        for (const [reservationId, rooms] of reservationGroups) {
          try {
            const reservation = rooms[0].reservation

            if (!reservation || !reservation.guestId) {
              Logger.warn(
                `[AccessExpiration] Skip reservation ${reservationId}: pas de guest`
              )
              continue
            }

            const roomIds = rooms.map((r) => r.roomId!).filter(Boolean)

            if (roomIds.length === 0) {
              Logger.warn(
                `[AccessExpiration] Skip reservation ${reservationId}: pas de roomIds`
              )
              continue
            }

            const guestName = reservation.guest
              ? `${reservation.guest.firstName} ${reservation.guest.lastName}`
              : 'Guest'

            const result = await this.zkIntegrationService.revokeAccessOnCheckOut(
              reservationId,
              roomIds,
              reservation.guestId
            )

            if (result.success) {
              totalRevoked += roomIds.length

              for (const room of rooms) {
                room.accessStatus = 'expired'
                room.accessRevokedAt = DateTime.now()
                room.status = 'checked_out'
                room.actualCheckOut = now
                await room.save()
              }

              // Vérifier si toutes les chambres de la réservation sont checked-out
              const allRooms = await ReservationRoom.query()
                .where('reservation_id', reservationId)

              const allCheckedOut = allRooms.every((r) => r.status === 'checked_out')

              if (allCheckedOut) {
                const res = await Reservation.find(reservationId)
                if (res) {
                  res.status = 'checked_out'
                  res.checkOutDate = now
                  await res.save()

                  Logger.info(
                    `[AccessExpiration]  Reservation #${reservationId} → checked_out`
                  )
                }
              }
            } else {
              totalFailed += roomIds.length

              Logger.error(
                `[AccessExpiration]  Échec pour Reservation #${reservationId}: ` +
                `${result.message} (ajouté à la queue)`
              )
            }
          } catch (error) {
            totalFailed += rooms.length

            Logger.error(
              `[AccessExpiration]  Erreur Reservation #${reservationId}:`,
              error
            )
          }
        }




        if (totalFailed > 5) {
          Logger.error(
            `[AccessExpiration]  ALERTE: ${totalFailed} échecs. ` +
            `Vérifier connectivité des terminaux.`
          )
        }
      } catch (error) {
        Logger.error('[AccessExpiration]  Erreur globale:', error)
      } finally {
        this.isRunning = false
      }
    })

    Logger.info('[AccessExpiration]  Programmé: toutes les minutes')
  }
}
