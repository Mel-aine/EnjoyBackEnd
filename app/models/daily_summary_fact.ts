import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class DailySummaryFact extends BaseModel {
  public static table = 'daily_summary_facts'

  @column({ isPrimary: true })
  declare auditDate: DateTime

  @column()
  declare hotelId: number

  // Revenue Fields
  @column()
  declare totalRoomRevenue: number

  @column()
  declare totalFoodBeverageRevenue: number

  @column()
  declare totalMiscellaneousRevenue: number

  @column()
  declare totalTaxes: number

  @column()
  declare totalResortFees: number

  @column()
  declare totalRevenue: number

  @column()
  declare totalPayments: number

  @column()
  declare totalDiscounts: number

  // Occupancy Fields
  @column()
  declare occupiedRooms: number

  @column()
  declare totalAvailableRooms: number

  @column()
  declare occupancyRate: number

  @column()
  declare revPAR: number // Revenue Per Available Room

  @column()
  declare adr: number // Average Daily Rate

  // Guest Activity Fields
  @column()
  declare numCheckedIn: number

  @column()
  declare numCheckedOut: number

  @column()
  declare numNoShows: number

  @column()
  declare numCancellations: number

  @column()
  declare numBookingsMade: number

  // Financial Fields
  @column()
  declare totalPaymentsReceived: number

  @column()
  declare totalAccountsReceivable: number

  @column()
  declare totalOutstandingFolios: number

  @column()
  declare totalOutstandingFoliosBalance: number

  @column({
    columnName: 'manager_report_data',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare managerReportData: object | null

  @column({
    columnName: 'night_audit_report_data',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare nightAuditReportData: object | null
  @column({
    columnName: 'daily_revenue_report_data',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare dailyRevenueReportData: object | null

  @column({
    columnName: 'room_status_report_data',
    serialize: (value: object | null) => value,
    prepare: (value: object | null) => value ? JSON.stringify(value) : null,
    consume: (value: string | object | null) => {
      if (value === null) return null;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      }
      return typeof value === 'object' ? value : null;
    }
  })
  declare roomStatusReportData: object | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}