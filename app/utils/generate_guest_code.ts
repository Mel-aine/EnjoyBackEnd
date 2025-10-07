import { DateTime } from 'luxon'

/**
 * Génère un code unique pour un guest.
 * Le format est : `GUEST-YYYYMMDD-XXXXX`
 * Exemple : `GUEST-20250814-AB12C`
 *
 * @param {string} [prefix='GUEST'] - Préfixe optionnel pour le code.
 * @returns {string} Code unique du guest.
 */
export function generateGuestCode(prefix: string = 'GUEST'): string {
  const datePart = DateTime.now().toFormat('yyyyMMdd')
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()

  return `${prefix}-${datePart}-${randomPart}`
}

/**
 * Génère un code unique pour un guest.
 * Le format est : `GUEST-YYYYMMDD-XXXXX`
 * Exemple : `GUEST-20250814-AB12C`
 *
 * @param {string} [prefix='GUEST'] - Préfixe optionnel pour le code.
 * @returns {string} Code unique du guest.
 */
export function generateTransactionCode(prefix: string = 'TRX'): string {
  const datePart = DateTime.now().toFormat('yyyyMMdd')
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()

  return `${prefix}${datePart}-${randomPart}`
}
