export const DEFAULT_TEMPLATE_CATEGORIES: string[] = [
  'Reservation Confirmation email to Guest/Booker',
  'Email to Guest/Booker requesting a Review',
  'Thank You email to Guest/Booker upon checking out from Hotel',
  'Thank You email to Guest/Booker for reviewing Hotel',
  'Email to Guest/Booker on release of a Reservation in case of lack of deposit',
  'Email to Guest/Booker on a Reservation Cancellation',
  'Notification email to Guest/Booker for their Booking Enquiry',
  'Email to Guest/Booker on Hold Booking',
  'Reminder Email to Guest/Booker For Confirming Hold Booking',
  'Notification Email to Hotel on Auto Release of Hold Booking',
  'Access to Guest Portal',
  'Notification Email to Guest/TA on Auto Release of Hold Booking',
  'Send Online Payment link to Company',
]

export type AutoSendType =
  | 'Manual'
  | 'Check-in'
  | 'Check-out'
  | 'Reservation Created'
  | 'Reservation Modified'
  | 'Reservation Cancelled'
  | 'Invoice Generated'
  | 'Payment Received'

export type DefaultEmailTemplateDef = {
  category: string
  name: string
  subject: string
  bodyHtml: string
  autoSend?: AutoSendType
}

export const DEFAULT_EMAIL_TEMPLATES: DefaultEmailTemplateDef[] = [
  {
    category: 'Reservation Confirmation email to Guest/Booker',
    name: 'Reservation Confirmation',
    subject: 'Reservation Confirmed - {{hotel.name}}',
    autoSend: 'Reservation Created',
    bodyHtml: `
      <p>Dear {{guest.firstName}} {{guest.lastName}},</p>
      <p>Your reservation at {{hotel.name}} is confirmed.</p>
      <p><strong>Check-in:</strong> {{reservation.checkInDate}}<br/>
         <strong>Check-out:</strong> {{reservation.checkOutDate}}<br/>
         <strong>Room:</strong> {{reservation.roomType}}<br/>
         <strong>Total:</strong> {{reservation.totalAmount}}</p>
      <p>You can view or manage your reservation via the guest portal: {{links.guestPortal}}</p>
      <p>We look forward to welcoming you!</p>
    `.trim()
  },
  {
    category: 'Email to Guest/Booker requesting a Review',
    name: 'Review Request',
    subject: 'How was your stay at {{hotel.name}}?',
    autoSend: 'Check-out',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>Thank you for staying with us. We’d love your feedback about your stay at {{hotel.name}}.</p>
      <p>Please share your review here: {{links.reviewUrl}}</p>
      <p>We greatly appreciate your time!</p>
    `.trim()
  },
  {
    category: 'Thank You email to Guest/Booker upon checking out from Hotel',
    name: 'Thank You After Checkout',
    subject: 'Thank you for staying with {{hotel.name}}',
    autoSend: 'Check-out',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>It was a pleasure to host you at {{hotel.name}}. Thank you for choosing us!</p>
      <p>We hope to see you again soon.</p>
    `.trim()
  },
  {
    category: 'Thank You email to Guest/Booker for reviewing Hotel',
    name: 'Thanks for Review',
    subject: 'Thank you for reviewing {{hotel.name}}',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>Thanks a lot for sharing your review of {{hotel.name}}. Your feedback helps us improve.</p>
      <p>We appreciate your time and hope to welcome you again!</p>
    `.trim()
  },
  {
    category: 'Email to Guest/Booker on release of a Reservation in case of lack of deposit',
    name: 'Reservation Released Due to Deposit',
    subject: 'Reservation Released - Action Needed',
    autoSend: 'Reservation Modified',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>Your reservation at {{hotel.name}} has been released due to missing deposit.</p>
      <p>If you still wish to confirm, please proceed with payment here: {{links.paymentUrl}}</p>
    `.trim()
  },
  {
    category: 'Email to Guest/Booker on a Reservation Cancellation',
    name: 'Reservation Cancellation',
    subject: 'Reservation Cancelled - {{hotel.name}}',
    autoSend: 'Reservation Cancelled',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>We confirm the cancellation of your reservation at {{hotel.name}}.</p>
      <p>If this was unexpected, please contact us: {{hotel.supportEmail}}</p>
    `.trim()
  },
  {
    category: 'Notification email to Guest/Booker for their Booking Enquiry',
    name: 'Booking Enquiry Received',
    subject: 'We received your booking enquiry',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>We have received your booking enquiry at {{hotel.name}}.</p>
      <p>Our team will contact you shortly with availability and rates.</p>
    `.trim()
  },
  {
    category: 'Email to Guest/Booker on Hold Booking',
    name: 'Hold Booking Confirmation',
    subject: 'Your booking is on hold',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>Your booking has been placed on hold at {{hotel.name}} until {{reservation.holdReleaseDate}}.</p>
      <p>Please confirm by completing the required steps here: {{links.confirmHoldUrl}}</p>
    `.trim()
  },
  {
    category: 'Reminder Email to Guest/Booker For Confirming Hold Booking',
    name: 'Hold Booking Reminder',
    subject: 'Reminder: Please confirm your hold booking',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>This is a reminder to confirm your hold booking at {{hotel.name}} before {{reservation.holdReleaseDate}}.</p>
      <p>Confirm here: {{links.confirmHoldUrl}}</p>
    `.trim()
  },
  {
    category: 'Notification Email to Hotel on Auto Release of Hold Booking',
    name: 'Auto Release Notification (Hotel)',
    subject: 'Hold booking auto-released',
    bodyHtml: `
      <p>Dear Team,</p>
      <p>The hold booking for {{guest.fullName}} has been auto-released on {{reservation.holdReleaseDate}}.</p>
      <p>Reservation ID: {{reservation.id}}</p>
    `.trim()
  },
  {
    category: 'Access to Guest Portal',
    name: 'Guest Portal Access',
    subject: 'Access your guest portal',
    autoSend: 'Reservation Created',
    bodyHtml: `
      <p>Dear {{guest.firstName}},</p>
      <p>You can access your guest portal to view your stay details here:</p>
      <p><a href="{{links.guestPortal}}">Guest Portal</a></p>
    `.trim()
  },
  {
    category: 'Notification Email to Guest/TA on Auto Release of Hold Booking',
    name: 'Auto Release Notification (Guest/TA)',
    subject: 'Your hold booking was auto-released',
    bodyHtml: `
      <p>Dear {{recipient.name}},</p>
      <p>Your hold booking at {{hotel.name}} was auto-released on {{reservation.holdReleaseDate}}.</p>
      <p>If you need assistance, contact us: {{hotel.supportEmail}}</p>
    `.trim()
  },
  {
    category: 'Send Online Payment link to Company',
    name: 'Online Payment Link - Company',
    subject: 'Payment link for your account',
    bodyHtml: `
      <p>Dear {{company.contactName}},</p>
      <p>Please use the secure payment link below to complete your payment:</p>
      <p><a href="{{links.paymentUrl}}">Pay Online</a></p>
    `.trim()
  },
]