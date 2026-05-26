import { TemplateComponent } from '#models/hotel_whatsapp_template'



export type EnjoyTemplateDefinition = {
  name: string
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION'
  language: string
  components: TemplateComponent[]
}

export const ENJOY_STANDARD_TEMPLATES: EnjoyTemplateDefinition[] = [
  {
    name: 'htl_booking_confirm',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Confirmation de réservation',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nVotre réservation chez {{2}} est confirmée pour le {{3}}.\n\nNuméro de réservation : {{4}}\n\nNous avons hâte de vous accueillir !',
        example: {
          body_text: [['John Doe', 'Hôtel Enjoy Yaoundé', '24 mai 2025', 'RES-00123']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
    ],
  },

  {
    name: 'htl_checkin_remind',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Votre enregistrement approche',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nVotre enregistrement chez {{2}} est prévu pour demain, {{3}}.\n\nHeure d\'arrivée prévue : {{4}}\n\nBesoin d\'aide pour votre arrivée ? Répondez à ce message.',
        example: {
          body_text: [['John Doe', 'Hôtel Enjoy Yaoundé', '24 mai 2025', '14h00']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Changer mon arrivée' },
          { type: 'QUICK_REPLY', text: 'Besoin d\'aide' },
        ],
      },
    ],
  },

  {
    name: 'feedback_survey',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Merci pour votre séjour',
      },
      {
        type: 'BODY',
        text: "Bonjour {{1}} ! Merci d'avoir séjourné chez {{2}}.\n\nNous espérons que vous avez fait bon voyage. Comment évalueriez-vous votre expérience globale au sein de notre établissement ?",
        example: {
          body_text: [['John Doe', 'Hôtel Enjoy Yaoundé']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },

      {

        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Excellent / Très bien' },
          { type: 'QUICK_REPLY', text: 'Satisfaisant' },
          { type: 'QUICK_REPLY', text: 'À améliorer' },
        ],


      },
    ],
  },


  {
    name: 'htl_special_offer',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Offre exclusive',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\n{{2}} a une offre exclusive juste pour vous :\n\n{{3}}\n\nValable jusqu\'au {{4}}. Ne manquez pas cette opportunité !',
        example: {
          body_text: [
            ['John Doe', 'Hôtel Enjoy Yaoundé', '20 % de réduction sur votre prochain séjour', '31 mai 2025'],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Profitez de l\'offre',
            url: 'https://live.enjoy-stay.com/promo/{{1}}',
            example: ['https://live.enjoy-stay.com/promo/PROMO2025'],
          },
        ],
      },
    ],
  },

  {
    name: 'checkin_welcome',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Bienvenue chez {{1}} !',
        example: {
          header_text: ['Hôtel Enjoy Yaoundé'],
        },
      },
      {
        type: 'BODY',
        // Les variables recommencent à {{1}} pour le bloc BODY
        text: 'Bonjour {{1}},\n\nBienvenue ! Votre chambre {{2}} est prête.\n\nWi-Fi : {{3}}\nPetit-déjeuner : {{4}} – {{5}}\n\nProfitez de votre séjour ! N\'hésitez pas à répondre à ce message si vous avez besoin de quoi que ce soit.',
        example: {
          body_text: [
            [
              'John Doe',        // {{1}}
              '204',             // {{2}}
              'EnjoyGuest2025',  // {{3}}
              '07:00',           // {{4}}
              '10:00',           // {{5}}
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Ouvrir ma clé numérique',
            // Si cette variable fait référence à un paramètre dynamique de l'URL, elle doit être {{1}} pour ce bouton
            url: 'https://live.enjoy-stay.com/key/{{1}}',
            example: ['RES-00123'],
          },
        ],
      },
    ],
  },




  {
    name: 'expense_alerts',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Alerte de dépense',
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nVous avez effectué une dépense de {{2}} dans votre chambre {{3}}.\n\nDétail de la dépense : {{4}}.\n\nVotre solde total cumulé est désormais de {{5}}. Merci de vérifier vos dépenses pour éviter les surprises au moment du checkout.',
        example: {
          body_text: [
            [
              'John Doe', // {{1}} - Nom du client
              '5 000 FCFA', // {{2}} - Montant de la transaction
              '204', // {{3}} - Numéro de chambre
              '1x Jus de Gingembre - Bar', // {{4}} - Libellé de la consommation
              '15 000 FCFA' // {{5}} - Nouveau solde total cumulé
            ],
          ],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
    ],
  },
  // client satisfait → lien Google

  {
    name: 'feedback_positive_reply',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'BODY',
        text: "C'est un plaisir de le lire ! \n\nPourriez-vous prendre 30 secondes pour partager votre expérience sur notre page Google ? Votre avis aide énormément notre équipe .",

      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
      {
        type: 'BUTTONS',
        buttons: [
          {
            type: 'URL',
            text: 'Laisser un avis',
            url: 'https://search.google.com/local/writereview?placeid={{1}}',
            example: ['ChIJXXXXXX'],
          },
        ],
      },
    ],
  },


  {
    name: 'feedback_surveys',
    category: 'MARKETING',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Votre facture et votre avis'
      },
      {
        type: 'BODY',
      
        text: "Bonjour {{1}} ! Merci d'avoir séjourné chez {{2}}.\n\nVous pouvez consulter votre facture finale ici : {{3}}\n\nComment évalueriez-vous votre expérience globale au sein de notre établissement ? Votre avis est précieux pour nous aider à améliorer nos services.",
        example: {
          body_text: [['John Doe', 'Hôtel Enjoy Yaoundé', 'https://live.enjoy-stay.com/invoice/inv-123']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Excellent / Très bien' },
          { type: 'QUICK_REPLY', text: 'Satisfaisant' },
          { type: 'QUICK_REPLY', text: 'À améliorer' },
        ],
      },
    ],
  },


  {
    name: 'htl_booking_confirms',
    category: 'UTILITY',
    language: 'fr',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Confirmation de réservation'
      },
      {
        type: 'BODY',
        text: 'Bonjour {{1}},\n\nVotre réservation chez {{2}} est confirmée pour le {{3}}.\n\nVous pouvez consulter et télécharger votre bon de réservation complet ici : {{4}}\n\nNous avons hâte de vous accueillir !',
        example: {
          body_text: [['John Doe', 'Hôtel Enjoy Yaoundé', '24 mai 2026', 'https://live.enjoy-stay.com/voucher/res-123']]
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy PMS',
      }
    ]
  },

