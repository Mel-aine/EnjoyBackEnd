// app/Services/ChannexRoomRateService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomRate from '#models/room_rate'
import RoomType from '#models/room_type'

export default class ChannexRoomTypeService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * Créer ou mettre à jour un Rate Plan sur Channex basé sur RoomRate
   */
  async syncRoomRate(roomRate: RoomRate, hotelChannexId: string) {
    try {
      // Charger les relations nécessaires
      await roomRate.load('roomType')

      if (!roomRate.roomType?.channexRoomTypeId) {
        throw new Error('Room type must be synced with Channex first')
      }

      const ratePlanData = {
        data: {
          type: 'rate_plan',
          attributes: {
            title: await this.getRatePlanTitle(roomRate),
            sell_mode: 'per_room',
            rate_mode: this.mapRateMode(roomRate),
            currency: 'EUR', // Vous pouvez ajouter une colonne currency dans RoomRate si nécessaire
            children_fee: roomRate.extraChildRate?.toString() || '0.00',
            infant_fee: '0.00',
            max_stay: this.getMaxStayArray(roomRate),
            min_stay_arrival: this.getMinStayArrivalArray(roomRate),
            min_stay_through: this.getMinStayThroughArray(roomRate),
            closed_to_arrival: this.getClosedToArrivalArray(roomRate),
            closed_to_departure: this.getClosedToDepartureArray(roomRate),
            stop_sell: this.getStopSellArray(roomRate),
            options: await this.getRateOptions(roomRate),
            inherit_rate: false,
            inherit_closed_to_arrival: false,
            inherit_closed_to_departure: false,
            inherit_stop_sell: false,
            inherit_min_stay_arrival: false,
            inherit_min_stay_through: false,
            inherit_max_stay: false,
            inherit_availability_offset: false,
            inherit_max_sell: false,
            inherit_max_availability: false,
            auto_rate_settings: null,
            meal_type: await this.mapMealType(roomRate)
          },
          relationships: {
            room_type: {
              data: {
                type: 'room_type',
                id: roomRate.roomType.channexRoomTypeId
              }
            },
            property: {
              data: {
                type: 'property',
                id: hotelChannexId
              }
            }
          }
        }
      }

      logger.info(`Syncing room rate ${roomRate.id} with Channex`, {
        roomRateId: roomRate.id,
        hotelChannexId,
        roomTypeId: roomRate.roomTypeId
      })

      let response: any

      if (roomRate.channexRateId) {
        // Mise à jour du rate plan existant
        response = await this.channexService.updateRatePlan(
          hotelChannexId,
          roomRate.channexRateId,
          ratePlanData
        )
        
        logger.info(`Room rate ${roomRate.id} updated on Channex`, {
          channexRateId: roomRate.channexRateId
        })
      } else {
        // Création d'un nouveau rate plan
        response = await this.channexService.createRatePlan(
          hotelChannexId,
          ratePlanData
        )
        
        // Sauvegarder l'ID Channex dans le room rate
        if (response.data && response.data.id) {
          await roomRate.merge({ channexRateId: response.data.id }).save()
          logger.info(`Room rate ${roomRate.id} created on Channex`, {
            channexRateId: response.data.id
          })
        }
      }

      return response

    } catch (error) {
      logger.error('Failed to sync room rate with Channex:', error)
      throw error
    }
  }

  /**
   * Synchroniser les taux pour une période via les rate plans
   */
  async syncRatePeriod(roomRates: RoomRate[], hotelChannexId: string) {
    try {
      if (roomRates.length === 0) {
        logger.warn('No room rates to sync')
        return
      }

      // Grouper les room rates par room type
      const ratesByRoomType = new Map()

      for (const roomRate of roomRates) {
        await roomRate.load('roomType')
        
        if (!roomRate.roomType?.channexRoomTypeId) {
          logger.warn(`Room type not synced for room rate ${roomRate.id}`)
          continue
        }

        const roomTypeId = roomRate.roomType.channexRoomTypeId
        
        if (!ratesByRoomType.has(roomTypeId)) {
          ratesByRoomType.set(roomTypeId, [])
        }

        ratesByRoomType.get(roomTypeId).push(roomRate)
      }

      // Synchroniser chaque room type
      for (const [roomTypeId, roomRatesForType] of ratesByRoomType) {
        // Prendre le premier room rate comme référence pour créer le rate plan
        const referenceRoomRate = roomRatesForType[0]
        await this.syncRoomRate(referenceRoomRate, hotelChannexId)
        
        logger.info(`Synced ${roomRatesForType.length} rates for room type ${roomTypeId}`)
      }

      logger.info(`Rate period synced for ${ratesByRoomType.size} room types`)

    } catch (error) {
      logger.error('Failed to sync rate period with Channex:', error)
      throw error
    }
  }

  /**
   * Désactiver un Room Rate sur Channex
   */
  async deactivateRoomRate(roomRate: RoomRate, hotelChannexId: string) {
    try {
      if (!roomRate.channexRateId) {
        logger.warn(`Cannot deactivate room rate ${roomRate.id} - no Channex ID`)
        return
      }

      const deactivationData = {
        data: {
          type: 'rate_plan',
          attributes: {
            stop_sell: [true, true, true, true, true, true, true]
          }
        }
      }

      logger.info(`Deactivating room rate ${roomRate.id} on Channex`)

      const response = await this.channexService.updateRatePlan(
        hotelChannexId,
        roomRate.channexRateId,
        deactivationData
      )

      logger.info(`Room rate ${roomRate.id} deactivated on Channex`)
      return response

    } catch (error) {
      logger.error('Failed to deactivate room rate on Channex:', error)
      throw error
    }
  }

  /**
   * Supprimer définitivement un Room Rate de Channex
   */
  async deleteRoomRate(roomRate: RoomRate, hotelChannexId: string) {
    try {
      if (!roomRate.channexRateId) {
        logger.warn(`Cannot delete room rate ${roomRate.id} - no Channex ID`)
        return
      }

      logger.info(`Deleting room rate ${roomRate.id} from Channex`)

      const response = await this.channexService.deleteRatePlan(
        hotelChannexId,
        roomRate.channexRateId
      )

      // Supprimer la référence Channex localement
      await roomRate.merge({ channexRateId: null }).save()

      logger.info(`Room rate ${roomRate.id} deleted from Channex`)
      return response

    } catch (error) {
      logger.error('Failed to delete room rate from Channex:', error)
      throw error
    }
  }

  /**
   * Obtenir les rate plans depuis Channex
   */
  async getRatePlansFromChannex(hotelChannexId: string) {
    try {
      return await this.channexService.getRatePlan(hotelChannexId)
    } catch (error) {
      logger.error('Failed to get rate plans from Channex:', error)
      throw error
    }
  }

  /**
   * Obtenir un rate plan spécifique depuis Channex
   */
  async getRatePlanFromChannex(ratePlanChannexId: string) {
    try {
      return await this.channexService.getRatePlanById(ratePlanChannexId)
    } catch (error) {
      logger.error('Failed to get rate plan from Channex:', error)
      throw error
    }
  }

  /**
   * Obtenir le titre du rate plan basé sur RoomRate
   */
  private async getRatePlanTitle(roomRate: RoomRate): Promise<string> {
    await roomRate.load('roomType')
    
    const roomTypeName = roomRate.roomType?.roomTypeName || 'Unknown'
    const rateDate = roomRate.rateDate?.toFormat('dd/MM/yyyy') || 'Dynamic'
    
    return `${roomTypeName} - ${rateDate}`
  }

  /**
   * Mapper le mode de taux
   */
  private mapRateMode(roomRate: RoomRate): string {
    return roomRate.autoCalculated ? 'auto' : 'manual'
  }

  /**
   * Obtenir le tableau max_stay
   */
  private getMaxStayArray(roomRate: RoomRate): number[] {
    const maxStay = roomRate.maximumNights || 0
    return [maxStay, maxStay, maxStay, maxStay, maxStay, maxStay, maxStay]
  }

  /**
   * Obtenir le tableau min_stay_arrival
   */
  private getMinStayArrivalArray(roomRate: RoomRate): number[] {
    const minStay = roomRate.minimumNights || 1
    return [minStay, minStay, minStay, minStay, minStay, minStay, minStay]
  }

  /**
   * Obtenir le tableau min_stay_through
   */
  private getMinStayThroughArray(roomRate: RoomRate): number[] {
    const minStay = roomRate.minimumNights || 1
    return [minStay, minStay, minStay, minStay, minStay, minStay, minStay]
  }

  /**
   * Obtenir le tableau closed_to_arrival
   */
  private getClosedToArrivalArray(roomRate: RoomRate): boolean[] {
    const closed = roomRate.closedToArrival || false
    return [closed, closed, closed, closed, closed, closed, closed]
  }

  /**
   * Obtenir le tableau closed_to_departure
   */
  private getClosedToDepartureArray(roomRate: RoomRate): boolean[] {
    const closed = roomRate.closedToDeparture || false
    return [closed, closed, closed, closed, closed, closed, closed]
  }

  /**
   * Obtenir le tableau stop_sell
   */
  private getStopSellArray(roomRate: RoomRate): boolean[] {
    const stopSell = roomRate.stopSell || false
    return [stopSell, stopSell, stopSell, stopSell, stopSell, stopSell, stopSell]
  }

  /**
   * Obtenir les options de taux basées sur RoomRate
   */
  private async getRateOptions(roomRate: RoomRate): Promise<any[]> {
    const options = []

    // Option principale (occupation de base)
    const baseOccupancy = await this.getBaseOccupancy(roomRate)
    options.push({
      occupancy: baseOccupancy,
      is_primary: true,
      derived_option: null,
      rate: roomRate.baseRate
    })

    // Options pour les occupations supplémentaires
    if (roomRate.extraAdultRate && roomRate.extraAdultRate > 0) {
      options.push({
        occupancy: baseOccupancy + 1,
        is_primary: false,
        derived_option: 'extra_adult',
        rate: roomRate.extraAdultRate
      })
    }

    if (roomRate.extraChildRate && roomRate.extraChildRate > 0) {
      options.push({
        occupancy: baseOccupancy + 1,
        is_primary: false,
        derived_option: 'extra_child',
        rate: roomRate.extraChildRate
      })
    }

    // Options pour les différents types d'occupation
    if (roomRate.singleOccupancyRate && roomRate.singleOccupancyRate > 0) {
      options.push({
        occupancy: 1,
        is_primary: false,
        derived_option: 'single_occupancy',
        rate: roomRate.singleOccupancyRate
      })
    }

    if (roomRate.doubleOccupancyRate && roomRate.doubleOccupancyRate > 0) {
      options.push({
        occupancy: 2,
        is_primary: false,
        derived_option: 'double_occupancy',
        rate: roomRate.doubleOccupancyRate
      })
    }

    if (roomRate.tripleOccupancyRate && roomRate.tripleOccupancyRate > 0) {
      options.push({
        occupancy: 3,
        is_primary: false,
        derived_option: 'triple_occupancy',
        rate: roomRate.tripleOccupancyRate
      })
    }

    return options
  }

  /**
   * Obtenir l'occupation de base
   */
  private async getBaseOccupancy(roomRate: RoomRate): Promise<number> {
    await roomRate.load('roomType')
    const roomType = roomRate.roomType
    
    if (roomType) {
      return (roomType.baseAdult || 1) + (roomType.baseChild || 0)
    }
    
    return 1
  }

  /**
   * Mapper le type de repas
   */
  private async mapMealType(roomRate: RoomRate): Promise<string> {
    if (roomRate.mealPlanId) {
      await roomRate.load('mealPlan')
      const mealPlan = roomRate.mealPlan
      
      if (mealPlan) {
        const mealTypeMap: { [key: string]: string } = {
          'breakfast': 'breakfast',
          'lunch': 'lunch',
          'dinner': 'dinner',
          'all_inclusive': 'all_inclusive',
          'half_board': 'half_board',
          'full_board': 'full_board'
        }
        
        return mealTypeMap[mealPlan.name.toLowerCase()] || 'none'
      }
    }
    
    return 'none'
  }

  /**
   * Vérifier si un room rate existe sur Channex
   */
  async roomRateExistsOnChannex(roomRate: RoomRate, hotelChannexId: string): Promise<boolean> {
    try {
      if (!roomRate.channexRateId) {
        return false
      }
      
      await this.getRatePlanFromChannex(roomRate.channexRateId)
      return true
    } catch (error) {
      return false
    }
  }
}