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
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Booking Confirmation',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour booking at {{2}} is confirmed for {{3}}.\n\nBooking number: {{4}}\n\nWe look forward to welcoming you!',
        example: {
          body_text: [['John Doe', 'Hotel Enjoy Yaounde', 'May 24, 2025', 'RES-00123']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels',
      },
    ],
  },

  {
    name: 'htl_checkin_remind',
    category: 'UTILITY',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Your Check-in is Coming Up',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nYour check-in at {{2}} is scheduled for tomorrow, {{3}}.\n\nExpected arrival time: {{4}}\n\nNeed help with your arrival? Reply to this message.',
        example: {
          body_text: [['John Doe', 'Hotel Enjoy Yaounde', 'May 24, 2025', '2:00 PM']],
        },
      },
      {
        type: 'FOOTER',
        text: 'Enjoy Hotels',
      },
      {
        type: 'BUTTONS',
        buttons: [
          { type: 'QUICK_REPLY', text: 'Change my arrival' },
          { type: 'QUICK_REPLY', text: 'Need help' },
        ],
      },
    ],
  },

  {
    name: 'htl_checkout_feedback',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'We Value Your Feedback',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\nWe hope you enjoyed your stay at {{2}}.\n\nYour feedback means a lot to us. Take 1 minute to rate your experience!',
        example: {
          body_text: [['John Doe', 'Hotel Enjoy Yaounde']],
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
            text: 'Leave a review',
            url: 'https://enjoy-hotels.com/feedback/{{1}}',
            example: ['https://enjoy-hotels.com/feedback/RES-00123'],
          },
        ],
      },
    ],
  },

  {
    name: 'htl_special_offer',
    category: 'MARKETING',
    language: 'en',
    components: [
      {
        type: 'HEADER',
        format: 'TEXT',
        text: 'Exclusive Offer',
      },
      {
        type: 'BODY',
        text: 'Hello {{1}},\n\n{{2}} has an exclusive offer just for you:\n\n{{3}}\n\nValid until {{4}}. Do not miss this opportunity!',
        example: {
          body_text: [
            ['John Doe', 'Hotel Enjoy Yaounde', '20% off your next stay', 'May 31, 2025'],
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
            text: 'Claim the offer',
            url: 'https://enjoy-hotels.com/promo/{{1}}',
            example: ['https://enjoy-hotels.com/promo/PROMO2025'],
          },
        ],
      },
    ],
  },
]