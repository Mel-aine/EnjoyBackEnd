import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'fs'
import path from 'path'
import { DateTime } from 'luxon'
import Guest from '#models/guest'
import { generateGuestCode } from '../app/utils/generate_guest_code.js'
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

function normalizeTitle(raw: string | undefined): string | null {
  if (!raw) return null
  const t = raw.trim().replace(/\./g, '').toLowerCase()
  switch (t) {
    case 'mr': return 'Mr'
    case 'mrs': return 'Mrs'
    case 'ms': return 'Ms'
    case 'dr': return 'Dr'
    case 'prof': return 'Prof'
    case 'miss': return 'Miss'
    default: return null
  }
}

function parseNameField(guestName: string): { title: string | null; firstName: string; lastName: string; middleName: string | null } {
  let name = guestName.trim()
  name = name.replace(/^"|"$/g, '')

  let title: string | null = null
  const titleMatch = name.match(/^([A-Za-z]{2,5}\.?)/)
  if (titleMatch) {
    title = normalizeTitle(titleMatch[1])
    name = name.slice(titleMatch[0].length).trim()
  }

  if (name.includes(',')) {
    const [last, rest] = name.split(',').map((p) => p.trim())
    const parts = rest.split(/\s+/)
    const first = parts.shift() || ''
    const middle = parts.length ? parts.join(' ') : null
    return { title, firstName: first, lastName: last, middleName: middle }
  }

  const parts = name.split(/\s+/).filter(Boolean)
  if (parts.length === 1) {
    return { title, firstName: parts[0], lastName: '', middleName: null }
  }
  const last = parts.shift() || ''
  const first = parts.shift() || ''
  const middle = parts.length ? parts.join(' ') : null
  return { title, firstName: first, lastName: last, middleName: middle }
}

function parseBoolean(val: string | undefined): boolean | null {
  if (!val) return null
  const v = val.trim().toLowerCase()
  if (['yes', 'y', 'true', '1'].includes(v)) return true
  if (['no', 'n', 'false', '0'].includes(v)) return false
  return null
}

function parseDate(val: string | undefined): DateTime | null {
  if (!val) return null
  const s = val.trim().replace(/^"|"$/g, '')
  const formats = ['yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy', 'MM-DD-YYYY']
  for (const f of formats) {
    const dt = DateTime.fromFormat(s, f)
    if (dt.isValid) return dt
  }
  const iso = DateTime.fromISO(s)
  return iso.isValid ? iso : null
}

function mapVipStatus(val: string | undefined): string | null {
  if (!val) return null
  const v = val.trim().toLowerCase()
  const allowed = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond']
  if (allowed.includes(v)) return v
  if (v === '' || v === 'no' || v === 'none') return 'none'
  if (v.includes('gold')) return 'gold'
  if (v.includes('silver')) return 'silver'
  if (v.includes('platinum')) return 'platinum'
  if (v.includes('diamond')) return 'diamond'
  return 'none'
}

function mapGuestType(val: string | undefined): 'individual' | 'corporate' | 'group' | 'travel_agent' {
  if (!val) return 'individual'
  const v = val.trim().toLowerCase()
  if (['individual', 'indv', 'person', 'guest', 'personal'].includes(v)) return 'individual'
  if (['corporate', 'corp', 'company', 'business'].includes(v)) return 'corporate'
  if (['group', 'grp', 'family', 'party'].includes(v)) return 'group'
  if (['travel agent', 'agent', 'ta', 'travel', 'agency'].includes(v)) return 'travel_agent'
  return 'individual'
}

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
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

  // Handle common abbreviations and synonyms quickly
  const synonyms: Record<string, string> = {
    usa: 'US', 'u.s.a': 'US', 'u.s': 'US', 'us': 'US',
    uk: 'GB', 'great britain': 'GB', 'britain': 'GB', 'england': 'GB',
    uae: 'AE', 'emirates': 'AE',
    russia: 'RU',
    'ivory coast': 'CI', "cote d'ivoire": 'CI', 'cote d ivoire': 'CI',
    'south korea': 'KR', 'republic of korea': 'KR',
    'north korea': 'KP',
    'dr congo': 'CD', 'democratic republic of the congo': 'CD', 'congo-kinshasa': 'CD',
    'congo': 'CG', 'congo-brazzaville': 'CG',
    'bolivia': 'BO', 'bolivia (plurinational state of)': 'BO',
    'laos': 'LA', 'lao pdr': 'LA', 'lao people s democratic republic': 'LA',
    'myanmar': 'MM', 'burma': 'MM',
    'czech republic': 'CZ', 'czechia': 'CZ',
    'eswatini': 'SZ', 'swaziland': 'SZ',
    'macedonia': 'MK', 'north macedonia': 'MK',
    cameroom: 'CM', cameroon: 'CM', cameroun: 'CM',
  }
  if (synonyms[lower]) return synonyms[lower]

  // If alpha-2 code
  if (/^[a-z]{2}$/i.test(s)) {
    const code = s.toUpperCase()
    // Validate against known list
    if (countries.alpha2ToAlpha3(code)) return code
  }
  // If alpha-3 code
  if (/^[a-z]{3}$/i.test(s)) {
    const a2 = countries.alpha3ToAlpha2(s.toUpperCase())
    if (a2) return a2
  }

  // Try name-based lookup across locales
  const nameCode = guessCountryCodeFromName(s)
  if (nameCode) return nameCode

  // Fallback: try the original raw value
  const fallback = guessCountryCodeFromName(stripAccents(raw))
  return fallback || raw
}

