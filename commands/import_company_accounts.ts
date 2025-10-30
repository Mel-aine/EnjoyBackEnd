import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'fs'
import path from 'path'
import { DateTime } from 'luxon'
import CompanyAccount from '#models/company_account'
import CompanyAccountService from '#services/company_account_service'
import BusinessSource from '#models/business_source'
import PaymentMethod from '#models/payment_method'
import { PaymentMethodType } from '#app/enums'
import Database from '@adonisjs/lucid/services/db'
import countries from 'i18n-iso-countries'
import en from 'i18n-iso-countries/langs/en.json' assert { type: 'json' }
import fr from 'i18n-iso-countries/langs/fr.json' assert { type: 'json' }
import es from 'i18n-iso-countries/langs/es.json' assert { type: 'json' }
import de from 'i18n-iso-countries/langs/de.json' assert { type: 'json' }

countries.registerLocale(en)
countries.registerLocale(fr)
countries.registerLocale(es)
countries.registerLocale(de)

function parseCsv(content: string): string[][] {
  const rows: string[][] = []
  let i = 0
  const len = content.length
  let current: string[] = []
  let cell = ''
  let inQuotes = false

  while (i < len) {
    const char = content[i]

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < len && content[i + 1] === '"') {
          cell += '"'
          i += 2
          continue
        } else {
          inQuotes = false
          i++
          continue
        }
      } else {
        cell += char
        i++
        continue
      }
    } else {
      if (char === '"') {
        inQuotes = true
        i++
        continue
      }
      if (char === ',') {
        current.push(cell)
        cell = ''
        i++
        continue
      }
      if (char === '\n') {
        current.push(cell)
        rows.push(current)
        current = []
        cell = ''
        i++
        continue
      }
      if (char === '\r') {
        i++
        continue
      }
      cell += char
      i++
    }
  }
  if (cell.length > 0 || current.length > 0) {
    current.push(cell)
    rows.push(current)
  }
  return rows
}

function normalizeHeader(h: string): string {
  return h.trim().replace(/^"|"$/g, '')
}

function stripTitle(name: string | undefined): string {
  if (!name) return ''
  let s = name.trim()
  // remove common titles at the start
  const titles = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Miss', 'Sir', 'Madam', 'Mme', 'Mlle']
  const re = new RegExp(`^(${titles.join('|')})\.?\s+`, 'i')
  s = s.replace(re, '').trim()
  return s
}

