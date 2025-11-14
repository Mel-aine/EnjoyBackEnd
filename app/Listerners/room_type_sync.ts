// app/Listeners/RoomTypeSync.ts
import RoomType from '#models/room_type'
import ChannexRoomTypeService from '#services/channex_room_type_service'
import logger from '@adonisjs/core/services/logger'

export default class RoomTypeSync {
  private static channexService = new ChannexRoomTypeService()

  /**
   * Gérer les changements de Room Type
   */
  public static async handleRoomTypeChange(roomType: RoomType) {

    console.log('🎯 🎯 🎯 ROOM TYPE SYNC TRIGGERED!', {
      roomTypeId: roomType.id,
      roomTypeName: roomType.roomTypeName,
      action: 'CREATE/UPDATE'
    })
    try {
      // Charger la relation hotel
      await roomType.load('hotel')

      // Vérifier si l'hôtel est configuré pour Channex
      if (!roomType.hotel.channexPropertyId) {
        logger.warn(`Hotel ${roomType.hotelId} not configured for Channex sync`)
        return
      }

      // Ne pas synchroniser si le room type est supprimé
      if (roomType.isDeleted) {
        await this.handleDeletedRoomType(roomType)
        return
      }

      logger.info(`Synchronisation du Room Type ${roomType.id} avec Channex`)

      // Synchroniser selon le statut de publication
      if (roomType.publishToWebsite) {
        await this.channexService.syncRoomType(roomType, roomType.hotel.channexPropertyId)
        logger.info(`Room Type ${roomType.id} synchronisé avec Channex`)
      } else {
        // Si non publié, désactiver sur Channex
        await this.channexService.deactivateRoomType(roomType, roomType.hotel.channexPropertyId)
        logger.info(`Room Type ${roomType.id} désactivé sur Channex (unpublished)`)
      }

    } catch (error) {
      console.log('Erreur lors de la synchronisation avec Channex:', error)
    }
  }

  /**
   * Gérer la suppression de Room Type
   */
  public static async handleRoomTypeDeletion(roomType: RoomType) {
    try {
      // Charger la relation hotel
      await roomType.load('hotel')

      if (!roomType.hotel.channexPropertyId) {
        return
      }

      logger.info(`Suppression définitive du Room Type ${roomType.id} de Channex`)
      
      await this.channexService.deleteRoomType(roomType, roomType.hotel.channexPropertyId)
      logger.info(`Room Type ${roomType.id} supprimé définitivement de Channex`)

    } catch (error) {
      logger.error('Erreur lors de la suppression sur Channex:', error)
    }
  }

  /**
   * Gérer les room types supprimés logiquement
   */
  private static async handleDeletedRoomType(roomType: RoomType) {
    try {
      if (roomType.hotel.channexPropertyId) {
        logger.info(`Désactivation du Room Type ${roomType.id} sur Channex (soft delete)`)
        await this.channexService.deactivateRoomType(roomType, roomType.hotel.channexPropertyId)
        logger.info(`Room Type ${roomType.id} désactivé sur Channex`)
      }
    } catch (error) {
      logger.error('Erreur lors de la désactivation sur Channex:', error)
    }
  }

  /**
   * Synchronisation manuelle
   */
  public static async manualSync(roomType: RoomType) {
    try {
      await roomType.load('hotel')
      
      if (!roomType.hotel.channexPropertyId) {
        throw new Error('Hotel not configured for Channex synchronization')
      }

      return await this.channexService.syncRoomType(roomType, roomType.hotel.channexPropertyId)
    } catch (error) {
      logger.error('Manual sync failed:', error)
      throw error
    }
  }
}