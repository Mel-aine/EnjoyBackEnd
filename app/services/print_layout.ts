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

export function numberedPdfOptions(
  options: Record<string, any>,
  number: string,
  generatedAt?: ReturnType<typeof auditInstant>
) {
  if (!/^IMP-[0-9]+$/.test(number)) throw new Error('Invalid print number')
  const existingFooter = options.footerTemplate || ''
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
    footerTemplate: `<div style="width:100%;font-family:Arial,sans-serif;color:#555;">${existingFooter}<div style="font-size:8px;width:100%;text-align:center;padding-top:3px;">N° impression : ${number}${existingFooter ? '' : ' · Page <span class="pageNumber"></span> / <span class="totalPages"></span>'}${generatedAt ? `<br>Généré : ${generatedAt.label} · UTC : ${generatedAt.utc}` : ''}</div></div>`,
  }
}