// Template invoice_ready
{
  name: 'invoice_ready',
  category: 'UTILITY',
  language: 'fr',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Votre facture est disponible',
    },
    {
      type: 'BODY',
      text: 'Bonjour {{1}},\n\nVotre facture pour votre séjour chez {{2}} (réservation *{{3}}*) est disponible.\n\n📄 Télécharger votre facture :\n{{4}}\n\nMerci pour votre confiance.',
      example: {
        body_text: [['John Doe', 'Hôtel Enjoy', 'RES-2026-001', 'https://enjoy-stay.com/documents/pdf/abc123']],
      },
    },
    {
      type: 'FOOTER',
      text: 'Enjoy PMS',
    },
  ],
},

{
  name: 'voucher_ready',
  category: 'UTILITY',
  language: 'fr',
  components: [
    {
      type: 'HEADER',
      format: 'TEXT',
      text: 'Votre bon de réservation',
    },
    {
      type: 'BODY',
      text: 'Bonjour {{1}},\n\nVotre bon de réservation chez {{2}} est disponible.\n\n🔖 Réservation : *{{3}}*\n📅 Arrivée : {{4}}\n📅 Départ : {{5}}\n\n📄 Télécharger votre voucher :\n{{6}}\n\nNous avons hâte de vous accueillir !',
      example: {
        body_text: [['John Doe', 'Hôtel Enjoy', 'RES-2026-001', '24 Mai 2026', '26 Mai 2026', 'https://enjoy-stay.com/documents/pdf/abc123']],
      },
    },
    {
      type: 'FOOTER',
      text: 'Enjoy PMS',
    },
  ],
}


]
