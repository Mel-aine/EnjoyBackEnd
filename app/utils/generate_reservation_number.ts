import { DateTime } from 'luxon'

/**
 * Generates a unique reservation number.
 * The format is `PREFIX-YYYYMMDD-XXXXX`.
 * Example: `RES-20231027-A1B2C`
 *
 * @param {string} [prefix='RES'] - An optional prefix for the reservation number.
 * @returns {string} The generated reservation number.
 */
export function generateReservationNumber(prefix: string = 'RES'): string {
  const datePart = DateTime.now().toFormat('yyyyMMdd')
  const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase()

  return `${prefix}-${datePart}-${randomPart}`
}