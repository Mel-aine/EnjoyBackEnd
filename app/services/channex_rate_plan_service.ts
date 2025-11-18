// app/Services/ChannexRoomRateService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomRate from '#models/room_rate'
export default class ChannexRatePlanService {
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
        
        "rate_plan": {
            type: 'rate_plan',
            title: await this.getRatePlanTitle(roomRate),
            property_id: hotelChannexId,
            room_type_id: roomRate.roomType.channexRoomTypeId,
            sell_mode: 'per_room',
            rate_mode: 'manual',
            currency: 'XAF', // Vous pouvez ajouter une colonne currency dans RoomRate si nécessaire
            options: [
              {
                occupancy: roomRate.roomType.maxAdult,
                is_primary: true,
                rate: roomRate.baseRate || 100
              }
            ],
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
          
        }
      }

      console.log('ratePlanData', ratePlanData)

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
   * Obtenir le titre du rate plan basé sur RoomRate - CORRIGÉ
   */
 private async getRatePlanTitle(roomRate: RoomRate): Promise<string> {

     roomRate.load('roomType')
     roomRate.load('rateType')
    
    const roomTypeName = roomRate.roomType?.roomTypeName  
    const rateTypeName = roomRate.rateType?.rateTypeName
    
    // S'assurer que le titre n'est jamais vide et a une longueur raisonnable
    let title = `${roomTypeName} - ${rateTypeName} `
    
    // Tronquer si trop long (max 255 caractères pour Channex)
    if (title.length > 255) {
      title = title.substring(0, 252) + '...'
    }
    
    return title
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