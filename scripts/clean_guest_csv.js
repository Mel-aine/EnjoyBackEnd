// Simple CSV cleaner: removes specific columns from docs/Guest.csv
// Keeps: hotel_id, Guest Name, Email, Mobile No, Country, State
// Writes output to docs/Guest.cleaned.csv

import fs from 'node:fs'
import path from 'node:path'

function parseCsvRow(line) {
  const result = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        // handle escaped quotes ""
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current)
  return result
}

function formatCell(cell) {
  if (cell == null) return ''
  const str = String(cell)
  if (str.includes('"')) {
    // escape quotes
    const escaped = str.replace(/"/g, '""')
    return `"${escaped}"`
  }
  if (str.includes(',') || /\s/.test(str)) {
    return `"${str}"`
  }
  return str
}

function cleanGuestCsv() {
  const inputPath = path.resolve(process.cwd(), 'docs', 'Guest.csv')
  const outputPath = path.resolve(process.cwd(), 'docs', 'Guest.cleaned.csv')

  if (!fs.existsSync(inputPath)) {
    console.error('Input CSV not found:', inputPath)
    process.exit(1)
  }

  const raw = fs.readFileSync(inputPath, 'utf8')
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    console.error('Input CSV is empty')
    process.exit(1)
  }

  const header = parseCsvRow(lines[0]).map((h) => h.trim())
  const keepHeaders = ['hotel_id', 'Guest Name', 'Email', 'Mobile No', 'Country', 'State']

  const indices = keepHeaders.map((h) => header.indexOf(h))
  const missing = indices.reduce((acc, idx, i) => {
    if (idx === -1) acc.push(keepHeaders[i])
    return acc
  }, [])

  if (missing.length > 0) {
    console.warn('Warning: Some expected columns were not found:', missing.join(', '))
  }

  const output = []
  output.push(keepHeaders.join(','))

  for (let li = 1; li < lines.length; li++) {
    const cols = parseCsvRow(lines[li])
    const outRow = indices.map((idx) => (idx >= 0 && idx < cols.length ? cols[idx] : ''))
    output.push(outRow.map(formatCell).join(','))
  }

  fs.writeFileSync(outputPath, output.join('\n'), 'utf8')
  console.log('Wrote cleaned CSV to', outputPath)
}

cleanGuestCsv()
