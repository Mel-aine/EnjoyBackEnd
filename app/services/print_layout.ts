import { auditInstant } from './audit_clock.js'

export interface PrintReference {
  type: string
  id?: string | number | null
  number?: string | null
}

export interface PrintMetadata {
  data?: unknown
  reference?: PrintReference
  hotelId?: number | null
  reservationId?: number | null
  folioId?: number | null
  documentType?: string
  template?: string
  language?: string
  timeZone?: string
}

export function printNumber(id: string | number): string {
  if (!/^[0-9]+$/.test(String(id))) throw new Error('Invalid print sequence')
  return `IMP-${String(id).padStart(10, '0')}`
}

/** Footer-friendly split of an instant: readable local date/time plus the UTC clock time. */
function footerClock(instant: ReturnType<typeof auditInstant>) {
  const [date = '', time = ''] = instant.local.split('T')
  const [year, month, day] = date.split('-')
  const offset = instant.local.match(/(?:Z|[+-]\d{2}:\d{2})$/)?.[0] ?? ''
  return {
    local: `${day}/${month}/${year} à ${time.slice(0, 8)}${offset === 'Z' ? ' UTC' : ` UTC${offset}`} (${instant.timeZone})`,
    utc: instant.utc.slice(11, 19),
  }
}

export function numberedPdfOptions(
  options: Record<string, any>,
  number: string,
  generatedAt?: ReturnType<typeof auditInstant>
) {
  if (!/^IMP-[0-9]+$/.test(number)) throw new Error('Invalid print number')
  const existingFooter = options.footerTemplate || ''
  // Do not print page numbers twice when the document already has its own.
  const hasPageNumbers = /class=["']pageNumber["']/.test(existingFooter)
  const pageInfo = hasPageNumbers
    ? ''
    : ' · Page <span class="pageNumber"></span> / <span class="totalPages"></span>'
  const clock = generatedAt ? footerClock(generatedAt) : null
  const bottom = options.margin?.bottom
  const match = String(bottom ?? '').match(/^([\d.]+)\s*(mm|cm|px|in|pt)?$/)
  const millimeters = match
    ? Number(match[1]) *
      ({ mm: 1, cm: 10, px: 25.4 / 96, in: 25.4, pt: 25.4 / 72 }[match[2] || 'px'] ?? 1)
    : 0
  return {
    ...options,
    landscape: options.landscape ?? options.orientation === 'landscape',
    displayHeaderFooter: true,
    headerTemplate: options.headerTemplate || '<span></span>',
    margin: { ...options.margin, bottom: millimeters >= 16 ? bottom : '16mm' },
    footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;color:#555;">${existingFooter}<div style="font-size:8px;width:100%;text-align:center;padding-top:3px;line-height:1.5;">N° impression : ${number}${pageInfo}${clock ? `<br>Généré le ${clock.local} · ${clock.utc} UTC` : ''}</div></div>`,
  }
}
