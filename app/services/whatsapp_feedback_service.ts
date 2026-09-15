export default class WhatsappFeedbackService {

  static buildMessage(guestName: string, hotelName: string, googleLink: string | null) {
    const reviewBlock = googleLink
      ? `Si vous avez apprécié votre expérience, nous vous invitons à prendre une minute pour partager votre avis sur Google \n${googleLink}\n`
      : ''

    return `Bonjour *${guestName}*,

Nous espérons que vous avez passé un agréable séjour au *${hotelName}*.
Votre satisfaction est importante pour nous.
${reviewBlock}Votre retour nous aide à améliorer continuellement nos services et à faire découvrir notre établissement à de futurs voyageurs.
Merci pour votre confiance et au plaisir de vous accueillir à nouveau !

_L'équipe ${hotelName}_`
  }

  static buildWaLink(phone: string, message: string) {
    const cleanPhone = phone.replace(/[^\d]/g, '')
    return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
  }

  static generate(params: {
    guestName: string
    guestPhone: string
    hotelName: string
    googlePlaceId: string | null
  }) {
    const googleLink = params.googlePlaceId || null
    const message = this.buildMessage(params.guestName, params.hotelName, googleLink)
    const waLink = this.buildWaLink(params.guestPhone, message)
    return { message, waLink }
  }
}
