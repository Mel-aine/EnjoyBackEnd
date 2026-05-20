import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'

export default class GuestFeedbacksController {

  async index({ params, request, response }: HttpContext) {
    const hotelId = params.id
    const period  = Number(request.input('period', 30))
    const since = period === 7
      ? DateTime.now().toUTC().startOf('week').toSQL()!
      : DateTime.now().toUTC().minus({ days: period }).toSQL()!

    // ── Agrégat global ────────────────────────────────────────────────────
    const feedbacks = await db
      .from('guest_feedbacks')
      .where('hotel_id', hotelId)
      .where('created_at', '>=', since)
      .select(db.raw('rating, count(*) as total'))
      .groupBy('rating')

    const counts: Record<string, number> = {
      excellent: 0, satisfaisant: 0, a_ameliorer: 0,
    }
    feedbacks.forEach((r: any) => { counts[r.rating] = Number(r.total) })

    const excellent    = counts['excellent']    ?? 0
    const satisfaisant = counts['satisfaisant'] ?? 0
    const aAmeliorer   = counts['a_ameliorer']  ?? 0
    const totalResp    = excellent + satisfaisant + aAmeliorer

    // ── Enquêtes envoyées ─────────────────────────────────────────────────
    const [sentRow] = await db
      .from('whatsapp_logs')
      .where('hotel_id', hotelId)
      .whereIn('template_name', ['feedback_survey', 'feedback_survey_2'])
      .whereIn('status', ['sent', 'delivered', 'read'])
      .whereNotNull('sent_at')
      .where('sent_at', '>=', since)
      .count('* as total')

    const sent         = Number(sentRow?.total ?? 0)
    const responseRate = sent > 0 ? Math.min(Math.round((totalResp / sent) * 100), 100) : 0
    const nps          = totalResp > 0
      ? Math.round(((excellent - aAmeliorer) / totalResp) * 100)
      : 0

    // ── Commentaires négatifs ─────────────────────────────────────────────
    const [negRow] = await db
      .from('guest_feedbacks')
      .where('hotel_id', hotelId)
      .where('rating', 'a_ameliorer')
      .whereNotNull('comment')
      .where('created_at', '>=', since)
      .count('* as total')

    const negativeComments = Number(negRow?.total ?? 0)

    // ── Évolution : 7 jours si period=7, sinon semaines ───────────────────
    if (period === 7) {
      const startOfWeek = DateTime.now().toUTC().startOf('week')
      const dayNames    = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

      const dayRanges = Array.from({ length: 7 }, (_, i) => {
        const day = startOfWeek.plus({ days: i })
        return {
          label: dayNames[i],
          start: day.startOf('day').toSQL()!,
          end:   day.endOf('day').toSQL()!,
        }
      })

      const dayResults = await Promise.all(
        dayRanges.map(async ({ start, end }) => {
          const [dFeedbacks, dSentRow] = await Promise.all([
            db.from('guest_feedbacks')
              .where('hotel_id', hotelId)
              .whereBetween('created_at', [start, end])
              .select(db.raw('rating, count(*) as total'))
              .groupBy('rating'),

            db.from('whatsapp_logs')
              .where('hotel_id', hotelId)
              .whereIn('template_name', ['feedback_survey', 'feedback_survey_2'])
              .whereIn('status', ['sent', 'delivered', 'read'])
              .whereNotNull('sent_at')
              .whereBetween('sent_at', [start, end])
              .count('* as total')
              .first(),
          ])

          const dCounts: Record<string, number> = {}
          dFeedbacks.forEach((r: any) => { dCounts[r.rating] = Number(r.total) })

          const dExc  = dCounts['excellent']    ?? 0
          const dNeg  = dCounts['a_ameliorer']  ?? 0
          const dTot  = dExc + (dCounts['satisfaisant'] ?? 0) + dNeg
          const dSent = Number((dSentRow as any)?.total ?? 0)

          return {
            nps:  dTot  > 0 ? Math.round(((dExc - dNeg) / dTot) * 100) : 0,
            rate: dSent > 0 ? Math.min(Math.round((dTot / dSent) * 100), 100) : 0,
          }
        })
      )

      return response.ok({
        nps,
        responseRate,
        googleRedirects: excellent,
        sent,
        responses:       totalResp,
        excellent,
        satisfaisant,
        aAmeliorer,
        negativeComments,
        weeks: dayRanges.map(d => d.label),
        npsW:  dayResults.map(d => d.nps),
        rateW: dayResults.map(d => d.rate),
      })
    }

    // ── Évolution hebdomadaire (semaines) ─────────────────────────────────
    const nbWeeks   = Math.min(Math.ceil(period / 7), 12)
    const weekRanges = Array.from({ length: nbWeeks }, (_, i) => {
      const idx   = nbWeeks - 1 - i
      const start = DateTime.now().toUTC().minus({ weeks: idx + 1 }).startOf('week').toSQL()!
      const end   = idx === 0
        ? DateTime.now().toUTC().toSQL()!
        : DateTime.now().toUTC().minus({ weeks: idx }).startOf('week').toSQL()!

      return { label: `S${i + 1}`, start, end }
    })

    const weekResults = await Promise.all(
      weekRanges.map(async ({ start, end }) => {
        const [wFeedbacks, wSentRow] = await Promise.all([
          db.from('guest_feedbacks')
            .where('hotel_id', hotelId)
            .whereBetween('created_at', [start, end])
            .select(db.raw('rating, count(*) as total'))
            .groupBy('rating'),

          db.from('whatsapp_logs')
            .where('hotel_id', hotelId)
            .whereIn('template_name', ['feedback_survey', 'feedback_survey_2'])
            .whereIn('status', ['sent', 'delivered', 'read'])
            .whereNotNull('sent_at')
            .whereBetween('sent_at', [start, end])
            .count('* as total')
            .first(),
        ])

        const wCounts: Record<string, number> = {}
        wFeedbacks.forEach((r: any) => { wCounts[r.rating] = Number(r.total) })

        const wExc  = wCounts['excellent']    ?? 0
        const wNeg  = wCounts['a_ameliorer']  ?? 0
        const wTot  = wExc + (wCounts['satisfaisant'] ?? 0) + wNeg
        const wSent = Number((wSentRow as any)?.total ?? 0)

        return {
          nps:  wTot  > 0 ? Math.round(((wExc - wNeg) / wTot) * 100) : 0,
          rate: wSent > 0 ? Math.min(Math.round((wTot / wSent) * 100), 100) : 0,
        }
      })
    )

    return response.ok({
      nps,
      responseRate,
      googleRedirects: excellent,
      sent,
      responses:       totalResp,
      excellent,
      satisfaisant,
      aAmeliorer,
      negativeComments,
      weeks: weekRanges.map(w => w.label),
      npsW:  weekResults.map(w => w.nps),
      rateW: weekResults.map(w => w.rate),
    })
  }
}