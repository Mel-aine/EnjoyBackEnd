import type { HttpContext } from '@adonisjs/core/http'
import { ChannexService } from '../services/channex_service.js'
import LoggerService from '../services/logger_service.js'
import Hotel from '../models/hotel.js'
import RoomType from '../models/room_type.js'
import Room from '../models/room.js'
import RoomRate from '../models/room_rate.js'
import Reservation from '../models/reservation.js'
import Guest from '../models/guest.js'
import ReservationRoom from '../models/reservation_room.js'
import logger from '@adonisjs/core/services/logger'
import axios from 'axios'
import { generateGuestCode } from '../utils/generate_guest_code.js'
import  ReservationCreationService  from '../services/reservation_creation_service.js'
import env from '#start/env'
import { DateTime } from 'luxon'
import { ChannexRestrictionType } from '#app/enums'


export default class ChannexRestrictionsController {
    private channexService: ChannexService

    constructor() {
      // Initialize Channex service (will use environment variables)
      this.channexService = new ChannexService()
    }

    async getRestrictions({ params, request, response }: HttpContext) {
        try {
          const { propertyId } = params
          const { rate_plan_ids, date_from, date_to, restrictions } = request.body()

            // Validation des paramètres requis
            /* if (!rate_plan_ids || !Array.isArray(rate_plan_ids) || rate_plan_ids.length === 0) {
            return response.badRequest({
              error: 'rate_plan_ids est requis et doit être un tableau non vide'
            })
          } */
             
            console.log('params', rate_plan_ids, date_from, date_to, restrictions )
          // Validation de date_from et date_to
          if (!date_from || !date_to) {
            return response.badRequest({
              error: 'date_from et date_to sont requis au format YYYY-MM-DD'
            })
          }
      
          // Validation du format des dates
          const dateFromValid = /^\d{4}-\d{2}-\d{2}$/.test(date_from)
          const dateToValid = /^\d{4}-\d{2}-\d{2}$/.test(date_to)
      
          if (!dateFromValid || !dateToValid) {
            return response.badRequest({
              error: 'Les dates doivent être au format YYYY-MM-DD'
            })
          }
      
          // Validation des restrictions
          if (!restrictions || typeof restrictions !== 'string') {
            return response.badRequest({
              error: 'restrictions est requis et doit être une chaîne de caractères'
            })
          }
      
          // Séparer les restrictions et valider chacune
          const restrictionsList = restrictions.split(',').map(r => r.trim())
          const validRestrictions = Object.values(ChannexRestrictionType) as string[]
          
          const invalidRestrictions = restrictionsList.filter(
            r => !validRestrictions.includes(r)
          )
      
          if (invalidRestrictions.length > 0) {
            return response.badRequest({
              error: `Restrictions invalides: ${invalidRestrictions.join(', ')}`,
              valid_restrictions: validRestrictions
            })
          }
      
          // Validation optionnelle de rate_plan_ids
          if (rate_plan_ids !== undefined) {
            if (!Array.isArray(rate_plan_ids) || rate_plan_ids.length === 0) {
              return response.badRequest({
                error: 'rate_plan_ids doit être un tableau non vide s\'il est fourni'
              })
            }
          }
      
          // Appel au service Channex
          const restrictionsData = await this.channexService.getRestrictions(propertyId, {
            rate_plan_ids,
            date_from,
            date_to,
            restrictions
          })
      
          return response.ok({
            success: true,
            data: restrictionsData
          })
      
        } catch (error) {
          logger.error('Erreur lors de la récupération des restrictions:', error)
          
          return response.status(error.status || 500).json({
            success: false,
            error: error.message || 'Erreur lors de la récupération des restrictions'
          })
        }
      }

}