import FolioTransaction from '#models/folio_transaction'
import FolioService from '#services/folio_service'
import { TransactionCategory, TransactionStatus, TransactionType } from '#app/enums'
import { DateTime } from 'luxon'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'

export default class ReservationPenaltyService {
  /** OTA penalties are booking totals, including any taxes already supplied by the OTA. */
  static async reconcileOtaPenalty(
    folioIds: number[],
    category: TransactionCategory.CANCELLATION_FEE | TransactionCategory.NO_SHOW_FEE,
    amount: number,
    userId: number,
    taxInclusive: boolean
  ) {
    const penalties = await FolioTransaction.query()
      .whereIn('folioId', folioIds)
      .where('category', category)
      .where('isVoided', false)
      .orderBy('id', 'asc')
    const retained = amount > 0 ? penalties[0] : undefined
    for (const penalty of penalties) {
      if (penalty === retained) {
        const tax = taxInclusive ? 0 : Number(penalty.taxAmount || 0)
        penalty.merge({
          amount, quantity: 1, unitPrice: amount, grossAmount: amount, netAmount: amount,
          totalAmount: amount + tax, taxAmount: tax, serviceChargeAmount: 0,
          discountAmount: 0, lastModifiedBy: userId,
        })
      } else {
        penalty.merge({
          status: TransactionStatus.VOIDED, isVoided: true, voidedBy: userId,
          voidedAt: DateTime.now(), voidedDate: DateTime.now(),
          voidReason: 'Reconciled OTA booking penalty', lastModifiedBy: userId,
        })
      }
      await penalty.save()
    }
    return retained
  }

  /** Keep the applicable penalty as revenue, while preserving money already received/refunded. */
  static async voidCharges(
    folioId: number,
    penalty: TransactionCategory.CANCELLATION_FEE | TransactionCategory.NO_SHOW_FEE,
    userId: number,
    reason: string,
    trx?: TransactionClientContract
  ) {
    const now = DateTime.now()
    const transactions = await FolioTransaction.query(trx ? { client: trx } : {})
      .where('folioId', folioId)
      .whereIn('transactionType', [
        TransactionType.CHARGE, TransactionType.ROOM_POSTING, TransactionType.TAX,
        TransactionType.ADJUSTMENT, TransactionType.DISCOUNT, TransactionType.CORRECTION,
      ])
      .where((query) => query.whereNot('category', penalty).orWhereNull('category'))
      .where((query) => query.where('isVoided', false).orWhereNull('isVoided'))

    for (const transaction of transactions) {
      transaction.merge({
        status: TransactionStatus.VOIDED,
        isVoided: true,
        voidedBy: userId,
        voidedAt: now,
        voidedDate: now,
        voidReason: reason,
        lastModifiedBy: userId,
      })
      await transaction.save()
    }
    await FolioService.updateFolioTotals(folioId, trx)
    return transactions.length
  }
}
