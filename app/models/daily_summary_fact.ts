import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

export default class DailySummaryFact extends BaseModel {
  public static table = 'daily_summary_facts'

  @column({ isPrimary: true })
  public auditDate: DateTime

  @column()
  public hotelId: number

  // Revenue Fields
  @column()
  public totalRoomRevenue: number

  @column()
  public totalFoodBeverageRevenue: number

  @column()
  public totalMiscellaneousRevenue: number

  @column()
  public totalTaxes: number

  @column()
  public totalResortFees: number

  @column()
  public totalRevenue: number

  @column()
  public totalPayments: number

  @column()
  public totalDiscounts: number

  // Occupancy Fields
  @column()
  public occupiedRooms: number

  @column()
  public totalAvailableRooms: number

  @column()
  public occupancyRate: number

  @column()
  public revPAR: number // Revenue Per Available Room

  @column()
  public adr: number // Average Daily Rate

  // Guest Activity Fields
  @column()
  public numCheckedIn: number

  @column()
  public numCheckedOut: number

  @column()
  public numNoShows: number

  @column()
  public numCancellations: number

  @column()
  public numBookingsMade: number

  // Financial Fields
  @column()
  public totalPaymentsReceived: number

  @column()
  public totalAccountsReceivable: number

  @column()
  public totalOutstandingFolios: number

  @column()
  public totalOutstandingFoliosBalance: number

  @column.dateTime({ autoCreate: true })
  public createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  public updatedAt: DateTime
}