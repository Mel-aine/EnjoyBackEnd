import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import RoomsController from '#controllers/rooms_controller'
import { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

export default class TestBookingData extends BaseCommand {
  public static commandName = 'test:booking-data'
  public static description = 'Test getFrontOfficeBookingData'
  public static options: CommandOptions = { startApp: true }

  @flags.number({ description: 'Hotel ID', alias: 'h' })
  declare hotelId: number | undefined

  @flags.string({ description: 'Start Date (YYYY-MM-DD)', alias: 's' })
  declare startDate: string | undefined

  @flags.string({ description: 'End Date (YYYY-MM-DD)', alias: 'e' })
  declare endDate: string | undefined

  public async run() {
    const hotelId = this.hotelId || 3
    const startDate = this.startDate || DateTime.now().toISODate()
    const endDate = this.endDate || DateTime.now().plus({ days: 1 }).toISODate()

    this.logger.info(`Fetching booking data for Hotel ${hotelId} from ${startDate} to ${endDate}...`)

    const controller = new RoomsController()
    
    // Mock HttpContext
    const ctx = {
      params: { hotelId },
      request: {
        only: () => ({ startDate, endDate })
      },
      response: {
        ok: (data: any) => {
            console.log(JSON.stringify(data, null, 2))
            return data
        },
        badRequest: (data: any) => {
            console.error('BadRequest:', data)
            return data
        },
        internalServerError: (data: any) => {
            console.error('InternalServerError:', data)
            return data
        }
      }
    } as unknown as HttpContext

    await controller.getFrontOfficeBookingData(ctx)
  }
}
