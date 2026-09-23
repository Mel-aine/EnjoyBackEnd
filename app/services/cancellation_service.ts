import { DateTime } from 'luxon'
import Reservation from '#models/reservation'
import ReservationRoom from '#models/reservation_room'
import CancellationSetting, {
  CancellationChargeType,
} from '#models/cancellation_setting'
import Folio from '#models/folio'
import LoggerService from '#services/logger_service'
import GuestSummaryService from '#services/guest_summary_service'
import FolioService from '#services/folio_service'
import {
  FolioStatus,
  ReservationStatus,
  ReservationProductStatus,
  SettlementStatus,
  TransactionCategory,
  TransactionStatus,
  TransactionType,
  WorkflowStatus,
} from '#app/enums'

export interface CancellationEvaluation {
  isLate: boolean
  withinWindow: boolean
  cancellationType: 'in_window' | 'late'
  checkInDatetime: string | null
  freeUntil: string | null
  hoursUntilCheckIn: number | null
  feeAmount: number
  feeAmountWithTax: number
  feeDescription: string
  paidAmount: number
  remainingDue: number
  refundDue: number
  policy: {
    freeHours: number
    chargeType: CancellationChargeType
    chargeValue: number | null
    label: string
  }
  summaryMessage: string
}

export interface ProcessCancellationOptions {
  userId: number
  reason?: string
  selectedRooms?: number[]
  waiveFee?: boolean
  waiveReason?: string
  /** Frais recalculé côté serveur par défaut ; peut être forcé (déjà validé) */
  overrideFeeAmount?: number
  ctx?: any
}

export interface ProcessCancellationResult {
  reservationId: number
  reservationNumber: string | null
  status: string
  cancellationType: 'in_window' | 'late'
  isFullCancellation: boolean
  feeAmount: number
  feeAmountWithTax: number
  feeWaived: boolean
  waiveReason: string | null
  paidAmount: number
  remainingDue: number
  refundDue: number
  foliosClosed: number
  transactionsCancelled: number
  feeTransactionsPosted: number
  cancelledRooms: string[]
  summaryMessage: string
}

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100

export default class CancellationService {
  /**
   * Récupère (ou crée avec des valeurs par défaut) la politique d'annulation
   * globale de l'établissement.
   */
  static async getSettings(hotelId: number): Promise<CancellationSetting> {
    let setting = await CancellationSetting.query().where('hotelId', hotelId).first()
    if (!setting) {
      setting = await CancellationSetting.create({
        hotelId,
        cancellationFreeHours: 24,
        cancellationChargeType: CancellationChargeType.FIRST_NIGHT,
        cancellationChargeValue: 0,
      })
    }
    return setting
  }

  /**
   * Construit la date/heure de check-in prévue de la réservation
   * (date d'arrivée + heure de check-in).
   */
  private static buildCheckInDatetime(reservation: Reservation): DateTime | null {
    const arrival =
      reservation.arrivedDate ?? reservation.scheduledArrivalDate ?? reservation.checkInDate ?? null
    if (!arrival || !arrival.isValid) return null

    const timeStr = reservation.checkInTime || '14:00:00'
    const parts = timeStr.split(':').map((p) => parseInt(p, 10))
    const hour = Number.isFinite(parts[0]) ? parts[0] : 14
    const minute = Number.isFinite(parts[1]) ? parts[1] : 0
    const second = Number.isFinite(parts[2]) ? parts[2] : 0

    return arrival.set({ hour, minute, second, millisecond: 0 })
  }

  /**
   * Calcule le montant de la première nuit pour les chambres actives.
   * Basé sur roomRate (tarif par nuit), pas une moyenne du total du séjour.
   */
  private static computeFirstNightAmount(rooms: ReservationRoom[]): number {
    let firstNight = 0
    for (const room of rooms) {
      firstNight += Number(room.roomRate) || 0
    }
    return round2(firstNight)
  }

  /**
   * Calcule le montant total du séjour (net, hors extras) pour les chambres actives.
   */
  private static computeStayAmount(rooms: ReservationRoom[]): number {
    return round2(rooms.reduce((total, room) => total + (Number(room.totalRoomCharges) || 0), 0))
  }

