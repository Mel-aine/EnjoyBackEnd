
// app/controllers/credit_ledger_controller.ts
import type { HttpContext } from '@adonisjs/core/http'
import CreditLedgerService from '#services/credit_ledger_service'
import db from '@adonisjs/lucid/services/db'
import Folio from '#models/folio'
import LoggerService from '#services/logger_service'

export default class CreditLedgerController {

  async getBalance({ params, response }: HttpContext) {
    const balance = await CreditLedgerService.getGuestCreditBalance(Number(params.guestId))
    return response.ok({ guestId: params.guestId, outstandingCredit: balance })
  }

  
  async getHistory({ params, response }: HttpContext) {
    const logs = await CreditLedgerService.getCreditHistory(
      Number(params.guestId),
      Number(params.hotelId)
    )
    return response.ok({ logs })
  }

 
  async applyCredit({ params, request, response, auth }: HttpContext) {
    const trx = await db.transaction()

    try {
      const { guestId, folioId, amount, reservationId: bodyReservationId } = request.body()
      const hotelId = Number(params.hotelId)
      const reservationId = bodyReservationId || Number(params.reservationId)

      console.log(folioId, reservationId, amount, guestId, hotelId, auth.user!.id)

      if (!guestId || !folioId || !amount || Number(amount) <= 0 || !reservationId) {
        await trx.rollback()
        return response.badRequest({ message: 'guestId, folioId, reservationId and amount > 0 are required' })
      }

      // Vérifier que le folio appartient à cette réservation
      const folio = await Folio.query({ client: trx })
        .where('id', folioId)
        .where('reservationId', reservationId)
        // .where('status', FolioStatus.OPEN)
        .first()

      if (!folio) {
        await trx.rollback()
        return response.badRequest({ message: 'Folio not found for this reservation' })
      }

      const folioTx = await CreditLedgerService.applyCreditToReservation({
        guestId: Number(guestId),
        hotelId,
        targetReservationId: reservationId,
        targetFolioId: folioId,
        amountToApply: Number(amount),
        actorId: auth.user!.id,
        trx,
      })

      // Recalculer les totaux du folio
      const FolioService = (await import('#services/folio_service')).default
      await FolioService.updateFolioTotals(folioId, trx)

      await LoggerService.log({
        actorId: auth.user!.id,
        action: 'APPLY_CREDIT_LEDGER',
        entityType: 'Reservation',
        entityId: reservationId,
        hotelId,
        description: `Credit Ledger of ${amount} applied to reservation #${reservationId} for guest #${guestId}`,
        meta: { amount, guestId, folioId },
        ctx: { request, response } as any,
      })

      await trx.commit()

      return response.ok({
        success: true,
        message: 'Credit applied successfully',
        transaction: { id: folioTx.id, amount },
        newBalance: await CreditLedgerService.getGuestCreditBalance(Number(guestId)),
      })
    } catch (error) {
      await trx.rollback()
      return response.badRequest({ message: error.message })
    }
  }


}