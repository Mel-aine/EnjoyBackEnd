// app/Models/Hooks/TransactionHook.ts
import { FolioStatus } from '../enums.js'
import Folio from '../models/folio.js'
import type FolioTransaction from '../models/folio_transaction.js'

export default class TransactionHook {
    public static async checkFolioStatus(transaction: FolioTransaction) {
        // Only proceed if the transaction has a folio ID
        if (!transaction.folioId) {
            return
        }

        const folio = await Folio.findOrFail(transaction.folioId)

        // Only change the status if the folio is currently open
        if (folio.status !== FolioStatus.OPEN && folio.status !== FolioStatus.CLOSED) {
            return
        }

        // Calculate the updated balance
        const newBalance = await folio.getOutstandingBalance()

        // If the balance is zero, update the folio status to 'CLOSED'
        if (newBalance === 0) {
            folio.status = FolioStatus.CLOSED
            await folio.save()
        } else if (folio.status === FolioStatus.CLOSED) {
            // If the balance is positive, update the folio status to 'OPEN'
            if (newBalance > 0) {
                folio.status = FolioStatus.OPEN
                await folio.save()
            }
        }
    }
}