import Guest from '#models/guest'
import CreditLedgerLog from '#models/credit_ledger_log'
import FolioTransaction from '#models/folio_transaction'
import { TransactionType, TransactionCategory, TransactionStatus } from '#app/enums'
import { DateTime } from 'luxon'
import { generateTransactionCode } from '../utils/generate_guest_code.js'
import db from '@adonisjs/lucid/services/db'

export default class CreditLedgerService {

  /**
   * Transfère l'excédent du folio vers le profil client
   */
  static async transferExcessToCreditLedger(args: {
    guestId: number
    hotelId: number
    reservationId: number
    folioId: number
    amount: number
    actorId: number
    trx: any
    notes?: string
  }) {
    const { guestId, hotelId, reservationId, folioId, amount, actorId, trx, notes } = args

    if (amount <= 0) return null

    const lastTx = await FolioTransaction.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()
    const nextNumber = lastTx?.transactionNumber ? Number(lastTx.transactionNumber) + 1 : 1

    const folioTx = await FolioTransaction.create({
      hotelId,
      folioId,
      reservationId,
       guestId, 
      transactionNumber: nextNumber,
      transactionCode: generateTransactionCode(),
      transactionType: TransactionType.CREDIT_LEDGER_TRANSFER,
      category: TransactionCategory.CREDIT_LEDGER,
      particular: 'Credit Ledger Transfer',
      description: notes || `Excess transferred to guest profile`,
      amount,
      totalAmount: amount,
      quantity: 1,
      unitPrice: amount,
      taxAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      netAmount: amount,
      grossAmount: amount,
      isCreditLedger: true,
      transactionDate: DateTime.now(),
      transactionTime: DateTime.now().toFormat('HH:mm:ss'),
      postingDate: DateTime.now(),
      serviceDate: DateTime.now(),
      status: TransactionStatus.POSTED,
      createdBy: actorId,
      lastModifiedBy: actorId,
    }, { client: trx })

    const query = db.from('guests').where('id', guestId)
    if (trx) query.useTransaction(trx)
    await query.increment('outstanding_credit', amount)

    await CreditLedgerLog.create({
      guestId,
      hotelId,
      amount,
      movementType: 'credit',
      originType: 'overpayment',
      originReservationId: reservationId,
      folioTransactionId: folioTx.id,
      notes: notes || `Excess of ${amount} from folio #${folioId}`,
      createdBy: actorId,
    }, { client: trx })

    return folioTx
  }

  /**
   * Applique le crédit sur un NOUVEAU séjour
   */
  static async applyCreditToReservation(args: {
    guestId: number
    hotelId: number
    targetReservationId: number
    targetFolioId: number
    amountToApply: number
    actorId: number
    trx: any
  }) {
    const { guestId, hotelId, targetReservationId, targetFolioId, amountToApply, actorId, trx } = args

    const guest = await Guest.query({ client: trx }).where('id', guestId).first()
    if (!guest) throw new Error('Guest not found')

    const available = Number(guest.outstandingCredit || 0)
    if (amountToApply > available) {
      throw new Error(`Insufficient credit. Available: ${available}, Required: ${amountToApply}`)
    }

    const lastTx = await FolioTransaction.query({ client: trx })
      .where('hotelId', hotelId)
      .orderBy('transactionNumber', 'desc')
      .first()
    const nextNumber = lastTx?.transactionNumber ? Number(lastTx.transactionNumber) + 1 : 1

    const folioTx = await FolioTransaction.create({
      hotelId,
      folioId: targetFolioId,
      reservationId: targetReservationId,
      transactionNumber: nextNumber,
      transactionCode: generateTransactionCode(),
      transactionType: TransactionType.CREDIT_LEDGER_PAYMENT,
      category: TransactionCategory.CREDIT_LEDGER,
      particular: 'Credit Ledger Payment',
      description: `Payment by guest credit balance`,
      amount: amountToApply,
      totalAmount: amountToApply,
      quantity: 1,
      unitPrice: amountToApply,
      taxAmount: 0,
      serviceChargeAmount: 0,
      discountAmount: 0,
      netAmount: amountToApply,
      grossAmount: amountToApply,
      guestId,
      isCreditLedger: true,
      transactionDate: DateTime.now(),
      transactionTime: DateTime.now().toFormat('HH:mm:ss'),
      postingDate: DateTime.now(),
      serviceDate: DateTime.now(),
      status: TransactionStatus.POSTED,
      createdBy: actorId,
      lastModifiedBy: actorId,
    }, { client: trx })

    const guestQuery = db.from('guests').where('id', guestId)
    if (trx) guestQuery.useTransaction(trx)
    await guestQuery.decrement('outstanding_credit', amountToApply)

    await CreditLedgerLog.create({
      guestId,
      hotelId,
      amount: amountToApply,
      movementType: 'debit',
      originType: 'payment',
      destinationReservationId: targetReservationId,
      folioTransactionId: folioTx.id,
      notes: `Applied credit to reservation #${targetReservationId}`,
      createdBy: actorId,
    }, { client: trx })

    return folioTx
  }