  /**
   * Calcule la pénalité selon le type de frais paramétré.
   * Le montant retourné est le montant NET final — aucune taxe n'est ajoutée
   * par la suite sur les frais d'annulation (règle métier : si la nuitée coûte
   * 100 000, le client paie exactement 100 000 en cas d'annulation tardive).
   *
   * Note: `rooms` doit déjà être scopé (toutes les chambres actives, ou seulement
   * les chambres sélectionnées en cas d'annulation partielle).
   */
  private static computePenalty(
    setting: CancellationSetting,
    reservation: Reservation,
    rooms: ReservationRoom[]
  ): { amount: number; description: string } {
    switch (setting.cancellationChargeType) {
      case CancellationChargeType.FREE:
        return { amount: 0, description: 'Free cancellation (NO CHARGE)' }

      case CancellationChargeType.FIRST_NIGHT: {
        const amount = this.computeFirstNightAmount(rooms)
        return { amount, description: `Penalty: first night (${amount})` }
      }

      case CancellationChargeType.FULL_STAY: {
        const amount = this.computeStayAmount(rooms)
        return { amount, description: `Penalty: 100% of the stay (${amount})` }
      }

      case CancellationChargeType.PERCENTAGE: {
        const stayTotal = this.computeStayAmount(rooms)
        const pct = Number(setting.cancellationChargeValue) || 0
        const amount = round2(stayTotal * (pct / 100))
        return { amount, description: `Penalty: ${pct}% of the stay (${amount})` }
      }

      case CancellationChargeType.FIXED_AMOUNT: {
        const amount = round2(Number(setting.cancellationChargeValue) || 0)
        return { amount, description: `Penalty: fixed amount (${amount})` }
      }

      default:
        return { amount: 0, description: 'Free cancellation' }
    }
  }

  /**
   * Total déjà encaissé sur les folios de la réservation
   * (paiements non annulés / non voidés).
   */
  private static computePaidAmount(folios: Folio[]): number {
    let paid = 0
    for (const folio of folios) {
      for (const transaction of folio.transactions ?? []) {
        const isPayment =
          transaction.transactionType === TransactionType.PAYMENT &&
          transaction.category !== TransactionCategory.CANCELLATION_FEE
        const isActive =
          transaction.status !== TransactionStatus.CANCELLED &&
          transaction.status !== TransactionStatus.VOIDED &&
          !transaction.isVoided
        if (isPayment && isActive) {
          paid += Math.abs(Number(transaction.totalAmount ?? transaction.amount) || 0)
        }
      }
    }
    return round2(paid)
  }

  /**
   * Évalue l'annulation d'une réservation selon la politique globale :
   * délai de franchise, pénalité applicable, récapitulatif financier.
   *
   * @param roomIds Optionnel — si fourni, la pénalité n'est calculée que sur
   * ces chambres (cas d'une annulation partielle). Si omis, toutes les
   * chambres actives de la réservation sont prises en compte.
   */
  static async evaluateCancellation(
    reservationId: number,
    evaluationDate?: DateTime,
    roomIds?: number[]
  ): Promise<CancellationEvaluation> {
    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('reservationRooms')
      .preload('folios', (query) => query.preload('transactions'))
      .firstOrFail()

    const setting = await this.getSettings(reservation.hotelId)
    const now = evaluationDate ?? DateTime.now()

    const checkInDatetime = this.buildCheckInDatetime(reservation)
    const freeUntil = checkInDatetime
      ? checkInDatetime.minus({ hours: setting.cancellationFreeHours })
      : null

    const withinWindow = freeUntil ? now <= freeUntil : true
    const isLate = !withinWindow

    let activeRooms = reservation.reservationRooms.filter(
      (room) => room.status !== ReservationProductStatus.CANCELLED
    )
    // Annulation partielle : ne calculer la pénalité que sur les chambres concernées
    if (roomIds && roomIds.length > 0) {
      activeRooms = activeRooms.filter((room) => roomIds.includes(room.id))
    }

    let feeAmount = 0
    let feeDescription = 'Free cancellation (within the deadline)'
    if (isLate) {
      const penalty = this.computePenalty(setting, reservation, activeRooms)
      feeAmount = penalty.amount
      feeDescription = penalty.description
    }

    // Aucune taxe n'est appliquée sur les frais d'annulation : le montant
    // facturé au folio est exactement le montant net calculé ci-dessus.
    const feeAmountWithTax = feeAmount

    const paidAmount = this.computePaidAmount(reservation.folios ?? [])
    const remainingDue = round2(Math.max(0, feeAmountWithTax - paidAmount))
    const refundDue = round2(Math.max(0, paidAmount - feeAmountWithTax))

    const freeUntilLabel = freeUntil ? freeUntil.toFormat('dd/MM/yyyy HH:mm') : 'N/A'
    const summaryMessage = withinWindow
      ? `Free cancellation — within the grace period (${setting.cancellationFreeHours}h before check-in).`
      : `Late cancellation detected — grace period expired as of ${freeUntilLabel}. ${feeDescription} → ${feeAmountWithTax} FCFA.`

    return {
      isLate,
      withinWindow,
      cancellationType: withinWindow ? 'in_window' : 'late',
      checkInDatetime: checkInDatetime ? checkInDatetime.toISO() : null,
      freeUntil: freeUntil ? freeUntil.toISO() : null,
      hoursUntilCheckIn: checkInDatetime ? round2(checkInDatetime.diff(now, 'hours').hours) : null,
      feeAmount,
      feeAmountWithTax,
      feeDescription,
      paidAmount,
      remainingDue,
      refundDue,
      policy: {
        freeHours: setting.cancellationFreeHours,
        chargeType: setting.cancellationChargeType,
        chargeValue: setting.cancellationChargeValue,
        label: feeDescription,
      },
      summaryMessage,
    }
  }

