import { DateTime } from 'luxon'
import Hotel from '#models/hotel'
import WhatsappSession from '#models/whatsapp_session'
import WhatsappMonthlyStat from '#models/whatsapp_monthly_stat'

export default class WhatsAppTrackingService {

  /**
   * Point d'entrée principal — appelé à chaque message entrant.
   */

  async track(hotel: Hotel, guestPhone: string, trackSessions: boolean = false): Promise<void> {
      const month = DateTime.now().toFormat('yyyy-MM')

      // Toujours compter les messages
      await this.incrementMessageCount(hotel.id, month)

      // Sessions uniquement en mode managé
      if (trackSessions) {
          const isNewSession = await this.checkAndCreateSession(hotel.id, guestPhone)
          if (isNewSession) {
              await this.incrementSessionCount(hotel.id, month)
          }
      }
  }

  /**
   * Incrémente message_count du mois courant.
   * Crée la ligne si elle n'existe pas encore (premier message du mois).
   */
  private async incrementMessageCount(hotelId: number, month: string): Promise<void> {
    // firstOrCreate : crée la ligne si elle n'existe pas
    const stat = await WhatsappMonthlyStat.firstOrCreate(
      { hotelId, month },
      { hotelId, month, messageCount: 0, sessionCount: 0 }
    )

    await WhatsappMonthlyStat.query()
      .where('hotel_id', hotelId)
      .where('month', month)
      .increment('message_count', 1)

    console.log(`message_count → ${stat.messageCount + 1}`)
  }

  /**
   * Incrémente session_count du mois courant.
   */
  private async incrementSessionCount(hotelId: number, month: string): Promise<void> {
    await WhatsappMonthlyStat.query()
      .where('hotel_id', hotelId)
      .where('month', month)
      .increment('session_count', 1)

    console.log(` session_count incrémenté`)
  }

  /**
   * Vérifie si une session 24h est active pour ce (hotel, guestPhone).
   * - Session active trouvée  → false (pas de nouvelle session)
   * - Aucune session active   → crée une nouvelle session → true
   */
  private async checkAndCreateSession(hotelId: number, guestPhone: string): Promise<boolean> {
    const now = DateTime.now()

    const activeSession = await WhatsappSession.query()
      .where('hotel_id', hotelId)
      .where('guest_phone', guestPhone)
      .where('expires_at', '>', now.toSQL())
      .orderBy('opened_at', 'desc')
      .first()

    if (activeSession) {
      console.log(` Session active trouvée - expire à: ${activeSession.expiresAt.toISO()}`)
      return false
    }

    // Créer une nouvelle session de 24h
    await WhatsappSession.create({
      hotelId,
      guestPhone,
      openedAt: now,
      expiresAt: now.plus({ hours: 24 }),
    })

    console.log(` Nouvelle session ouverte - expire à: ${now.plus({ hours: 24 }).toISO()}`)
    return true
  }

  /**
   * Récupère les stats d'un hôtel sur N mois.
   * Utile pour les comparaisons mois/mois.
   *
   * Exemple : getStats(1, 3) → stats de janvier, février, mars
   */
  async getStats(hotelId: number, months: number = 3): Promise<WhatsappMonthlyStat[]> {
    return WhatsappMonthlyStat.query()
      .where('hotel_id', hotelId)
      .orderBy('month', 'desc')
      .limit(months)
  }

  /**
   * Comparaison entre le mois courant et le mois précédent.
   */
  async compareWithLastMonth(hotelId: number): Promise<{
    current: { month: string; messages: number; sessions: number }
    previous: { month: string; messages: number; sessions: number }
    diff: { messages: number; sessions: number }
  }> {
    const currentMonth = DateTime.now().toFormat('yyyy-MM')
    const previousMonth = DateTime.now().minus({ months: 1 }).toFormat('yyyy-MM')

    const [current, previous] = await Promise.all([
      WhatsappMonthlyStat.query().where('hotel_id', hotelId).where('month', currentMonth).first(),
      WhatsappMonthlyStat.query().where('hotel_id', hotelId).where('month', previousMonth).first(),
    ])

    return {
      current: {
        month: currentMonth,
        messages: current?.messageCount ?? 0,
        sessions: current?.sessionCount ?? 0,
      },
      previous: {
        month: previousMonth,
        messages: previous?.messageCount ?? 0,
        sessions: previous?.sessionCount ?? 0,
      },
      diff: {
        messages: (current?.messageCount ?? 0) - (previous?.messageCount ?? 0),
        sessions: (current?.sessionCount ?? 0) - (previous?.sessionCount ?? 0),
      },
    }
  }

  /**
   * Purge les sessions expirées (à appeler via un cron job).
   * Évite que la table whatsapp_sessions grossisse indéfiniment.
   */
  async purgeExpiredSessions(): Promise<number> {
    const now = DateTime.now()
    const deleted = await WhatsappSession.query()
      .where('expires_at', '<', now.toSQL())
      .delete()

    console.log(` ${deleted} sessions expirées supprimées`)
    return deleted as any
  }
}
