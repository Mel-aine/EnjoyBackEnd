import { DateTime } from 'luxon'
import { auditEnabled } from './audit_enabled.js'

export const DEFAULT_AUDIT_ZONE = 'Africa/Douala'
export const PRINT_TIME_PLACEHOLDER = '__ENJOY_CANONICAL_PRINT_TIME__'

export function auditInstant(value: Date | string = new Date(), timeZone = DEFAULT_AUDIT_ZONE) {
  const instant =
    value instanceof Date ? DateTime.fromJSDate(value) : DateTime.fromISO(value, { setZone: true })
  const local = instant.setZone(timeZone)
  if (!local.isValid) throw new Error('Invalid audit timestamp or time zone')
  return {
    utc: instant.toUTC().toISO()!,
    local: local.toISO()!,
    timeZone,
    label: `${local.toFormat('dd/MM/yyyy HH:mm:ss')} UTC${local.toFormat('ZZ')} (${timeZone})`,
  }
}

export function documentTimestamp(
  value: Date | string = new Date(),
  zone = DEFAULT_AUDIT_ZONE
): string {
  return auditInstant(value, zone).label
}

/** Resolve the timestamp at the common rendering boundary from the DB clock. */
export function printTimestamp(value: Date = new Date(), zone = DEFAULT_AUDIT_ZONE): string {
  return auditEnabled() ? PRINT_TIME_PLACEHOLDER : documentTimestamp(value, zone)
}

/** A local calendar day is not necessarily a UTC calendar day. */
export function auditDateBoundary(value: string, end: boolean, zone = DEFAULT_AUDIT_ZONE) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  const instant = DateTime.fromISO(value, { zone, setZone: true })
  if (!instant.isValid) throw new Error('Invalid audit date or time zone')
  return {
    utc: (dateOnly && end ? instant.plus({ days: 1 }) : instant).toUTC().toISO()!,
    exclusive: dateOnly && end,
  }
}

export function formatFolioReference(hotelId: number, ordinal: string, reservationRoomId?: number) {
  if (!Number.isSafeInteger(hotelId) || hotelId <= 0 || !/^[1-9][0-9]*$/.test(ordinal)) {
    throw new Error('Invalid folio reference allocation')
  }
  return reservationRoomId
    ? `F-${hotelId}-${reservationRoomId}-${ordinal.padStart(6, '0')}`
    : `F-${hotelId}-${ordinal.padStart(8, '0')}`
}