  /**
   * Applique l'annulation d'une réservation (complète ou partielle) :
   * - évalue la politique et calcule les frais sur les chambres concernées uniquement,
   * - crée la ligne de débit "Frais d'annulation" sur le Folio (SANS taxe ajoutée —
   *   le montant net calculé est le montant final facturé),
   * - impute l'acompte déjà encaissé sur les frais,
   * - VOID les charges des chambres annulées (au lieu de simplement CANCELLED,
   *   pour qu'elles disparaissent bien du solde calculé par calculateBalanceSummary),
   * - ne clôture le folio et ne marque la réservation CANCELLED que si TOUTES
   *   les chambres actives sont annulées (annulation complète),
   * - trace toutes les opérations dans les logs d'audit.
   */
  static async processCancellation(
    reservationId: number,
    options: ProcessCancellationOptions
  ): Promise<ProcessCancellationResult> {
    const { userId, reason, selectedRooms, waiveFee, waiveReason, overrideFeeAmount, ctx } = options

    const reservation = await Reservation.query()
      .where('id', reservationId)
      .preload('reservationRooms')
      .preload('folios', (query) => query.preload('transactions'))
      .firstOrFail()

    // Validations de statut
    const blockedStatuses = [
      ReservationStatus.CANCELLED,
      ReservationStatus.CHECKED_OUT,
      ReservationStatus.CHECKED_IN,
    ]
    if (blockedStatuses.includes(reservation.status as ReservationStatus)) {
      throw new Error(
        `Cannot cancel a reservation with status '${reservation.status}'.`
      )
    }

    const activeRoomsAll = reservation.reservationRooms.filter(
      (r) => r.status !== ReservationProductStatus.CANCELLED
    )
    const isFullCancellation =
      !selectedRooms || selectedRooms.length === 0 || selectedRooms.length >= activeRoomsAll.length

    // Évaluation scopée aux chambres réellement concernées par CETTE annulation
    const evaluation = await this.evaluateCancellation(
      reservationId,
      undefined,
      isFullCancellation ? undefined : selectedRooms
    )
    const isLate = evaluation.isLate

    // Exonération (dérogation manager)
    const feeWaived = Boolean(waiveFee)
    if (feeWaived && !waiveReason?.trim()) {
      throw new Error('Un motif d\'exonération est obligatoire pour waiver les frais d\'annulation.')
    }

    let feeAmount = overrideFeeAmount !== undefined ? round2(overrideFeeAmount) : evaluation.feeAmount
    if (feeWaived) feeAmount = 0
    if (!isLate) feeAmount = 0

    // Pas de taxe sur les frais d'annulation : montant net = montant facturé
    const feeAmountWithTax = feeAmount

    const paidAmount = evaluation.paidAmount
    const remainingDue = round2(Math.max(0, feeAmountWithTax - paidAmount))
    const refundDue = round2(Math.max(0, paidAmount - feeAmountWithTax))

    // 1. Annulation des chambres sélectionnées (ou de toutes)
    const cancelledRooms: string[] = []
    const roomsToCancel = reservation.reservationRooms.filter(
      (room) =>
        room.status !== ReservationProductStatus.CANCELLED &&
        (!selectedRooms || selectedRooms.length === 0 || selectedRooms.includes(room.id))
    )

    for (const resRoom of roomsToCancel) {
      resRoom.status = ReservationProductStatus.CANCELLED
      resRoom.lastModifiedBy = userId
      await resRoom.save()

      const room = resRoom.roomId ? await (await import('#models/room')).default.find(resRoom.roomId) : null
      if (room) {
        room.status = 'available'
        room.lastModifiedBy = userId
        await room.save()
        cancelledRooms.push(room.roomNumber)
      }

      await LoggerService.log({
        actorId: userId,
        action: 'CANCEL',
        entityType: 'ReservationRoom',
        entityId: resRoom.id,
        reservationId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Room ${room?.roomNumber ?? '(unknown)'} from reservation #${reservation.reservationNumber} was cancelled. Reason: ${reason || 'N/A'}.`,
        meta: { reason, cancellationType: evaluation.cancellationType, cancellationFeeAmount: feeAmount, isFullCancellation },
        ctx,
      })
    }

    const cancelledRoomIds = new Set(roomsToCancel.map((r) => r.id))

    // 2. Traitement des folios : frais d'annulation + imputation de l'acompte
    let foliosClosed = 0
    let transactionsCancelled = 0
    let feeTransactionsPosted = 0

    let folios: Folio[] = Array.isArray(reservation.folios)
      ? reservation.folios
      : []

    // Si aucun folio n'existe et qu'une pénalité est due, on en crée un
    if (folios.length === 0 && feeAmount > 0 && reservation.guestId) {
      const folio = await FolioService.createFolio({
        hotelId: reservation.hotelId,
        guestId: reservation.guestId,
        reservationId: reservation.id,
        folioType: 'guest' as any,
        createdBy: userId,
      })
      folios = [folio]
    }

    for (const folio of folios) {
      // Réouvrir le folio fermé pour pouvoir poster les frais
      if (folio.status !== FolioStatus.OPEN) {
        folio.status = FolioStatus.OPEN
        folio.workflowStatus = WorkflowStatus.ACTIVE
        folio.closedDate = null
        folio.closedBy = null
        await folio.save()
      }

      // Ligne de débit "Frais d'annulation" — taxAmount forcé à 0 : le montant
      // net calculé par computePenalty est le montant final, sans taxe ajoutée.
      if (feeAmount > 0) {
        await FolioService.postTransaction({
          folioId: folio.id,
          transactionType: TransactionType.CHARGE,
          category: TransactionCategory.CANCELLATION_FEE,
          description: feeWaived
            ? 'Cancellation Fee (waived)'
            : `Cancellation Fee — ${evaluation.policy.label}`,
          amount: feeAmount,
          quantity: 1,
          unitPrice: feeAmount,
          taxAmount: 0,
          notes: feeWaived
            ? `Frais exonérés (dérogation manager). Motif: ${waiveReason}`
            : `Politique d'annulation: franchise ${evaluation.policy.freeHours}h, ${evaluation.policy.chargeType}${isFullCancellation ? '' : ' (partial)'}. Reason: ${reason || 'N/A'}`,
          postedBy: userId,
          transactionDate: DateTime.now(),
        })
        feeTransactionsPosted++

        await LoggerService.log({
          actorId: userId,
          action: 'CANCELLATION_FEE_POSTED',
          entityType: 'FolioTransaction',
          entityId: folio.id,
          reservationId: reservation.id,
          hotelId: reservation.hotelId,
          description: `Cancellation fee of ${feeAmount} posted to folio ${folio.folioNumber} for reservation #${reservation.reservationNumber}`,
          meta: { folioId: folio.id, feeAmount, cancellationType: evaluation.cancellationType, isFullCancellation },
          ctx,
        })
      } else if (isLate && feeWaived) {
        await LoggerService.log({
          actorId: userId,
          action: 'CANCELLATION_FEE_WAIVED',
          entityType: 'Reservation',
          entityId: reservation.id,
          reservationId: reservation.id,
          hotelId: reservation.hotelId,
          description: `Cancellation fee waived for reservation #${reservation.reservationNumber}. Motif: ${waiveReason}`,
          meta: { waiveReason, reason, cancellationType: evaluation.cancellationType },
          ctx,
        })
      }

      // Annuler (VOID) les charges des chambres concernées, SANS toucher aux
      // paiements/acomptes déjà encaissés ni à la ligne de frais d'annulation.
      // En annulation PARTIELLE, on ne touche qu'aux charges des chambres annulées ;
      // les charges des chambres restantes (encore actives) doivent rester intactes.
      for (const transaction of folio.transactions ?? []) {
        const isPayment = transaction.transactionType === TransactionType.PAYMENT
        const isCancellationFee = transaction.category === TransactionCategory.CANCELLATION_FEE
        const alreadyInactive =
          transaction.status === TransactionStatus.CANCELLED ||
          transaction.status === TransactionStatus.VOIDED ||
          transaction.isVoided
        const belongsToCancelledRoom =
          transaction.reservationRoomId != null
            ? cancelledRoomIds.has(transaction.reservationRoomId)
            : isFullCancellation

        if (!isPayment && !isCancellationFee && !alreadyInactive && belongsToCancelledRoom) {
          transaction.status = TransactionStatus.VOIDED
          transaction.isVoided = true
          transaction.voidedDate = DateTime.now()
          transaction.voidReason = `Reservation cancelled: ${reason || 'N/A'}`
          transaction.lastModifiedBy = userId
          await transaction.save()
          transactionsCancelled++
        }
      }

      // Recalcul du solde

    await FolioService.updateFolioTotals(folio.id)

      const freshFolio = await Folio.findOrFail(folio.id)
      const balance = freshFolio.balance

      if (isFullCancellation) {
        freshFolio.status = FolioStatus.CLOSED
        freshFolio.workflowStatus = WorkflowStatus.FINALIZED
        freshFolio.closedDate = DateTime.now()
        freshFolio.closedBy = userId
        freshFolio.settlementStatus =
          balance > 0 ? SettlementStatus.PENDING : SettlementStatus.SETTLED
        if (balance < 0) {
          freshFolio.refundAmount = round2(Math.abs(balance))
        }
        foliosClosed++
      }
      freshFolio.lastModifiedBy = userId
      await freshFolio.save()
      await LoggerService.log({
        actorId: userId,
        action: isFullCancellation ? 'FOLIO_CLOSED_ON_CANCELLATION' : 'FOLIO_UPDATED_ON_PARTIAL_CANCELLATION',
        entityType: 'Folio',
        entityId: folio.id,
        reservationId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Folio ${folio.folioNumber} updated on ${isFullCancellation ? 'full' : 'partial'} cancellation of reservation #${reservation.reservationNumber}. Balance: ${balance}`,
        meta: { folioId: folio.id, balance, remainingDue, refundDue, isFullCancellation },
        ctx,
      })
    }

    // 3. Mise à jour de la réservation — CANCELLED uniquement si TOUTES les
    // chambres actives sont annulées ; sinon la réservation reste active.
    const now = DateTime.now()
    if (isFullCancellation) {
      reservation.merge({
        status: ReservationStatus.CANCELLED,
        cancellationReason: reason || null,
        cancellationDate: now,
        cancelledByUserId: userId,
        lastModifiedBy: userId,
        cancellationType: evaluation.cancellationType,
        cancellationFeeAmount: feeAmount,
        cancellationFeeWaived: feeWaived,
        cancellationWaiveReason: feeWaived ? waiveReason || null : null,
      })
    } else {
      reservation.merge({ lastModifiedBy: userId })
    }
    await reservation.save()

    const cancelledList = cancelledRooms.length > 0 ? `[${cancelledRooms.join(', ')}]` : '(none)'

    // 4. Log d'audit global
    await LoggerService.log({
      actorId: userId,
      action: isFullCancellation ? 'CANCEL' : 'PARTIAL_CANCEL',
      entityType: 'Reservation',
      entityId: reservation.id,
      reservationId: reservation.id,
      hotelId: reservation.hotelId,
      description: `Reservation #${reservation.reservationNumber} ${isFullCancellation ? 'cancelled' : 'partially cancelled'} (${evaluation.cancellationType === 'late' ? 'Cancelled - Late' : 'in window'}). Rooms: ${cancelledList}. Reason: ${reason || 'N/A'}. Fee: ${feeAmount}${feeWaived ? ' (WAIVED)' : ''}.`,
      meta: {
        reason,
        waiveReason: feeWaived ? waiveReason : null,
        cancellationType: evaluation.cancellationType,
        cancellationFeeAmount: feeAmount,
        isFullCancellation,
        paidAmount,
        remainingDue,
        refundDue,
        cancelledRooms,
        foliosClosed,
        transactionsCancelled,
      },
      ctx,
    })

    // 5. Créance client : alerter dans les logs (indicateur "dette / pénalité non réglée")
    if (isLate && !feeWaived && remainingDue > 0 && reservation.guestId) {
      await LoggerService.log({
        actorId: userId,
        action: 'GUEST_CANCELLATION_DEBT',
        entityType: 'Guest',
        entityId: reservation.guestId,
        reservationId: reservation.id,
        hotelId: reservation.hotelId,
        description: `Guest #${reservation.guestId}: unpaid cancellation penalty of ${remainingDue} on reservation #${reservation.reservationNumber}`,
        meta: { remainingDue, feeAmount, paidAmount, reservationId: reservation.id },
        ctx,
      })
    }

    // Notifications + résumé client (en arrière-plan)
    setImmediate(async () => {
      try {
        await GuestSummaryService.recomputeFromReservation(reservation.id)
      } catch (error) {
        console.error('GuestSummary recompute failed after cancellation:', error)
      }
    })

    const partialLabel = isFullCancellation ? '' : 'partielle '
    const summaryMessage = feeWaived
      ? `Annulation ${partialLabel}tardive exonérée — aucun frais imputé (dérogation manager).`
      : !isLate
        ? isFullCancellation
          ? 'Annulation dans les délais — aucun frais, Folio soldé.'
          : 'Chambre(s) annulée(s) dans les délais — aucun frais.'
        : remainingDue > 0
          ? `Annulation ${partialLabel}tardive — frais de ${feeAmount} imputés, reste à payer : ${remainingDue}.`
          : refundDue > 0
            ? `Annulation ${partialLabel}tardive — frais de ${feeAmount} imputés, à rembourser : ${refundDue}.`
            : `Annulation ${partialLabel}tardive — frais de ${feeAmount} imputés et couverts par l'acompte.`

    return {
      reservationId: reservation.id,
      reservationNumber: reservation.reservationNumber,
      status: isFullCancellation ? String(ReservationStatus.CANCELLED) : String(reservation.status),
      cancellationType: evaluation.cancellationType,
      isFullCancellation,
      feeAmount,
      feeAmountWithTax,
      feeWaived,
      waiveReason: feeWaived ? waiveReason || null : null,
      paidAmount,
      remainingDue,
      refundDue,
      foliosClosed,
      transactionsCancelled,
      feeTransactionsPosted,
      cancelledRooms,
      summaryMessage,
    }
  }

