import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import fs from 'fs'
import Currency from '#models/currency'

type InputCurrency = {
  COUNTRY: string
  DATE?: string
  CURRENCY: string
  SIGN: string
  CONVERSION_CURRENCY?: string
  RATE: number
  CREATED_BY?: string
}

function nameFromCode(code: string): string {
  const map: Record<string, string> = {
    XOF: 'West African CFA Franc',
    XAF: 'Central African CFA Franc',
    EUR: 'Euro',
    GBP: 'Pound Sterling',
    JPY: 'Japanese Yen',
    USD: 'US Dollar',
  }
  return map[code.toUpperCase()] || code.toUpperCase()
}

function digitsFromCode(code: string): number {
  const zero: string[] = ['XOF', 'XAF', 'JPY']
  const two: string[] = ['EUR', 'GBP', 'USD']
  const u = code.toUpperCase()
  if (zero.includes(u)) return 0
  if (two.includes(u)) return 2
  return 2
}

function prefixSuffixFrom(code: string, sign: string): 'prefix' | 'suffix' {
  const suffixCodes = ['XOF', 'XAF']
  const u = code.toUpperCase()
  if (suffixCodes.includes(u)) return 'suffix'
  // Fallback: symbol signs are usually prefix
  if (['€', '£', '$', '¥'].includes(sign)) return 'prefix'
  return 'prefix'
}

export default class ImportCurrencies extends BaseCommand {
  public static commandName = 'import:currencies'
  public static description = 'Import currencies from a JSON file into the database'
  public static options: CommandOptions = { startApp: true }

  /**
   * Usage examples:
   * node ace import:currencies --hotelId=5 --file="C:\\Users\\styve\\Documents\\Enjoy\\Suita Configuration\\master\\currency.json"
   */
  public async run() {
    const HOTEL_ID = 5
    const filePath = 'C://Users//styve//Documents//Enjoy//Suita Configuration//master//currency.json'

    if (!fs.existsSync(filePath)) {
      this.logger.error(`File not found: ${filePath}`)
      return
    }

    let input: InputCurrency[]
    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      input = JSON.parse(raw)
      if (!Array.isArray(input)) throw new Error('JSON must be an array of currency entries')
    } catch (err: any) {
      this.logger.error(`Failed to read/parse JSON: ${err.message}`)
      return
    }

    let created = 0
    let updated = 0

    for (const row of input) {
      const code = (row.CURRENCY || '').trim().toUpperCase()
      const sign = (row.SIGN || '').trim()
      const country = (row.COUNTRY || '').trim()
      const rate = Number(row.RATE)

      if (!code || !country || !sign || !Number.isFinite(rate)) {
        this.logger.warning(`Skipping invalid entry: ${JSON.stringify(row)}`)
        continue
      }

      const name = nameFromCode(code)
      const digitsAfterDecimal = digitsFromCode(code)
      const prefixSuffix = prefixSuffixFrom(code, sign)

      const existing = await Currency.query()
        .where('hotel_id', HOTEL_ID)
        .where('currency_code', code)
        .where('is_deleted', false)
        .first()

      if (existing) {
        existing.merge({
          country,
          name,
          sign,
          prefixSuffix,
          currencyCode: code,
          digitsAfterDecimal,
          exchangeRate: rate,
          isEditable: true,
        })
        await existing.save()
        updated++
        this.logger.info(`Updated ${code} for hotel ${HOTEL_ID}`)
      } else {
        await Currency.create({
          country,
          name,
          sign,
          prefixSuffix,
          currencyCode: code,
          digitsAfterDecimal,
          exchangeRate: rate,
          isEditable: true,
          hotelId: HOTEL_ID,
        })
        created++
        this.logger.info(`Created ${code} for hotel ${HOTEL_ID}`)
      }
    }

    this.logger.success(`Import complete. Created: ${created}, Updated: ${updated}`)
  }
}