import { test } from '@japa/runner'
import assert from 'node:assert/strict'
import {
  auditDateBoundary,
  auditInstant,
  documentTimestamp,
  formatFolioReference,
} from '../../app/services/audit_clock.js'

test('audit shows UTC and the hotel time zone without reversing the timeline', () => {
  const creation = auditInstant('2026-11-18T18:15:39.588Z')
  const printing = auditInstant('2026-11-18T18:20:00Z')
  assert.ok(creation.label.includes('19:15:39 UTC+01:00 (Africa/Douala)'))
  assert.ok(printing.label.includes('19:20:00 UTC+01:00 (Africa/Douala)'))
  assert.ok(creation.utc < printing.utc)
  assert.equal(auditInstant(printing.local).utc, printing.utc)
  assert.ok(documentTimestamp('2026-11-18T18:20:00Z', 'Europe/Paris').includes('Europe/Paris'))
})

test('audit calendar filters include the complete local day with an exclusive end', () => {
  assert.deepEqual(auditDateBoundary('2026-11-18', false), {
    utc: '2026-11-17T23:00:00.000Z',
    exclusive: false,
  })
  assert.deepEqual(auditDateBoundary('2026-11-18', true), {
    utc: '2026-11-18T23:00:00.000Z',
    exclusive: true,
  })
  assert.equal(auditDateBoundary('2026-11-18T18:20:00Z', true).exclusive, false)
  assert.throws(() => auditDateBoundary('not-a-date', false))
  assert.throws(() => auditInstant('2026-11-18T18:20:00Z', 'unknown-zone'))
})

test('folio references preserve the format and bigint sequence precision', () => {
  assert.equal(formatFolioReference(2, '123', 2972), 'F-2-2972-000123')
  assert.equal(formatFolioReference(2, '123'), 'F-2-00000123')
  assert.equal(formatFolioReference(2, '9007199254740993', 2972), 'F-2-2972-9007199254740993')
  assert.throws(() => formatFolioReference(2, '0', 2972))
})
