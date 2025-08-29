import type { HttpContext } from '@adonisjs/core/http'
import EmailTemplate from '#models/email_template'
import { createEmailTemplateValidator, updateEmailTemplateValidator } from '#validators/email_template'

export default class EmailTemplatesController {
  /**
   * Afficher la liste des templates d'emails
   */
  async index({ response }: HttpContext) {
    try {
      const templates = await EmailTemplate.query().orderBy('created_at', 'desc')
      return response.ok({
        success: true,
        data: templates
      })
    } catch (error) {
      return response.internalServerError({
        success: false,
        message: 'Error fetching email templates',
        error: error.message
      })
    }
  }

  /**
   * Afficher un template spécifique
   */
  async show({ params, response }: HttpContext) {
    try {
      const template = await EmailTemplate.findOrFail(params.id)
      return response.ok({
        success: true,
        data: template
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Email template not found'
      })
    }
  }

  /**
   * Créer un nouveau template
   */
  async store({ request, response }: HttpContext) {
    try {
      const payload = await request.validateUsing(createEmailTemplateValidator)
      
      const template = await EmailTemplate.create(payload)
      
      return response.created({
        success: true,
        message: 'Email template created successfully',
        data: template
      })
    } catch (error) {
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages
        })
      }
      
      return response.internalServerError({
        success: false,
        message: 'Error creating email template',
        error: error.message
      })
    }
  }

  /**
   * Mettre à jour un template
   */
  async update({ params, request, response }: HttpContext) {
    try {
      const template = await EmailTemplate.findOrFail(params.id)
      const payload = await request.validateUsing(updateEmailTemplateValidator)
      
      template.merge(payload)
      await template.save()
      
      return response.ok({
        success: true,
        message: 'Email template updated successfully',
        data: template
      })
    } catch (error) {
      if (error.code === 'E_VALIDATION_ERROR') {
        return response.badRequest({
          success: false,
          message: 'Validation failed',
          errors: error.messages
        })
      }
      
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Email template not found'
        })
      }
      
      return response.internalServerError({
        success: false,
        message: 'Error updating email template',
        error: error.message
      })
    }
  }

  /**
   * Supprimer un template
   */
  async destroy({ params, response }: HttpContext) {
    try {
      const template = await EmailTemplate.findOrFail(params.id)
      await template.delete()
      
      return response.ok({
        success: true,
        message: 'Email template deleted successfully'
      })
    } catch (error) {
      if (error.code === 'E_ROW_NOT_FOUND') {
        return response.notFound({
          success: false,
          message: 'Email template not found'
        })
      }
      
      return response.internalServerError({
        success: false,
        message: 'Error deleting email template',
        error: error.message
      })
    }
  }

  /**
   * Récupérer un template par son nom
   */
  async getByName({ params, response }: HttpContext) {
    try {
      const template = await EmailTemplate.findByOrFail('template_name', params.name)
      return response.ok({
        success: true,
        data: template
      })
    } catch (error) {
      return response.notFound({
        success: false,
        message: 'Email template not found'
      })
    }
  }
}