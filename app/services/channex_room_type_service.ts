// app/Services/ChannexRoomTypeService.ts
import { ChannexService } from '#services/channex_service'
import logger from '@adonisjs/core/services/logger'
import RoomType from '#models/room_type'

export default class ChannexRoomTypeService {
  private channexService: ChannexService

  constructor() {
    this.channexService = new ChannexService()
  }

  /**
   * Créer ou mettre à jour un Room Type sur Channex
   */
  async syncRoomType(roomType: RoomType, hotelChannexId: string) {
    try {
      // Compter le nombre de chambres actives de ce type
      const activeRoomsCount = await roomType.related('rooms').query()
        .where('is_deleted', false)
        .count('* as total')

          // 🔥 CORRECTIONS :
      // 1. Convertir en number
      // 2. S'assurer d'avoir au moins 1 chambre (Channex peut rejeter 0)
      let countOfRooms = parseInt(activeRoomsCount[0].$extras.total) 
      if (countOfRooms === 0) {
        countOfRooms = 1 // Minimum 1 pour Channex
        console.log('⚠️  Room count was 0, setting to 1 for Channex')
      }

      const roomTypeData = {
        property_id: hotelChannexId,
        title: roomType.roomTypeName,
        count_of_rooms: countOfRooms,
        occ_adults: roomType.maxAdult,
        occ_children: roomType.maxChild,
        occ_infants: 0,
        default_occupancy: roomType.baseAdult + roomType.baseChild,
        facilities: [], // Tableau vide - pas de gestion d'aménités
        room_kind: "room",
        capacity: null,
        content: {
          description: this.getRoomTypeDescription(roomType),
          photos: [] // Tableau vide - pas de gestion de photos
        }
      }
          // 🔥 AJOUTEZ CE LOG CRITIQUE POUR VOIR LE PAYLOAD
    console.log('🔥 PAYLOAD SENT TO CHANNEX:', JSON.stringify({
        room_type: roomTypeData
      }, null, 2))
  
      logger.info(`Syncing room type ${roomType.id} with Channex`, { 
        roomTypeId: roomType.id,
        hotelChannexId,
        countOfRooms 
      })

      let response: any

      if (roomType.channexRoomTypeId) {
        // Mise à jour du room type existant
        response = await this.channexService.updateRoomType(
          hotelChannexId,
          roomType.channexRoomTypeId,
          { room_type: roomTypeData }
        )
        
        logger.info(`Room type ${roomType.id} updated on Channex`, {
          channexRoomTypeId: roomType.channexRoomTypeId
        })
      } else {
        // Création d'un nouveau room type
        response = await this.channexService.createRoomType(
          hotelChannexId,
          { room_type: roomTypeData }
        )
        
        // Sauvegarder l'ID Channex dans le room type
        if (response.data && response.data.id) {
          await roomType.merge({ channexRoomTypeId: response.data.id }).save()
          logger.info(`Room type ${roomType.id} created on Channex`, {
            channexRoomTypeId: response.data.id
          })
        }
      }

      return response

    } catch (error) {
      console.log('Failed to sync room type with Channex:', error)
      throw error
    }
  }

  /**
   * Désactiver un Room Type sur Channex (mettre count_of_rooms à 0)
   */
  async deactivateRoomType(roomType: RoomType, hotelChannexId: string) {
    try {
      if (!roomType.channexRoomTypeId) {
        logger.warn(`Cannot deactivate room type ${roomType.id} - no Channex ID`)
        return
      }

      const deactivationData = {
        room_type: {
          count_of_rooms: 0
        }
      }

      logger.info(`Deactivating room type ${roomType.id} on Channex`)

      const response = await this.channexService.updateRoomType(
        hotelChannexId,
        roomType.channexRoomTypeId,
        deactivationData
      )

      logger.info(`Room type ${roomType.id} deactivated on Channex`)
      return response

    } catch (error) {
      console.log('Failed to deactivate room type on Channex:', error)
      throw error
    }
  }

  /**
   * Supprimer définitivement un Room Type de Channex
   */
  async deleteRoomType(roomType: RoomType, hotelChannexId: string) {
    try {
      if (!roomType.channexRoomTypeId) {
        logger.warn(`Cannot delete room type ${roomType.id} - no Channex ID`)
        return
      }

      logger.info(`Deleting room type ${roomType.id} from Channex`)

      const response = await this.channexService.deleteRoomType(
        hotelChannexId,
        roomType.channexRoomTypeId
      )

      logger.info(`Room type ${roomType.id} deleted from Channex`)
      return response

    } catch (error) {
      logger.error('Failed to delete room type from Channex:', error)
      throw error
    }
  }

  /**
   * Récupérer les room types d'un hôtel depuis Channex
   */
  async getRoomTypesFromChannex(hotelChannexId: string) {
    try {
      return await this.channexService.getRoomType(hotelChannexId)
    } catch (error) {
      logger.error('Failed to get room types from Channex:', error)
      throw error
    }
  }

  /**
   * Récupérer un room type spécifique depuis Channex
   */
  async getRoomTypeFromChannex(roomTypeChannexId: string) {
    try {
      return await this.channexService.getRoomTypeById(roomTypeChannexId)
    } catch (error) {
      logger.error('Failed to get room type from Channex:', error)
      throw error
    }
  }

  /**
   * Générer la description du room type
   */
  private getRoomTypeDescription(roomType: RoomType): string {
    if (roomType.description) {
      return roomType.description
    }
    
    // Description par défaut basée sur les capacités
    const baseCapacity = roomType.baseAdult + roomType.baseChild
    const maxCapacity = roomType.maxAdult + roomType.maxChild
    
    return `${roomType.roomTypeName} (${roomType.shortCode}). Base occupancy: ${baseCapacity}, Max occupancy: ${maxCapacity}.`
  }

  /**
   * Vérifier si un room type existe sur Channex
   */
  async roomTypeExistsOnChannex(roomType: RoomType, hotelChannexId: string): Promise<boolean> {
    try {
      if (!roomType.channexRoomTypeId) {
        return false
      }
      
      await this.getRoomTypeFromChannex(roomType.channexRoomTypeId)
      return true
    } catch (error) {
      return false
    }
  }
}