import { BaseSeeder } from '@adonisjs/lucid/seeders'
import EmailTemplate from '#models/email_template'

export default class extends BaseSeeder {
  async run() {
    // Template pour facture City Ledger
    await EmailTemplate.updateOrCreate(
      { templateName: 'invoice_city_ledger' },
      {
        templateName: 'invoice_city_ledger',
        subject: 'Facture n°{{invoice_number}} - {{hotel_name}}',
        bodyHtml: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .header { background-color: #f8f9fa; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .invoice-details { margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>{{hotel_name}}</h1>
                <p>Facture n°{{invoice_number}}</p>
              </div>
              <div class="content">
                <h2>Bonjour {{company_name}},</h2>
                <p>Veuillez trouver ci-joint votre facture pour la période du {{period_start}} au {{period_end}}.</p>
                <div class="invoice-details">
                  <p><strong>Montant total:</strong> {{total_amount}} {{currency}}</p>
                  <p><strong>Date d'échéance:</strong> {{due_date}}</p>
                </div>
                <p>Pour toute question concernant cette facture, n'hésitez pas à nous contacter.</p>
                <p>Cordialement,<br>L'équipe de {{hotel_name}}</p>
              </div>
              <div class="footer">
                <p>{{hotel_address}} | {{hotel_phone}} | {{hotel_email}}</p>
              </div>
            </body>
          </html>
        `
      }
    )

    // Template pour rappel de paiement 30 jours
    await EmailTemplate.updateOrCreate(
      { templateName: 'payment_reminder_30_days' },
      {
        templateName: 'payment_reminder_30_days',
        subject: 'Rappel de paiement - Facture n°{{invoice_number}} - {{hotel_name}}',
        bodyHtml: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .header { background-color: #fff3cd; padding: 20px; text-align: center; border-left: 4px solid #ffc107; }
                .content { padding: 20px; }
                .warning { background-color: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>{{hotel_name}}</h1>
                <p>Rappel de paiement - Facture n°{{invoice_number}}</p>
              </div>
              <div class="content">
                <h2>Bonjour {{company_name}},</h2>
                <p>Nous vous rappelons que votre facture n°{{invoice_number}} d'un montant de {{total_amount}} {{currency}} est échue depuis le {{due_date}}.</p>
                <div class="warning">
                  <p><strong>Attention:</strong> Cette facture est en retard de paiement depuis {{days_overdue}} jours.</p>
                </div>
                <p>Nous vous prions de bien vouloir régulariser cette situation dans les plus brefs délais.</p>
                <p>Si vous avez déjà effectué le paiement, veuillez ignorer ce message.</p>
                <p>Cordialement,<br>Le service comptabilité de {{hotel_name}}</p>
              </div>
              <div class="footer">
                <p>{{hotel_address}} | {{hotel_phone}} | {{hotel_email}}</p>
              </div>
            </body>
          </html>
        `
      }
    )

    // Template pour confirmation de réservation
    await EmailTemplate.updateOrCreate(
      { templateName: 'reservation_confirmation' },
      {
        templateName: 'reservation_confirmation',
        subject: 'Confirmation de réservation - {{hotel_name}}',
        bodyHtml: `
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
                .header { background-color: #d4edda; padding: 20px; text-align: center; border-left: 4px solid #28a745; }
                .content { padding: 20px; }
                .reservation-details { background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { background-color: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>{{hotel_name}}</h1>
                <p>Confirmation de réservation</p>
              </div>
              <div class="content">
                <h2>Bonjour {{guest_name}},</h2>
                <p>Nous avons le plaisir de confirmer votre réservation.</p>
                <div class="reservation-details">
                  <p><strong>Numéro de réservation:</strong> {{reservation_number}}</p>
                  <p><strong>Dates:</strong> du {{check_in_date}} au {{check_out_date}}</p>
                  <p><strong>Nombre de nuits:</strong> {{nights_count}}</p>
                  <p><strong>Type de chambre:</strong> {{room_type}}</p>
                  <p><strong>Nombre d'adultes:</strong> {{adults_count}}</p>
                  <p><strong>Nombre d'enfants:</strong> {{children_count}}</p>
                  <p><strong>Montant total:</strong> {{total_amount}} {{currency}}</p>
                </div>
                <p>Nous avons hâte de vous accueillir dans notre établissement.</p>
                <p>Cordialement,<br>L'équipe de {{hotel_name}}</p>
              </div>
              <div class="footer">
                <p>{{hotel_address}} | {{hotel_phone}} | {{hotel_email}}</p>
              </div>
            </body>
          </html>
        `
      }
    )
  }
}