  /**
   * Indicateur "dette / pénalité d'annulation non réglée" d'un client :
   * liste des annulations tardives non exonérées avec reste à payer > 0.
   */
  static async getGuestOutstandingDebts(guestId: number) {
    const cancelledReservations = await Reservation.query()
      .where('guestId', guestId)
      .where('status', ReservationStatus.CANCELLED)
      .where('cancellationType', 'late')
      .where('cancellationFeeWaived', false)
      .whereNotNull('cancellationFeeAmount')
      .where('cancellationFeeAmount', '>', 0)
      .orderBy('cancellationDate', 'desc')

    const debts: Array<{
      reservationId: number
      reservationNumber: string | null
      cancellationDate: DateTime | null
      feeAmount: number
      remainingDue: number
    }> = []

    for (const reservation of cancelledReservations) {
      const folios = await Folio.query().where('reservationId', reservation.id)
      let paid = 0
      for (const folio of folios) {
        const payments = await (folio as any)
          .related('transactions')
          .query()
          .where('transactionType', TransactionType.PAYMENT)
          .whereNotIn('status', [TransactionStatus.CANCELLED, TransactionStatus.VOIDED])
        for (const payment of payments) {
          paid += Math.abs(Number(payment.total_amount ?? payment.amount) || 0)
        }
      }
      const fee = Number(reservation.cancellationFeeAmount) || 0
      const remainingDue = round2(Math.max(0, fee - paid))
      if (remainingDue > 0) {
        debts.push({
          reservationId: reservation.id,
          reservationNumber: reservation.reservationNumber,
          cancellationDate: reservation.cancellationDate ?? null,
          feeAmount: fee,
          remainingDue,
        })
      }
    }

    return {
      hasOutstandingDebt: debts.length > 0,
      totalOutstanding: round2(debts.reduce((sum, d) => sum + d.remainingDue, 0)),
      debts,
    }
  }
}