function truncate(val: string | undefined, max: number): string {
  const v = (val || '').trim()
  return v.length > max ? v.slice(0, max) : v
}

export default class ImportGuests extends BaseCommand {
  public static commandName = 'import:guests'
  public static description = 'Import guests from a CSV file into the database'
  public static options: CommandOptions = { startApp: true }

  public async run() {
    const DEFAULT_FILE = path.resolve('docs', 'guestdatabse_ABS_ij6NHV3euux50fwcgrnpSw_ABS_68ee2eac48b71.csv')
    const HOTEL_ID = 5
    const LOG_DIR = path.resolve('tmp')
    const LOG_FILE = path.resolve(LOG_DIR, 'import_guests.log')
    try {
      if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
      fs.writeFileSync(LOG_FILE, `[start] Importing guests at ${new Date().toISOString()}\n`)

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

      const colGuestName = idx('Guest Name')
      const colType = idx('Type')
      const colAddress = idx('Address')
      const colZip = idx('Zip')
      const colCity = idx('City')
      const colState = idx('State')
      const colCountry = idx('Country')
      const colNationality = idx('Nationality')
      const colRegNo = idx('Registration Number')
      const colPhone = idx('Phone')
      const colMobile = idx('Mobile')
      const colFax = idx('Fax')
      const colEmail = idx('Email')
      const colBirthDate = idx('Birth Date')
      const colSpouseBirthDate = idx('Spouse Birth Date')
      const colWeddingAnniversary = idx('Wedding Anniversary')
      const colIdType = idx('Id Type')
      const colIdNo = idx('Id No')
      const colExpiryDate = idx('Expiry Date')
      const colVipStatus = idx('VIP Status')
      const colPaymentMethod = idx('Payment Method')
      const colDirectBilling = idx('Direct Billing A/C')
      const colBlacklistReason = idx('Blacklist Reason')
      const colIsGdpr = idx('is GDPR')

      let created = 0
      let updated = 0
      let failed = 0

      for (const row of dataRows) {
        if (!row || row.length === 0) continue
        const get = (idx: number) => (idx >= 0 && idx < row.length ? row[idx] : undefined)

        const guestName = get(colGuestName) || ''
        const { title, firstName, lastName, middleName } = parseNameField(guestName)

        const email = (get(colEmail) || '').trim()
        const payload: any = {
          title: title ?? null,
          firstName: truncate(firstName, 100),
          lastName: truncate(lastName, 100),
          middleName: truncate(middleName || '', 100),
          hotelId: HOTEL_ID,
          guestType: mapGuestType(get(colType)),
          addressLine: (get(colAddress) || '').trim(),
          postalCode: truncate((get(colZip) || '').trim(), 20),
          city: truncate((get(colCity) || '').trim(), 100),
          stateProvince: truncate((get(colState) || '').trim(), 100),
          country: mapCountryCode(get(colCountry)),
          nationality: truncate((get(colNationality) || '').trim(), 100),
          registrationNumber: truncate((get(colRegNo) || '').trim(), 255),
          phonePrimary: truncate((get(colPhone) || '').trim(), 20),
          fax: truncate((get(colFax) || '').trim(), 255),
          email: truncate(email, 255),
          idType: truncate((get(colIdType) || '').trim(), 255),
          idNumber: truncate((get(colIdNo) || '').trim(), 255),
          blacklisted: !!(get(colBlacklistReason) || '').trim(),
          vipStatus: mapVipStatus(get(colVipStatus)) || 'none',
        }

        const dob = parseDate(get(colBirthDate))
        if (dob) payload.dateOfBirth = dob
        const idExp = parseDate(get(colExpiryDate))
        if (idExp) payload.idExpiryDate = idExp

        try {
          let guest: Guest | null = null
          if (email) {
            guest = await Guest.query().where('email', email).first()
          } else if (payload.registrationNumber) {
            guest = await Guest.query().where('registrationNumber', payload.registrationNumber).first()
          }

          if (guest) {
            guest.merge(payload)
            await guest.save()
            updated++
          } else {
            const createdGuest = await Guest.create({
              ...payload,
              guestCode: generateGuestCode(),
              createdBy: null,
            })
            if (createdGuest) created++
          }
        } catch (err) {
          failed++
          const message = (err as Error).message
          this.logger.error(`Failed to import row: ${message}`)
          fs.appendFileSync(LOG_FILE, `[error] ${message}\n`)
        }
      }

      const summary = `Import completed. Created: ${created}, Updated: ${updated}, Failed: ${failed}`
      this.logger.success(summary)
      fs.appendFileSync(LOG_FILE, `[end] ${summary}\n`)
    } catch (error) {
      const msg = `Import failed: ${(error as Error).message}`
      this.logger.error(msg)
      try { fs.appendFileSync(LOG_FILE, `[fatal] ${msg}\n`) } catch {}
    }
  }
}