function formatPhone(raw: string | undefined): string {
  if (!raw) return ''
  let s = raw.trim()
  // normalize international prefixes
  s = s.replace(/^00/, '+')
  // remove spaces, hyphens, parentheses
  s = s.replace(/[\s\-()]/g, '')
  // keep leading + then digits only
  const m = s.match(/^\+?\d+$/)
  if (m) return s
  // fallback: remove all non-digits and reapply + if it looked international
  const hasPlus = s.startsWith('+')
  const digits = s.replace(/\D/g, '')
  return (hasPlus ? '+' : '') + digits
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parseContactPerson(raw: string | undefined): { title: string | null; name: string | null } {
  if (!raw) return { title: null, name: null }
  let s = raw.trim().split('.')
  if (!s) return { title: null, name: null }
  // If no known title detected, treat entire string as name
  return { title: s[0], name: s[1] }
}

function guessCountryCodeFromName(name: string): string | null {
  const langs = ['en', 'fr', 'es', 'de'] as const
  for (const lang of langs) {
    const code = countries.getAlpha2Code(name, lang as any)
    if (code) return code
  }
  return null
}

function mapCountryCode(val: string | undefined): string {
  if (!val) return ''
  let raw = val.trim()
  let s = stripAccents(raw).replace(/\./g, ' ').replace(/\s+/g, ' ').trim()
  const lower = s.toLowerCase()

  const synonyms: Record<string, string> = {
    usa: 'US', 'u.s.a': 'US', 'u.s': 'US', us: 'US',
    uk: 'GB', 'great britain': 'GB', britain: 'GB', england: 'GB',
    uae: 'AE', emirates: 'AE',
    russia: 'RU',
    'ivory coast': 'CI', "cote d'ivoire": 'CI', 'cote d ivoire': 'CI',
    'south korea': 'KR', 'republic of korea': 'KR',
    'north korea': 'KP',
    'dr congo': 'CD', 'democratic republic of the congo': 'CD', 'congo-kinshasa': 'CD',
    congo: 'CG', 'congo-brazzaville': 'CG',
    bolivia: 'BO', 'bolivia (plurinational state of)': 'BO',
    laos: 'LA', 'lao pdr': 'LA', 'lao people s democratic republic': 'LA',
    myanmar: 'MM', burma: 'MM',
    'czech republic': 'CZ', czechia: 'CZ',
    eswatini: 'SZ', swaziland: 'SZ',
    macedonia: 'MK', 'north macedonia': 'MK',
    cameroon: 'CM', cameroun: 'CM', cameroom: 'CM',
  }
  if (synonyms[lower]) return synonyms[lower]

  if (/^[a-z]{2}$/i.test(s)) {
    const code = s.toUpperCase()
    if (countries.alpha2ToAlpha3(code)) return code
  }
  if (/^[a-z]{3}$/i.test(s)) {
    const a2 = countries.alpha3ToAlpha2(s.toUpperCase())
    if (a2) return a2
  }

  const nameCode = guessCountryCodeFromName(s)
  if (nameCode) return nameCode

  const fallback = guessCountryCodeFromName(stripAccents(raw))
  return fallback || raw
}

function truncate(val: string | undefined, max: number): string {
  const v = (val || '').trim()
  return v.length > max ? v.slice(0, max) : v
}

function parseBalance(raw: string | undefined): number {
  if (!raw) return 0
  let s = raw.trim()
  // Handle accounting negatives like (123.45)
  s = s.replace(/^\((.*)\)$/g, '-$1')
  // Remove common currency symbols and spaces
  s = s.replace(/[€$£]/g, '').replace(/\s+/g, '')
  // Remove thousands separators and keep decimal point
  s = s.replace(/,(?=\d{3}(\D|$))/g, '')
  // Parse float, fallback to 0
  let n = parseFloat(s)
  if (!Number.isFinite(n)) n = 0
  // Round to 2 decimals to align with decimal(10,2)
  n = Math.round(n * 100) / 100
  // Clamp to safe range to avoid DB overflow
  const MAX = 99_999_999.99 // decimal(10,2) allows up to 8 integer digits
  if (n > MAX) n = MAX
  if (n < -MAX) n = -MAX
  return n
}

export default class ImportCompanyAccounts extends BaseCommand {
  public static commandName = 'import:company_accounts'
  public static description = 'Import company accounts from a CSV file'
  public static options: CommandOptions = { startApp: true }

  public async run() {
    // Defaults; adjust as needed
    const DEFAULT_FILE = path.resolve('docs', 'company_ABS.csv')
    const HOTEL_ID = 3
    const LOG_DIR = path.resolve('tmp')
    const LOG_FILE = path.resolve(LOG_DIR, 'import_company_accounts.log')
    const service = new CompanyAccountService()
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
      fs.writeFileSync(LOG_FILE, `[start] Importing company accounts at ${new Date().toISOString()}\n`)

      const filePath = DEFAULT_FILE
      if (!fs.existsSync(filePath)) {
        const msg = `CSV not found at: ${filePath}`
        this.logger.error(msg)
        fs.appendFileSync(LOG_FILE, `[error] ${msg}\n`)
        return
      }

      const raw = fs.readFileSync(filePath, 'utf-8')
      const rows = parseCsv(raw)
      if (rows.length < 2) {
        const msg = 'CSV appears empty or has no data rows'
        this.logger.error(msg)
        fs.appendFileSync(LOG_FILE, `[error] ${msg}\n`)
        return
      }

      const header = rows[0].map(normalizeHeader)
      const dataRows = rows.slice(1)
      const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase())

      const colCompany = idx('Company')
      const colType = idx('Account Type')
      const colContactPerson = idx('Contact Person')
      const colCity = idx('City')
      const colCountry = idx('Country')
      const colEmail = idx('Email')
      const colEmail2 = idx('Email2')
      const colPhone = idx('Contact')
      const colBalance = idx('Balance')
      const colAddress = idx('Address')
      const colZip = idx('Zip')
      const colState = idx('State')

      // Preview first record mapping for confirmation
      const firstRow = dataRows.find((r) => r && r.length > 0)
      if (firstRow) {
        const getFirst = (i: number) => (i >= 0 && i < firstRow.length ? firstRow[i] : undefined)

        const previewCompanyName = (getFirst(colCompany) || '').trim()
        const previewCompanyCode = service.generateShortCode(previewCompanyName)
        const previewAccountTypeRaw = (getFirst(colType) || '').trim()
        const previewAccountType = ((): 'Corporate' | 'TravelAgency' | 'Government' | 'Airline' | 'Other' => {
          const v = previewAccountTypeRaw.toLowerCase()
          if (['corporate', 'corp', 'business'].includes(v)) return 'Corporate'
          if (['travelagency', 'agency', 'travel agent', 'ta'].includes(v)) return 'TravelAgency'
          if (['government', 'gov'].includes(v)) return 'Government'
          if (['airline', 'air'].includes(v)) return 'Airline'
          return 'Corporate'
        })()

        const previewContact = parseContactPerson(getFirst(colContactPerson))
        const previewPayload = {
          hotelId: HOTEL_ID,
          companyName: previewCompanyName,
          companyCode: previewCompanyCode,
          accountType: previewAccountType,
          // Fallback to company name when contact name is missing
          contactPersonName: truncate(previewContact.name || previewCompanyName, 150) || null,
          contactPersonTitle: truncate(previewContact.title || '', 100) || null,
          primaryEmail: truncate(getFirst(colEmail), 255) || null,
          secondaryEmail: truncate(getFirst(colEmail2), 255) || null,
          primaryPhone: formatPhone(getFirst(colPhone)) || null,
          billingAddressLine: truncate(getFirst(colAddress), 255) || null,
          billingCity: truncate(getFirst(colCity), 100) || null,
          billingStateProvince: truncate(getFirst(colState), 100) || null,
          billingPostalCode: truncate(getFirst(colZip), 20) || null,
          billingCountry: mapCountryCode(getFirst(colCountry)) || null,
          currentBalance: (() => {
            const b = (getFirst(colBalance) || '').trim()
            const val = parseBalance(b)
            return Number.isFinite(val) ? val : 0
          })(),
          accountStatus: 'Active' as const,
          creditStatus: 'Good' as const,
          addToBusinessSource: true,
          doNotCountAsCityLedger: false,
          createdBy: 1,
          lastModifiedBy: 1,
        }

        this.logger.info('Raw first record from CSV: ' + JSON.stringify(firstRow))
        this.logger.info('Preview of first record to import:')
        this.logger.info(JSON.stringify(previewPayload, null, 2))
        try {
          fs.appendFileSync(LOG_FILE, `[preview_raw] ${JSON.stringify(firstRow)}\n`)
          fs.appendFileSync(LOG_FILE, `[preview] ${JSON.stringify(previewPayload)}\n`)
        } catch {}
      }

      let created = 0
      let updated = 0
      let failed = 0
      let rowIndex = 0
      let processed = 0

      for (const row of dataRows) {
        rowIndex++
        processed++
        if (!row || row.length === 0) continue
        const get = (i: number) => (i >= 0 && i < row.length ? row[i] : undefined)

        const companyName = (get(colCompany) || '').trim()
        if (!companyName) continue

        const companyCode = service.generateShortCode(companyName)
        const accountTypeRaw = (get(colType) || '').trim()
        const accountType = ((): 'Corporate' | 'TravelAgency' | 'Government' | 'Airline' | 'Other' => {
          const v = accountTypeRaw.toLowerCase()
          if (['corporate', 'corp', 'business'].includes(v)) return 'Corporate'
          if (['travelagency', 'agency', 'travel agent', 'ta'].includes(v)) return 'TravelAgency'
          if (['government', 'gov'].includes(v)) return 'Government'
          if (['airline', 'air'].includes(v)) return 'Airline'
          return 'Corporate'
        })()

        const contactParsed = parseContactPerson(get(colContactPerson))
        const contactTitle = truncate(contactParsed.title || '', 100)
        // Fallback to companyName when contact name is missing
        const contactName = truncate(contactParsed.name || companyName, 150)
        const email = truncate(get(colEmail), 255)
        const email2 = truncate(get(colEmail2), 255)
        const phone = formatPhone(get(colPhone))
        const city = truncate(get(colCity), 100)
        const state = truncate(get(colState), 100)
        const country = mapCountryCode(get(colCountry))
        const addressLine = truncate(get(colAddress), 255)
        const postalCode = truncate(get(colZip), 20)
        const balanceRaw = (get(colBalance) || '').trim()
        const balance = parseBalance(balanceRaw)

        const payload: Partial<CompanyAccount> & {
          hotelId: number
          companyName: string
          companyCode: string
          accountType: CompanyAccount['accountType']
          contactPersonName?: string | null
          contactPersonTitle?: string | null
          primaryEmail?: string | null
          secondaryEmail?: string | null
          primaryPhone?: string | null
          billingAddressLine?: string | null
          billingCity?: string | null
          billingStateProvince?: string | null
          billingPostalCode?: string | null
          billingCountry?: string | null
          currentBalance: number
          accountStatus: 'Active' | 'Inactive' | 'Suspended' | 'Closed'
          creditStatus: 'Good' | 'Warning' | 'Hold' | 'Blocked'
          addToBusinessSource: boolean
          doNotCountAsCityLedger: boolean
          createdBy: number | null
          lastModifiedBy: number | null
        } = {
          hotelId: HOTEL_ID,
          companyName,
          companyCode,
          accountType,
          // Populate contact person fields from the single 'Contact Person' column
          contactPersonName: contactName || null,
          contactPersonTitle: contactTitle || null,
          primaryEmail: email || null,
          secondaryEmail: email2 || null,
          primaryPhone: phone || null,
          billingAddressLine: addressLine || null,
          billingCity: city || null,
          billingStateProvince: state || null,
          billingPostalCode: postalCode || null,
          billingCountry: country || null,
          currentBalance: Number.isFinite(balance) ? balance : 0,
          accountStatus: 'Active',
          creditStatus: 'Good',
          addToBusinessSource: true,
          doNotCountAsCityLedger: false,
          createdBy: 1,
          lastModifiedBy: 1,
        }

        try {
          // Per-row transaction for atomicity and rollback on failure
          const trx = await Database.transaction()
          try {
            // Try to find by name + hotel to avoid duplicates (inside transaction)
            const existing = await CompanyAccount.query({ client: trx })
              .where('hotelId', HOTEL_ID)
              .andWhere('companyName', companyName)
              .first()

            let companyAccount: CompanyAccount

            if (existing) {
              // Merge allowed fields; keep original createdBy
              existing.merge({
                companyName: payload.companyName,
                companyCode: payload.companyCode,
                accountType: payload.accountType,
                contactPersonName: payload.contactPersonName ?? null,
                contactPersonTitle: payload.contactPersonTitle ?? null,
                primaryEmail: payload.primaryEmail ?? null,
                secondaryEmail: payload.secondaryEmail ?? null,
                primaryPhone: payload.primaryPhone ?? null,
                billingAddressLine: payload.billingAddressLine ?? null,
                billingCity: payload.billingCity ?? null,
                billingStateProvince: payload.billingStateProvince ?? null,
                billingPostalCode: payload.billingPostalCode ?? null,
                billingCountry: payload.billingCountry ?? null,
                currentBalance: payload.currentBalance,
                accountStatus: payload.accountStatus,
                creditStatus: payload.creditStatus,
                addToBusinessSource: payload.addToBusinessSource,
                doNotCountAsCityLedger: payload.doNotCountAsCityLedger,
                lastModifiedBy: payload.lastModifiedBy,
              } as any)
              await existing.useTransaction(trx).save()
              companyAccount = existing
              // Side effects within same transaction
              // Business Source
              if (companyAccount.addToBusinessSource === true) {
                const bsExists = await BusinessSource.query({ client: trx })
                  .where('hotelId', HOTEL_ID)
                  .andWhere('name', companyAccount.companyName)
                  .first()
                if (!bsExists) {
                  await BusinessSource.create({
                    hotelId: HOTEL_ID,
                    name: companyAccount.companyName,
                    shortCode: service.generateShortCode(companyAccount.companyName),
                    registrationNumber: companyAccount.registrationNumber || null,
                    createdByUserId: companyAccount.createdBy || 1,
                    updatedByUserId: companyAccount.createdBy || 1,
                    isDeleted: false,
                  }, { client: trx })
                }
              }

              // City Ledger Payment Method
              if (companyAccount.doNotCountAsCityLedger !== true) {
                const methodCode = service.generateShortCode(`CL-${companyAccount.companyName}`)
                const pmExists = await PaymentMethod.query({ client: trx })
                  .where('hotelId', HOTEL_ID)
                  .andWhere('methodCode', methodCode)
                  .first()
                if (pmExists) {
                  pmExists.isActive = true
                  ;(pmExists as any).lastModifiedBy = companyAccount.createdBy || 1
                  await pmExists.useTransaction(trx).save()
                } else {
                  await PaymentMethod.create({
                    hotelId: HOTEL_ID,
                    companyId: companyAccount.id,
                    methodName: `${companyAccount.companyName}`,
                    methodCode: methodCode,
                    methodType: PaymentMethodType.CITY_LEDGER,
                    shortCode: service.generateShortCode(`CL-${companyAccount.companyName}`),
                    isActive: true,
                    description: `City ledger payment method for ${companyAccount.companyName}`,
                    createdBy: companyAccount.createdBy || 1,
                    lastModifiedBy: companyAccount.createdBy || 1,
                  } as any, { client: trx })
                }
              }

              await trx.commit()
              updated++
            } else {
              // Create new company account inside transaction
              companyAccount = await CompanyAccount.create(payload as any, { client: trx })

              // Side effects within same transaction
              if (companyAccount.addToBusinessSource === true) {
                const bsExists = await BusinessSource.query({ client: trx })
                  .where('hotelId', HOTEL_ID)
                  .andWhere('name', companyAccount.companyName)
                  .first()
                if (!bsExists) {
                  await BusinessSource.create({
                    hotelId: HOTEL_ID,
                    name: companyAccount.companyName,
                    shortCode: service.generateShortCode(companyAccount.companyName),
                    registrationNumber: companyAccount.registrationNumber || null,
                    createdByUserId: companyAccount.createdBy || 1,
                    updatedByUserId: companyAccount.createdBy || 1,
                    isDeleted: false,
                  }, { client: trx })
                }
              }

              if (companyAccount.doNotCountAsCityLedger !== true) {
                const methodCode = service.generateShortCode(`CL-${companyAccount.companyName}`)
                const pmExists = await PaymentMethod.query({ client: trx })
                  .where('hotelId', HOTEL_ID)
                  .andWhere('methodCode', methodCode)
                  .first()
                if (pmExists) {
                  pmExists.isActive = true
                  ;(pmExists as any).lastModifiedBy = companyAccount.createdBy || 1
                  await pmExists.useTransaction(trx).save()
                } else {
                  await PaymentMethod.create({
                    hotelId: HOTEL_ID,
                    companyId: companyAccount.id,
                    methodName: `${companyAccount.companyName}`,
                    methodCode: methodCode,
                    methodType: PaymentMethodType.CITY_LEDGER,
                    shortCode: service.generateShortCode(`CL-${companyAccount.companyName}`),
                    isActive: true,
                    description: `City ledger payment method for ${companyAccount.companyName}`,
                    createdBy: companyAccount.createdBy || 1,
                    lastModifiedBy: companyAccount.createdBy || 1,
                  } as any, { client: trx })
                }
              }

              await trx.commit()
              created++
            }
          } catch (rowErr) {
            // Rollback any side effects and account changes
            try { await trx.rollback() } catch {}
            failed++
            const message = (rowErr as Error).message
            this.logger.error(`Failed to import row #${rowIndex}: ${message}`)
            this.logger.error(`Row data: ${JSON.stringify(row)}`)
            this.logger.error(`Balance raw="${balanceRaw}", parsed=${balance}`)
            try {
              fs.appendFileSync(LOG_FILE, `[error] row_index=${rowIndex} message=${message}\n`)
              fs.appendFileSync(LOG_FILE, `[error_row] ${JSON.stringify(row)}\n`)
              fs.appendFileSync(LOG_FILE, `[error_balance] raw="${balanceRaw}" parsed=${balance}\n`)
            } catch {}
          }
        } catch (err) {
          failed++
          const message = (err as Error).message
          this.logger.error(`Failed to import row #${rowIndex}: ${message}`)
          this.logger.error(`Row data: ${JSON.stringify(row)}`)
          this.logger.error(`Balance raw="${balanceRaw}", parsed=${balance}`)
          try {
            fs.appendFileSync(LOG_FILE, `[error] row_index=${rowIndex} message=${message}\n`)
            fs.appendFileSync(LOG_FILE, `[error_row] ${JSON.stringify(row)}\n`)
            fs.appendFileSync(LOG_FILE, `[error_balance] raw="${balanceRaw}" parsed=${balance}\n`)
          } catch {}
        }
      }

      const summary = `Import completed. Processed: ${processed}, Created: ${created}, Updated: ${updated}, Failed: ${failed}`
      this.logger.success(summary)
      try { fs.appendFileSync(LOG_FILE, `[end] ${summary}\n`) } catch {}
    } catch (error) {
      const msg = `Import failed: ${(error as Error).message}`
      this.logger.error(msg)
      try { fs.appendFileSync(LOG_FILE, `[fatal] ${msg}\n`) } catch {}
    }
  }
}