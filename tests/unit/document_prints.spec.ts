import { test } from '@japa/runner'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import ts from 'typescript'
import { numberedPdfOptions, printNumber } from '../../app/services/print_layout.js'
import { redactAuditValue } from '../../app/services/audit_context.js'
import { auditInstant, PRINT_TIME_PLACEHOLDER } from '../../app/services/audit_clock.js'

// Load the real service with isolated dependencies; do not boot Adonis or its scheduler.
async function isolatedPrintService(
  options: { enabled?: boolean; renderFails?: boolean; storageFails?: boolean } = {}
) {
  const records: Array<{ table: string; data: any }> = []
  const renders: any[] = []
  let sequence = 0
  const db = {
    async rawQuery() {
      sequence++
      return { rows: [{ id: String(sequence), generated_at: new Date('2026-11-18T18:20:00Z') }] }
    },
    table(table: string) {
      return {
        async insert(data: any) {
          records.push({ table, data })
        },
      }
    },
    async transaction(callback: any) {
      const pending: any[] = []
      await callback({
        table(table: string) {
          return {
            async insert(data: any) {
              if (options.storageFails) throw new Error('archive unavailable')
              pending.push({ table, data })
            },
          }
        },
      })
      records.push(...pending)
    },
  }
  const source = await readFile(
    new URL('../../app/services/document_audit_service.ts', import.meta.url),
    'utf8'
  )
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const key = `print_test_${randomUUID()}`
  ;(globalThis as any)[key] = {
    db,
    createHash,
    numberedPdfOptions,
    printNumber,
    redactAuditValue,
    auditInstant,
    PRINT_TIME_PLACEHOLDER,
    auditEnabled: () => options.enabled !== false,
    getAuditContext: () => ({
      actorId: 23,
      actorName: 'Test User',
      operationId: '00000000-0000-4000-8000-000000000023',
      source: 'http',
    }),
    htmlPdf: {
      async generatePdf(file: any, renderOptions: any) {
        renders.push({ file, options: renderOptions })
        if (options.renderFails) throw new Error('renderer unavailable')
        return Buffer.from(`%PDF-fixture ${renderOptions.footerTemplate ?? ''}`)
      },
    },
  }
  const isolated = js.replace(/^import .+ from .+;\r?\n/gm, '')
  const bindings = `const {db,createHash,numberedPdfOptions,printNumber,redactAuditValue,auditEnabled,getAuditContext,htmlPdf,auditInstant,PRINT_TIME_PLACEHOLDER}=globalThis[${JSON.stringify(key)}];\n`
  try {
    const module = await import(
      `data:text/javascript;base64,${Buffer.from(bindings + isolated).toString('base64')}`
    )
    return { service: module.default, records, renders, allocations: () => sequence }
  } finally {
    delete (globalThis as any)[key]
  }
}

test('print footer keeps existing content and reserves enough room on every page', () => {
  const original = {
    footerTemplate: '<div>Existing page numbers</div>',
    margin: { bottom: '70px' },
    orientation: 'landscape',
  }
  const options = numberedPdfOptions(original, printNumber('123'))
  assert.ok(options.footerTemplate.includes('Existing page numbers'))
  assert.ok(options.footerTemplate.includes('N° impression : IMP-0000000123'))
  assert.equal(options.displayHeaderFooter, true)
  assert.equal(options.landscape, true)
  assert.equal(options.margin.bottom, '70px')
  assert.equal(original.footerTemplate, '<div>Existing page numbers</div>')
  assert.equal(numberedPdfOptions({ margin: { bottom: '0mm' } }, 'IMP-1').margin.bottom, '16mm')
  assert.equal(printNumber('9007199254740993'), 'IMP-9007199254740993')
})

test('disabled print audit generates PDFs without any database access', async () => {
  const { service, records, renders, allocations } = await isolatedPrintService({ enabled: false })
  await service.generate({ content: '<html>Original</html>' }, { displayHeaderFooter: false })
  assert.equal(renders[0].options.displayHeaderFooter, false)
  assert.equal(records.length, 0)
  assert.equal(allocations(), 0)
})

