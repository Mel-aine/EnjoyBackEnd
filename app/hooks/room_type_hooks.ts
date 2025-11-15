import RoomType from '#models/room_type'
import Room from '#models/room'
import { ChannexService } from '#services/channex_service'
import LoggerService from '#services/logger_service'

export default class RoomTypeHook {
  public static async notifyChannexOnCreate(roomType: RoomType) {
    try {
      await roomType.load('hotel')
      const propertyId = roomType.hotel?.channexPropertyId
      if (!propertyId) return
      const roomCount = await Room.query()
        .where('room_type_id', roomType.id)
        .where('hotel_id', roomType.hotelId)
        .count('* as total')

      const payload: any = {
        room_type: {
          property_id: propertyId,
          title: roomType.roomTypeName,
          count_of_rooms: parseInt(roomCount[0].$extras.total) || 1,
          occ_adults: roomType.maxAdult,
          occ_children: roomType.maxChild,
          occ_infants: roomType.maxChild || 0,
          default_occupancy: roomType.baseAdult,
          room_kind: 'room',
          capacity: null,
          facilities: [],
          content: { description: '' },
        },
      }

      const service = new ChannexService()
      const res: any = await service.createRoomType(propertyId, payload)
      const returnedId = res?.data?.data?.id || res?.data?.id || res?.id || null
      if (returnedId) {
        await RoomType.query().where('id', roomType.id).update({ channex_room_type_id: returnedId })
      }
    } catch (err) {
      try {
        await LoggerService.logActivity({
          action: 'ERROR',
          resourceType: 'RoomTypeChannex',
          resourceId: roomType.id,
          description: 'notifyChannexOnCreate failed',
          details: { error: (err as any)?.message },
          hotelId: roomType.hotelId,
        })
      } catch {}
    }
  }

  public static async notifyChannexOnUpdate(roomType: RoomType) {
    try {
      await roomType.load('hotel')
      const propertyId = roomType.hotel?.channexPropertyId
      if (!propertyId) return

      const wasDeleted = (roomType as any).$original?.isDeleted === true
      const nowDeleted = roomType.isDeleted === true
      if (nowDeleted && (roomType as any).$dirty?.isDeleted && roomType.channexRoomTypeId) {
        const service = new ChannexService()
        await service.deleteRoomType(propertyId, roomType.channexRoomTypeId)
        return
      }

      const prevPublish = (roomType as any).$original?.publishToWebsite
      const currPublish = roomType.publishToWebsite
      if (typeof prevPublish !== 'undefined' && prevPublish !== currPublish) {
        const service = new ChannexService()
        if (!currPublish && roomType.channexRoomTypeId) {
          await service.deleteRoomType(propertyId, roomType.channexRoomTypeId)
          return
        }
        if (currPublish) {
          const roomCount = await Room.query()
            .where('room_type_id', roomType.id)
            .where('hotel_id', roomType.hotelId)
            .count('* as total')
          const payload: any = {
            room_type: {
              property_id: propertyId,
              title: roomType.roomTypeName,
              count_of_rooms: parseInt(roomCount[0].$extras.total) || 1,
              occ_adults: roomType.maxAdult,
              occ_children: roomType.maxChild,
              occ_infants: roomType.maxChild || 0,
              default_occupancy: roomType.baseAdult,
              room_kind: 'room',
              capacity: null,
              facilities: [],
              content: { description: '' },
            },
          }
          if (roomType.channexRoomTypeId) {
            await service.updateRoomType(propertyId, roomType.channexRoomTypeId, payload)
          } else {
            const res: any = await service.createRoomType(propertyId, payload)
            const returnedId = res?.data?.data?.id || res?.data?.id || res?.id || null
            if (returnedId) {
              await RoomType.query().where('id', roomType.id).update({ channex_room_type_id: returnedId })
            }
          }
          return
        }
      }

      const roomCount = await Room.query()
        .where('room_type_id', roomType.id)
        .where('hotel_id', roomType.hotelId)
        .count('* as total')

      const payload: any = {
        room_type: {
          property_id: propertyId,
          title: roomType.roomTypeName,
          count_of_rooms: parseInt(roomCount[0].$extras.total) || 1,
          occ_adults: roomType.maxAdult,
          occ_children: roomType.maxChild,
          occ_infants: roomType.maxChild || 0,
          default_occupancy: roomType.baseAdult,
          room_kind: 'room',
          capacity: null,
          facilities: [],
          content: { description: '' },
        },
      }

      const service = new ChannexService()
      if (wasDeleted && !nowDeleted) {
        if (roomType.channexRoomTypeId) {
          await service.updateRoomType(propertyId, roomType.channexRoomTypeId, payload)
        } else {
          const res: any = await service.createRoomType(propertyId, payload)
          const returnedId = res?.data?.data?.id || res?.data?.id || res?.id || null
          if (returnedId) {
            await RoomType.query().where('id', roomType.id).update({ channex_room_type_id: returnedId })
          }
        }
        return
      }

      if (roomType.channexRoomTypeId) {
        await service.updateRoomType(propertyId, roomType.channexRoomTypeId, payload)
      } else {
        const res: any = await service.createRoomType(propertyId, payload)
        const returnedId = res?.data?.data?.id || res?.data?.id || res?.id || null
        if (returnedId) {
          await RoomType.query().where('id', roomType.id).update({ channex_room_type_id: returnedId })
        }
      }
    } catch (err) {
      try {
        await LoggerService.logActivity({
          action: 'ERROR',
          resourceType: 'RoomTypeChannex',
          resourceId: roomType.id,
          description: 'notifyChannexOnUpdate failed',
          details: { error: (err as any)?.message },
          hotelId: roomType.hotelId,
        })
      } catch {}
    }
  }
}