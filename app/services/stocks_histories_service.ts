import StocksHistory from '#models/stocks_history'
import type { HttpContext } from '@adonisjs/core/http'

interface ActionData {
  actionType: string
  resourceType: string
  resourceId?: number
  description: string
  serviceId?: number
  oldValues?: any
  newValues?: any
  metadata?: any
}

export default class ActionHistoryService {
  public static async log(
    ctx: HttpContext,
    actionData: ActionData,
    userId?: number
  ): Promise<StocksHistory> {
    return await StocksHistory.create({
      user_id: userId ?? ctx.auth.user?.id ?? null,
      action_type: actionData.actionType,
      resource_type: actionData.resourceType,
      service_id: actionData.serviceId ?? null,
      resource_id: actionData.resourceId ?? null,
      action_description: actionData.description,
    })
  }

  public static async logAuth(
    ctx: HttpContext,
    actionType: 'login' | 'logout' | 'register',
    serviceId?: number,
    userId?: number
  ): Promise<StocksHistory> {
    const descriptions = {
      login: 'Connexion à l\'application',
      logout: 'Déconnexion de l\'application',
      register: 'Inscription à l\'application',
    }

    // Get session ID safely using type assertion
    let sessionId: string | null = null
    try {
      const ctxWithSession = ctx as any
      sessionId = ctxWithSession.session?.sessionId ?? null
    } catch (error) {
      // Session middleware might not be available
      sessionId = null
    }

    return await this.log(ctx, {
      actionType,
      resourceType: 'auth',
      description: descriptions[actionType],
      serviceId,
      metadata: {
        timestamp: new Date().toISOString(),
        session_id: sessionId,
      }
    }, userId)
  }

  public static async logCrud(
    ctx: HttpContext,
    actionType: 'create' | 'update' | 'delete' | 'view' | 'patch',
    resourceType: string,
    resourceId: number,
    serviceId?: number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<StocksHistory> {
    const descriptions = {
      create: `Création d'un(e) ${resourceType}`,
      update: `Mise à jour d'un(e) ${resourceType}`,
      delete: `Suppression d'un(e) ${resourceType}`,
      view: `Consultation d'un(e) ${resourceType}`,
      patch: `Modification partielle d'un(e) ${resourceType}`,
    }

    return await this.log(ctx, {
      actionType,
      resourceType,
      resourceId,
      description: descriptions[actionType],
      serviceId,
      oldValues,
      newValues,
    })
  }

  public static async logCustom(
    ctx: HttpContext,
    actionType: string,
    resourceType: string,
    description: string,
    serviceId?: number,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>
  ): Promise<StocksHistory> {
    return await this.log(ctx, {
      actionType,
      resourceType,
      description,
      serviceId,
      oldValues,
      newValues,
    })
  }
}
