import { BaseCommand, args, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import RoomRate from '#models/room_rate'

export default class ListMissingChannexRates extends BaseCommand {
  static commandName = 'channex:list-missing-rates'
  static description = 'List RoomRates that have no channexRateId for a given hotel'

  static options: CommandOptions = {
    startApp: true,
  }

  @args.string({ description: 'Hotel ID', required: false })
  declare hotelIdArg: string

  @flags.number({ alias: 'h', description: 'Hotel ID' })
  declare hotelIdFlag: number

  @flags.boolean({ alias: 's', description: 'Show sync errors (try to sync and report failures)', default: false })
  declare showErrors: boolean

  async run() {
    const hotelId = Number(this.hotelIdFlag || this.hotelIdArg)

    if (!hotelId || isNaN(hotelId)) {
      this.logger.error('Please provide a valid Hotel ID using argument or -h flag')
      return
    }

    this.logger.info(`=== Missing Channex Rates — Hotel ${hotelId} ===`)
    this.logger.info('')

    // Fetch all RoomRates without channexRateId
    const rates = await RoomRate.query()
      .where('hotel_id', hotelId)
      .whereNull('channex_rate_id')
      .preload('roomType')
      .preload('rateType')

    if (rates.length === 0) {
      this.logger.success('All RoomRates have a channexRateId ✅')
      return
    }

    this.logger.info(`Found ${rates.length} RoomRate(s) without channexRateId:`)
    this.logger.info('')

    console.table(
      rates.map((r) => ({
        ID: r.id,
        'Room Type': r.roomType?.roomTypeName || 'N/A',
        'Rate Type': r.rateType?.rateTypeName || 'N/A',
        'Base Rate': r.baseRate,
        'Published': r.isPublished ? 'Yes' : 'No',
        'Created At': r.createdAt?.toFormat('yyyy-MM-dd HH:mm') || 'N/A',
      }))
    )

    // Optionally try to sync and report errors
    if (this.showErrors) {
      this.logger.info('')
      this.logger.info('--- Attempting to sync and report errors ---')

      const { default: ChannexRatePlanService } = await import('#services/channex_rate_plan_service')
      const { default: Hotel } = await import('#models/hotel')

      const hotel = await Hotel.find(hotelId)
      if (!hotel || !hotel.channexPropertyId) {
        this.logger.error(`Hotel ${hotelId} has no channexPropertyId — cannot sync`)
        return
      }

      const service = new ChannexRatePlanService()
      let synced = 0
      let failed = 0
      const errors: Array<{ id: number; roomType: string; rateType: string; error: string }> = []

      for (const rate of rates) {
        try {
          await service.syncRoomRate(rate, hotel.channexPropertyId)
          synced++
          this.logger.info(`  ✅ Synced RoomRate #${rate.id}`)
        } catch (err: any) {
          failed++
          errors.push({
            id: rate.id,
            roomType: rate.roomType?.roomTypeName || 'N/A',
            rateType: rate.rateType?.rateTypeName || 'N/A',
            error: err.message || String(err),
          })
          this.logger.error(`  ❌ Failed RoomRate #${rate.id}: ${err.message}`)
        }
      }

      this.logger.info('')
      this.logger.info(`Synced: ${synced} | Failed: ${failed}`)

      if (errors.length) {
        this.logger.info('')
        this.logger.info('Errors:')
        console.table(errors)
      }
    }
  }
}
