import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'
import IpConfiguration from '#models/ip_configuration'
import LoggerService from '#services/logger_service'

export default class IpRestrictionMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    try {
      const clientIpRaw = ctx.request.ip() || ''
      const clientIp = clientIpRaw.includes(':') ? clientIpRaw.split(':').pop() || clientIpRaw : clientIpRaw
      const headerHotel = ctx.request.header('x-hotel-code') || ctx.request.header('X-Hotel-Code')
      const hotelId = headerHotel ? Number(String(headerHotel).trim()) : undefined
      if (!hotelId || Number.isNaN(hotelId)) {
        return next()
      }

      const configs = await IpConfiguration.query().where('hotel_id', hotelId)
      if (configs.length === 0) {
        return next()
      }

      const allowed = configs.some((c) => {
        const pattern = (c.ipAddress || '').trim()
        const p = pattern.split('.')
        const ip = (clientIp || '').split('.')
        if (p.length !== 4 || ip.length !== 4) {
          return pattern === clientIp
        }
        for (let i = 0; i < 4; i++) {
          if (p[i] === '*') continue
          if (p[i] !== ip[i]) return false
        }
        return true
      })

      if (!allowed) {
        await LoggerService.log({
          action: 'LOGIN_BLOCKED_IP',
          actorId: 1,
          entityType: 'Hotel',
          entityId: String(hotelId),
          description: `Login blocked: IP ${clientIp} not allowed`,
          ctx,
          hotelId,
        })
        return ctx.response.unauthorized({ message: `IP address not allowed ${clientIp}` })
      }

      return next()
    } catch {
      return next()
    }
  }
}