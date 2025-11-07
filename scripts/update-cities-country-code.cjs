// Script: Normalize all country values to two-letter ISO codes (lowercase) in data/cities.json
// Usage: node scripts/update-cities-country-code.cjs

const fs = require('fs')
const path = require('path')
const countries = require('i18n-iso-countries')

// Register locales for broader matching
countries.registerLocale(require('i18n-iso-countries/langs/en.json'))
countries.registerLocale(require('i18n-iso-countries/langs/fr.json'))
countries.registerLocale(require('i18n-iso-countries/langs/es.json'))
countries.registerLocale(require('i18n-iso-countries/langs/de.json'))

function loadJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8')
  try {
    return JSON.parse(raw)
  } catch (err) {
    console.error('Failed to parse JSON at', filePath, err.message)
    process.exit(1)
  }
}

function saveJson(filePath, data) {
  const tmpPath = filePath + '.tmp'
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  fs.renameSync(tmpPath, filePath)
}

function cleanCountryName(name) {
  let v = (name || '').trim()
  v = v.replace(/[\u2018\u2019\u201C\u201D]/g, "'") // smart quotes to ascii
  v = v.replace(/\./g, '') // remove dots (e.g., U.S.A.)
  v = v.replace(/\s+/g, ' ') // collapse spaces
  return v
}

const SYNONYMS = new Map(
  Object.entries({
    'usa': 'US',
    'united states': 'US',
    'u s a': 'US',
    'uk': 'GB',
    'united kingdom': 'GB',
    'ivory coast': 'CI',
    "cote d'ivoire": 'CI',
    'côte d\'ivoire': 'CI',
    'dr congo': 'CD',
    'democratic republic of the congo': 'CD',
    'congo kinshasa': 'CD',
    'congo brazzaville': 'CG',
    'south korea': 'KR',
    'north korea': 'KP',
    'russia': 'RU',
    'laos': 'LA',
    'swaziland': 'SZ',
    'eswatini': 'SZ',
    'czech republic': 'CZ',
    'czechia': 'CZ',
    'cape verde': 'CV',
    'cabo verde': 'CV',
    'burma': 'MM',
    'myanmar': 'MM',
    // Added based on unknowns report
    'syria': 'SY',
    'palestinian territory': 'PS',
    'macedonia': 'MK',
    'moldova': 'MD',
    'east timor': 'TL',
    'brunei': 'BN',
    'british virgin islands': 'VG',
    'us virgin islands': 'VI',
    'bonaire, saint eustatius and saba': 'BQ',
    'cocos islands': 'CC',
    'cocos (keeling) islands': 'CC',
    'curacao': 'CW',
    'curaçao': 'CW',
    'falkland islands': 'FK',
    'saint barthelemy': 'BL',
    'saint barthélemy': 'BL',
    'saint martin': 'MF', // default to French part; change to 'SX' if needed
    'vatican': 'VA',
  })
)

function toAlpha2(countryRaw) {
  const original = cleanCountryName(countryRaw)
  const lower = original.toLowerCase()
  if (/^[a-zA-Z]{2}$/.test(original)) {
    return original.toLowerCase()
  }

  // Try synonyms first
  if (SYNONYMS.has(lower)) {
    return SYNONYMS.get(lower).toLowerCase()
  }

  // Try direct lookups across multiple locales
  const locales = ['en', 'fr', 'es', 'de']
  for (const locale of locales) {
    const code = countries.getAlpha2Code(original, locale)
    if (code) return code.toLowerCase()
  }

  // Try without parenthetical qualifiers (e.g., "Congo (Kinshasa)")
  const stripped = original.replace(/\s*\([^)]*\)\s*/g, '')
  if (stripped !== original) {
    for (const locale of locales) {
      const code = countries.getAlpha2Code(stripped, locale)
      if (code) return code.toLowerCase()
    }
    const lowStripped = stripped.toLowerCase()
    if (SYNONYMS.has(lowStripped)) return SYNONYMS.get(lowStripped).toLowerCase()
  }

  return null
}

function main() {
  const filePath = path.join(__dirname, '..', 'data', 'cities.json')
  if (!fs.existsSync(filePath)) {
    console.error('cities.json not found at', filePath)
    process.exit(1)
  }

  const data = loadJson(filePath)
  if (!Array.isArray(data)) {
    console.error('Expected an array in cities.json, got', typeof data)
    process.exit(1)
  }

  let total = data.length
  let updated = 0
  let alreadyTwoLetter = 0
  let unknown = 0
  let removedGeonameid = 0
  const unknownCountries = new Map()

  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    if (Object.prototype.hasOwnProperty.call(item, 'geonameid')) {
      delete item.geonameid
      removedGeonameid++
    }
    const current = item.country
    const cleaned = cleanCountryName(current)
    if (!cleaned) continue
    if (/^[a-zA-Z]{2}$/.test(cleaned)) {
      // ensure lowercase
      const lower = cleaned.toLowerCase()
      if (item.country !== lower) {
        item.country = lower
        updated++
      } else {
        alreadyTwoLetter++
      }
      continue
    }

    const alpha2 = toAlpha2(cleaned)
    if (alpha2) {
      if (item.country !== alpha2) {
        item.country = alpha2
        updated++
      }
    } else {
      unknown++
      const key = cleaned.toLowerCase()
      unknownCountries.set(key, (unknownCountries.get(key) || 0) + 1)
    }

    
  }

  saveJson(filePath, data)
  console.log(
    `Processed ${total} records. Updated ${updated}. Already two-letter: ${alreadyTwoLetter}. Unknown mappings: ${unknown}. Removed geonameid: ${removedGeonameid}.`
  )

  // Write unknowns report for review
  const reportPath = path.join(__dirname, '..', 'data', 'unknown_countries.json')
  const report = {
    totalRecords: total,
    normalizedUpdates: updated,
    alreadyTwoLetter,
    unknownCount: unknown,
    uniqueUnknownNames: unknownCountries.size,
    countries: Array.from(unknownCountries.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  }
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', 'utf8')
  console.log('Unknown countries report saved to', reportPath)
}

main()