test('print archives matching PDF bytes, user, source JSON, reference and distinct numbers', async () => {
  const { service, records, renders } = await isolatedPrintService()
  const data = {
    hotel: { id: 2 },
    reservation: { id: 2831 },
    folio: { id: 3033, folioNumber: 'F-2-2972-000001' },
    totals: { totalAmount: 250000 },
    password: 'never store this',
  }
  const first = await service.generate(
    { content: `<html>${PRINT_TIME_PLACEHOLDER} 250 000</html>` },
    {},
    { data }
  )
  const second = await service.generate(
    { content: '<html>80 000</html>' },
    {},
    { data: { ...data, totals: { totalAmount: 80000 } } }
  )
  const prints = records.filter((row) => row.table === 'document_prints')
  assert.equal(prints.length, 2)
  assert.equal(prints[0].data.user_id, 23)
  assert.equal(prints[0].data.created_at, '2026-11-18T18:20:00.000Z')
  assert.ok(renders[0].options.footerTemplate.includes('19:20:00 UTC+01:00 (Africa/Douala)'))
  assert.equal(JSON.parse(prints[0].data.data).generatedAt.utc, prints[0].data.created_at)
  assert.ok(renders[0].file.content.includes('19:20:00 UTC+01:00 (Africa/Douala)'))
  assert.equal(renders[0].file.content.includes(PRINT_TIME_PLACEHOLDER), false)
  assert.equal(JSON.parse(prints[0].data.data).html, renders[0].file.content)
  assert.equal(prints[0].data.print_number, 'IMP-0000000001')
  assert.equal(prints[1].data.print_number, 'IMP-0000000002')
  assert.deepEqual(prints[0].data.pdf_data, first)
  assert.notDeepEqual(first, second)
  assert.equal(prints[0].data.sha256, createHash('sha256').update(first).digest('hex'))
  assert.equal(JSON.parse(prints[0].data.data).input.totals.totalAmount, 250000)
  assert.equal(JSON.parse(prints[1].data.data).input.totals.totalAmount, 80000)
  assert.equal(JSON.parse(prints[0].data.data).input.password, '[REDACTED]')
  assert.equal(JSON.parse(prints[0].data.reference).number, 'F-2-2972-000001')
  assert.ok(renders[0].options.footerTemplate.includes(prints[0].data.print_number))
})

test('failed render records an attempt without inventing an archived PDF', async () => {
  const { service, records } = await isolatedPrintService({ renderFails: true })
  await assert.rejects(() => service.generate({ content: 'test' }, {}), /renderer unavailable/)
  assert.equal(records.filter((row) => row.table === 'document_prints').length, 0)
  assert.equal(records[0].data.action, 'DOCUMENT_GENERATION_FAILED')
})

test('transaction invoice printing stays linked to its reservation and folio', async () => {
  const { service, records } = await isolatedPrintService()
  await service.generate(
    { content: '<html>Invoice</html>' },
    {},
    {
      data: {
        hotel: { id: 5 },
        folio: { id: 852, reservationId: 741, folioNumber: 'F-5-840-000001' },
        transaction: { id: 3256, reservationId: 741, folioId: 852 },
      },
      template: 'printInvoice',
    }
  )
  const print = records.find((record) => record.table === 'document_prints')!
  const event = records.find((record) => record.table === 'activity_logs')!
  assert.equal(print.data.reservation_id, 741)
  assert.equal(print.data.folio_id, 852)
  assert.equal(event.data.reservation_id, 741)
  assert.equal(event.data.action, 'DOCUMENT_GENERATED')
})

test('failed storage prevents delivery of an unarchived numbered PDF', async () => {
  const { service, records } = await isolatedPrintService({ storageFails: true })
  await assert.rejects(() => service.generate({ content: 'test' }, {}), /archive unavailable/)
  assert.equal(records.length, 0)
})

test('all PDF engines in application code use the common print boundary', async () => {
  const root = new URL('../../app/', import.meta.url)
  const files = await readdir(root, { recursive: true })
  const directRenderers: string[] = []
  for (const file of files.filter((item) => item.endsWith('.ts'))) {
    const source = await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8')
    const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    for (const statement of tree.statements) {
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        ['html-pdf-node', 'puppeteer', 'pdf-lib', 'pdfkit'].includes(statement.moduleSpecifier.text)
      )
        directRenderers.push(file.replaceAll('\\', '/'))
    }
  }
  assert.deepEqual(directRenderers, ['services/document_audit_service.ts'])
})