  static async getGuestCreditBalance(guestId: number): Promise<number> {
    const guest = await Guest.find(guestId)
    return Number(guest?.outstandingCredit || 0)
  }

  static async getCreditHistory(guestId: number, hotelId: number) {
    return CreditLedgerLog.query()
      .where('guestId', guestId)
      .where('hotelId', hotelId)
      .orderBy('createdAt', 'desc')
      .limit(50)
  }

  /**
 * Rembourse le crédit au guest lors du void d'un credit_ledger_payment
 */
    static async refundCreditOnVoid(args: {
    guestId: number
    hotelId: number
    reservationId: number
    folioId: number
    amount: number
    actorId: number
    originalTransactionId: number
    trx?: any
    }) {
    const { guestId, hotelId, reservationId, folioId, amount, actorId, originalTransactionId, trx } = args

    const guest = await Guest.query({ client: trx }).where('id', guestId).first()
    if (!guest) throw new Error('Guest not found')

    // Remettre le crédit dans le profil guest
    const guestQuery = db.from('guests').where('id', guestId)
    if (trx) guestQuery.useTransaction(trx)
    await guestQuery.increment('outstanding_credit', amount)

    // Logger le mouvement dans le credit ledger
    await CreditLedgerLog.create({
        guestId,
        hotelId,
        amount,
        movementType: 'credit',
        originType: 'void_refund',
        originReservationId: reservationId,
        folioTransactionId: originalTransactionId,
        notes: `Credit refund following transaction failure #${originalTransactionId}`,
        createdBy: actorId,
    }, { client: trx })
    }

    /**
 * Inverse un credit_ledger_transfer lors du void
 * (retire le montant du crédit du guest)
 */
static async reverseCreditTransferOnVoid(args: {
  guestId: number
  hotelId: number
  reservationId: number
  folioId: number
  amount: number
  actorId: number
  originalTransactionId: number
  trx?: any
}) {
  const { guestId, hotelId, reservationId, folioId, amount, actorId, originalTransactionId, trx } = args

  const guest = await Guest.query({ client: trx }).where('id', guestId).first()
  if (!guest) throw new Error('Guest not found')

  const available = Number(guest.outstandingCredit || 0)
  if (available < amount) {
    throw new Error(`Cannot reverse transfer: guest credit (${available}) is less than amount to reverse (${amount})`)
  }

  // Retirer le montant du crédit du guest
  const guestQuery = db.from('guests').where('id', guestId)
  if (trx) guestQuery.useTransaction(trx)
  await guestQuery.decrement('outstanding_credit', amount)

  // Logger le mouvement
  await CreditLedgerLog.create({
    guestId,
    hotelId,
    amount,
    movementType: 'debit',
    originType: 'void_transfer_reversal',
    originReservationId: reservationId,
    folioTransactionId: originalTransactionId,
    notes: `Reversal of credit transfer following void of transaction #${originalTransactionId}`,
    createdBy: actorId,
  }, { client: trx })
}
}