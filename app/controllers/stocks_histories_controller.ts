
import type { HttpContext } from '@adonisjs/core/http'
import StocksHistory from '#models/stocks_history'
// import { DateTime } from 'luxon'

export default class StocksHistoriesController {
  public async index({ request, response, auth }: HttpContext) {
    try {
      const page = request.input('page', 1)
      const limit = request.input('limit', 20)
      const resourceType = request.input('resource_type')
      const actionType = request.input('action_type')
      const userId = request.input('user_id')
      const serviceId = request.input('service_id')
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = StocksHistory.query()
        .preload('user')
        .preload('service')
        .orderBy('created_at', 'desc')

      // Filtres
      if (resourceType) {
        query.where('resource_type', resourceType)
      }

      if (actionType) {
        query.where('action_type', actionType)
      }

      if (userId) {
        query.where('user_id', userId)
      }

      if (serviceId) {
        query.where('service_id', serviceId)
      }

      if (startDate) {
        query.where('created_at', '>=', startDate)
      }

      if (endDate) {
        query.where('created_at', '<=', endDate)
      }

      // Si l'utilisateur n'est pas admin, ne montrer que ses actions
      const user = auth.user
      if (user && user.role_id !== 1) {
        query.where('user_id', user.id)
      }

      const actions = await query.paginate(page, limit)

      // Transformer les données pour l'affichage
      const transformedActions = actions.toJSON()
      transformedActions.data = transformedActions.data.map(action => ({
        ...action,
        old_values: action.old_values || null,
        new_values: action.new_values || null,
        created_at: action.created_at,
        updated_at: action.updated_at
      }))

      return response.ok({
        message: 'Historique des actions récupéré avec succès',
        data: transformedActions
      })
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error)
      return response.internalServerError({
        message: 'Erreur lors de la récupération de l\'historique'
      })
    }
  }

  public async show({ params, response, auth }: HttpContext) {
    try {
      const actionQuery = StocksHistory.query()
        .where('id', params.id)
        .preload('user')
        .preload('service')

      // Si l'utilisateur n'est pas admin, ne montrer que ses actions
      const user = auth.user
      if (user && user.role_id !== 1) {
        actionQuery.where('user_id', user.id)
      }

      const action = await actionQuery.firstOrFail()

      // Transformer les données
      const transformedAction = {
        ...action.toJSON(),
        old_values: action.old_values || null,
        new_values: action.new_values || null
      }

      return response.ok({
        message: 'Action récupérée avec succès',
        data: transformedAction
      })
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'action:', error)
      return response.notFound({
        message: 'Action non trouvée'
      })
    }
  }

  public async indexByService({ params, response, auth }: HttpContext) {
  try {
    const { serviceId } = params
    const user = auth.user

    const actionsQuery = StocksHistory.query()
      .where('service_id', serviceId)
      .preload('user')
      .preload('service')

    if (user && user.role_id !== 1) {
      actionsQuery.where('user_id', user.id)
    }

    const actions = await actionsQuery.orderBy('created_at', 'desc')

    const transformedActions = actions.map(action => ({
      ...action.toJSON(),
    }))

    return response.ok({
      message: 'Actions récupérées avec succès',
      data: transformedActions
    })
  } catch (error) {
    console.error('Erreur lors de la récupération des actions:', error)
    return response.internalServerError({
      message: 'Erreur serveur'
    })
  }
}


  public async stats({ request, response, auth }: HttpContext) {
    try {
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = StocksHistory.query()

      if (startDate) {
        query.where('created_at', '>=', startDate)
      }

      if (endDate) {
        query.where('created_at', '<=', endDate)
      }

      // Si l'utilisateur n'est pas admin, ne montrer que ses stats
      const user = auth.user
      if (user && user.role_id !== 1) {
        query.where('user_id', user.id)
      }

      const [
        totalActions,
        byActionType,
        byResourceType,
        recentActions
      ] = await Promise.all([
        query.clone().count('* as total'),
        query.clone()
          .groupBy('action_type')
          .select('action_type')
          .count('* as total'),
        query.clone()
          .groupBy('resource_type')
          .select('resource_type')
          .count('* as total'),
        query.clone()
          .orderBy('created_at', 'desc')
          .limit(10)
          .preload('user')
          .preload('service')
      ])

      const stats = {
        total_actions: totalActions,
        by_action_type: byActionType,
        by_resource_type: byResourceType,
        recent_actions: recentActions
      }

      return response.ok({
        message: 'Statistiques récupérées avec succès',
        data: stats
      })
    } catch (error) {
      console.error('Erreur lors de la récupération des statistiques:', error)
      return response.internalServerError({
        message: 'Erreur lors de la récupération des statistiques'
      })
    }
  }

  public async export({ request, response, auth }: HttpContext) {
    try {
      const format = request.input('format', 'json')
      const startDate = request.input('start_date')
      const endDate = request.input('end_date')

      const query = StocksHistory.query()
        .preload('user')
        .preload('service')
        .orderBy('created_at', 'desc')

      if (startDate) {
        query.where('created_at', '>=', startDate)
      }

      if (endDate) {
        query.where('created_at', '<=', endDate)
      }

      // Si l'utilisateur n'est pas admin, ne montrer que ses actions
      const user = auth.user
      if (user && user.role_id !== 1) {
        query.where('user_id', user.id)
      }

      const actions = await query

      if (format === 'csv') {
        // Générer CSV
        const csvData = actions.map(action => ({
          Date: action.createdAt.toFormat('yyyy-MM-dd HH:mm:ss'),
          Utilisateur: action.user?.first_name || 'Inconnu',
          Service: action.service?.name || 'Inconnu',
          Action: action.action_type || '',
          Ressource: action.resource_type || '',
          Description: action.action_description || '',
          'Resource ID': action.resource_id || ''
        }))

        const csvContent = this.convertToCSV(csvData)

        return response
          .header('Content-Type', 'text/csv; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="stocks_history.csv"')
          .send(csvContent)
      }

      return response.ok({
        message: 'Historique exporté avec succès',
        data: actions
      })
    } catch (error) {
      console.error('Erreur lors de l\'exportation:', error)
      return response.internalServerError({
        message: 'Erreur lors de l\'exportation'
      })
    }
  }

  private convertToCSV(data: any[]): string {
    if (!data.length) return ''

    const headers = Object.keys(data[0]).join(',')
    const rows = data.map(row =>
      Object.values(row).map(value => {
        // Échapper les guillemets doubles et encapsuler les valeurs
        const stringValue = String(value || '')
        return `"${stringValue.replace(/"/g, '""')}"`
      }).join(',')
    )

    return [headers, ...rows].join('\n')
  }
}
