import { TemplateComponent } from '#models/hotel_whatsapp_template'

export type EnjoyTemplateDefinition = {
  name: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  language: string
  components: TemplateComponent[]
}

export const ENJOY_STANDARD_TEMPLATES: EnjoyTemplateDefinition[] = [
  {
    name: 'enjoy_booking_confirmations',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Confirmation de reservation',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nVotre reservation au {{2}} est confirmee pour le {{3}}.\n\nNumero de reservation : {{4}}\n\nNous avons hate de vous accueillir !',
        example: {
          body_text: [['Jean Dupont', 'Hotel Enjoy Yaounde', '24 Mai 2025', 'RES-00123']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels - Powered by Laakam',
      },
    ],
  },

  {
    name: 'enjoy_checkin_reminders',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Votre check-in approche',
      },
      {
        type: 'BODY',
        text: "Bonjour {{1}},\n\nVotre check-in au {{2}} est prevu demain, le {{3}}.\n\nHeure d'arrivee prevue : {{4}}\n\nBesoin d'aide pour votre arrivee ? Repondez a ce message.",
        example: {
          body_text: [['Jean Dupont', 'Hotel Enjoy Yaounde', '24 Mai 2025', '14h00']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Modifier mon arrivee' },
          { type: 'QUICK_REPLY', text: "Besoin d'aide" },
        ],
      },
    ],
  },

  {
    name: 'enjoy_checkout_feedbacks',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Votre avis nous interesse',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nNous esperons que votre sejour au {{2}} vous a plu.\n\nVotre avis compte beaucoup pour nous. Prenez 1 minute pour nous noter !',
        example: {
          body_text: [['Jean Dupont', 'Hotel Enjoy Yaounde']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Laisser un avis',
            url: 'https://enjoy-hotels.com/feedback/{{1}}',
            example: ['https://enjoy-hotels.com/feedback/RES-00123'],
          },
        ],
      },
    ],
  },

  {
    name: 'enjoy_special_offers',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Offre Exclusive',
      },
      {
        type: 'BODY',
        text: "Bonjour {{1}},\n\n{{2}} vous reserve une offre exclusive :\n\n{{3}}\n\nValable jusqu'au {{4}}. Ne manquez pas cette opportunite !",
        example: {
          body_text: [
            ['Jean Dupont', 'Hotel Enjoy Yaounde', '-20% sur votre prochain sejour', '31 Mai 2025'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: "Profiter de l'offre",
            url: 'https://enjoy-hotels.com/promo/{{1}}',
            example: ['https://enjoy-hotels.com/promo/PROMO2025'],
          },
        ],
      },
    ],
  },
]