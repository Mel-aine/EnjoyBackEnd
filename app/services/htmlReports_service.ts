// app/services/htmlReports_service.ts
import { DateTime } from 'luxon'
import { ReportFilters } from './reports_service.js'

export interface HtmlReport {
  title: string
  html: string
  generatedAt: DateTime
  filters: ReportFilters
}

export class HtmlReportGenerator {

  // Génère un rapport HTML pour la liste d'arrivée
  static generateArrivalListHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    // Mapping des colonnes disponibles
    const availableColumns = {
        'pickUp': { key: 'pickUp', label: 'Pick Up' },
        'dropOff': { key: 'dropOff', label: 'Drop Off' },
        'resType': { key: 'resType', label: 'Res.Type' },
        'company': { key: 'company', label: 'Company' },
        'user': { key: 'user', label: 'User' },
        'deposit': { key: 'deposit', label: 'Deposit' },
        'balanceDue': { key: 'balanceDue', label: 'Balance Due' },
        'marketCode': { key: 'marketCode', label: 'Market Code' },
        'businessSource': { key: 'businessSource', label: 'Business Source' },
        'mealPlan': { key: 'mealPlan', label: 'Meal Plan' },
        'rateType': { key: 'rateType', label: 'Rate Type' }
    }

    // Colonnes de base toujours visibles
    const baseColumns = [
        { key: 'reservationNumber', label: 'Res. No' },
        { key: 'guestName', label: 'Guest' },
        { key: 'roomInfo', label: 'Room' },
        { key: 'ratePerNight', label: 'Rate<br>(Rs)' },
        { key: 'arrivalDate', label: 'Arrival' },
        { key: 'departureDate', label: 'Departure' },
        { key: 'paxInfo', label: 'Pax' }
    ]

    // Colonnes supplémentaires sélectionnées
    const selectedAdditionalColumns = (filters.selectedColumns || [])
        .filter(col => availableColumns[col])
        .map(col => availableColumns[col])

    // Toutes les colonnes à afficher
    const allColumns = [...baseColumns, ...selectedAdditionalColumns]

    // Générer les en-têtes du tableau
    const tableHeaders = allColumns.map(column =>
        `<th>${column.label}</th>`
    ).join('')

    // Mapping des clés de données vers les colonnes
    const dataKeyMapping = {
        'pickUp': 'pickUp',
        'dropOff': 'dropOff',
        'resType': 'reservationType',
        'company': 'company',
        'user': 'createdBy',
        'deposit': 'depositPaid',
        'balanceDue': 'balanceDue',
        'marketCode': 'marketSegment',
        'businessSource': 'businessSource',
        'mealPlan': 'mealPlan',
        'rateType': 'ratePlan'
    }

    // Fonction pour formater les valeurs
    const formatValue = (value: any, key: string) => {
        if (value === undefined || value === null) return ''

        // Formater les montants financiers
        if (['ratePerNight', 'displayAmount', 'depositPaid', 'balanceDue', 'finalAmount', 'totalAmount'].includes(key)) {
            return Math.round(Number(value)).toLocaleString('en-US')
        }

        return value.toString()
    }

    // Générer les lignes du tableau
    const tableRows = data.map((item, index) => {
        const roomInfo = `${item.roomNumber || 'N/A'}${item.roomType ? ` - ${item.roomType}` : ''}`
        const paxInfo = `${item.adults || 0}/${item.children || 0}`

        // Montant à afficher selon le filtre showAmount
        const displayRate = filters.showAmount === 'total_rent'
            ? (item.totalAmount || item.finalAmount || 0)
            : (item.ratePerNight || 0)

        // Cellules de base
        const baseCells = [
            `<td class="res-number">${formatValue(item.reservationNumber, 'reservationNumber')}</td>`,
            `<td>${formatValue(item.guestName, 'guestName')}</td>`,
            `<td>${roomInfo}</td>`,
            `<td class="rate-cell">${formatValue(displayRate, 'displayAmount')}</td>`,
            `<td>${item.arrivalDate}</td>`,
            `<td>${item.departureDate || ''}</td>`,
            `<td>${paxInfo}</td>`
        ]

        // Cellules supplémentaires basées sur la sélection
        const additionalCells = selectedAdditionalColumns.map(column => {
            const dataKey = dataKeyMapping[column.key] || column.key
            const value = formatValue(item[dataKey], dataKey)
            const cellClass = column.key === 'user' ? ' class="user-cell"' : ''
            return `<td${cellClass}>${value}</td>`
        })

        return `<tr>${[...baseCells, ...additionalCells].join('')}</tr>`
    }).join('')

    // Formater les dates pour l'affichage des filtres
    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromISO(dateString).toFormat('dd/MM/yyyy')
        } catch {
            return dateString
        }
    }

    // Calculer le nombre total de pax
    const totalPax = `${summary.totalAdults || 0}/${summary.totalChildren || 0}`

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data[0]?.hotelName || 'Hotel'} - Arrival List</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            background-color: white;
            border: 2px solid #666;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #999;
        }

        .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color:rgb(10, 5, 144); /* BLEU */
        }

        .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #800000; /* ROUGE BORDEAU */
            text-align: right;
        }

        .arrival-btn {
            border: 2px solid #c00;
            background: white;
            color: #c00;
            padding: 8px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }

        .filters {
            display: flex;
            gap: 0px;
            align-items: center;
            margin-bottom: 20px;
            font-size: 13px;
            padding-left: 0;
        }

        .filters label {
            font-weight: bold;
        }

        .filters input {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
        }

        .filters select {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
            background-color: transparent;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        table th {
            background-color: transparent;
            border: none;
            border-top: 1px solid #999;
            border-bottom: 1px solid #999;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        table td {
            border: none;
            border-bottom: 1px solid #999;
            padding: 8px;
            font-size: 13px;
        }

        .res-number {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .user-cell {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .rate-cell {
            text-align: left;
        }

        .time {
            font-size: 11px;
            color: #666;
        }

        .footer-row {
            background-color: #fff;
            font-weight: bold;
        }

        .no-data {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        @media print {
            body {
                background-color: white;
                padding: 0;
            }

            .container {
                border: none;
                max-width: 100%;
            }

            .arrival-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
            <div class="report-title">Arrival List</div>
        </div>

        <div class="filters">
            <label>Date From</label>
            <input type="text" value="${filters.startDate ? formatDate(filters.startDate) : 'N/A'}" readonly>
            <label>To</label>
            <input type="text" value="${filters.endDate ? formatDate(filters.endDate) : 'N/A'}" readonly>
            <label>Order By</label>
            <select disabled>
                <option>Room</option>
            </select>
            <label>Tax Inclusive Rates (Disc./Adj. included, if applied)</label>
            <select disabled>
                <option>${filters.taxInclusive ? 'Yes' : 'No'}</option>
            </select>
        </div>

        ${data.length > 0 ? `
        <table>
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr class="footer-row">
                    <td colspan="2"><strong>Total Reservation</strong></td>
                    <td><strong>#(${summary.totalArrivals || 0})</strong></td>
                    <td colspan="${allColumns.length - 3}"><strong>${totalPax}</strong></td>
                </tr>
            </tbody>
        </table>
        ` : `
        <div class="no-data">
            No data matches the selected filters
        </div>
        `}
    </div>
</body>
</html>
    `
  }

  // Génère un rapport HTML pour la liste de départ
  static generateDepartureListHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'resNo', label: 'Res. No' },
        { key: 'guest', label: 'Guest' },
        { key: 'room', label: 'Room' },
        { key: 'rate', label: 'Rate<br>(Rs)' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'departure', label: 'Departure' },
        { key: 'pax', label: 'Pax' },
        { key: 'BusiSour', label: 'Business Source' },
        { key: 'restyp', label: 'Res.Type' },
        { key: 'user', label: 'User' }
    ]

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    const tableRows = data.map((item, index) => {
        const cells = columns.map(column => {
            const value = item[column.key] || '-'
            const cellClass = column.key === 'user' ? ' class="user-cell"' : ''
            const alignClass = column.key === 'rate' ? ' class="rate-cell"' : ''
            return `<td${cellClass}${alignClass}>${value}</td>`
        })
        return `<tr>${cells.join('')}</tr>`
    }).join('')

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromISO(dateString).toFormat('dd/MM/yyyy')
        } catch {
            return dateString
        }
    }

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data[0]?.hotelName || 'Hotel'} - Departure List</title>
    <style>
        .report-wrapper {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: white;
        }

        .report-wrapper .container {
            background-color: white;
            border: 2px solid #666;
            padding: 20px;
            max-width: 1200px;
            margin: 0 auto;
        }

        .report-wrapper .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #999;
        }

        .report-wrapper .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color: rgb(10, 5, 144);
        }

        .report-wrapper .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #800000;
            text-align: right;
        }

        .report-wrapper .filters {
            display: flex;
            flex-direction: row;
            align-items: center;
            flex-wrap: nowrap;
            gap: 6px;
            margin-bottom: 20px;
            font-size: 13px;
            white-space: nowrap;
        }

        .report-wrapper .filters label {
            font-weight: bold;
        }

        .report-wrapper .filters input {
            border: none;
            border-bottom: 1px solid #ccc;
            padding: 2px 6px;
            font-size: 13px;
            background-color: transparent;
            width: auto;
            max-width: 120px;
        }

        .report-wrapper .filters select {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
            background-color: transparent;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }

        .report-wrapper table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        .report-wrapper table th {
            background-color: transparent;
            border: none;
            border-top: 1px solid #999;
            border-bottom: 1px solid #999;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        .report-wrapper table td {
            border: none;
            border-bottom: 1px solid #eee;
            padding: 7px 8px;
            font-size: 13px;
        }

        .report-wrapper .res-number {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .report-wrapper .user-cell {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .report-wrapper .rate-cell {
            text-align: left;
        }

        .report-wrapper .footer-row td {
            border-top: 2px solid #999;
            border-bottom: 2px solid #999;
            font-weight: bold;
            background-color: #f9f9f9;
        }

        .report-wrapper .no-data {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        @media print {
            .report-wrapper {
                padding: 0;
            }
            .report-wrapper .container {
                border: none;
                max-width: 100%;
            }
        }
    </style>
</head>
<body>
    <div class="report-wrapper">
        <div class="container">
            <div class="header">
                <div class="hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
                <div class="report-title">Departure List</div>
            </div>

            <div class="filters">
                <label>Departure From</label>
                <input type="text" value="${filters.startDate ? formatDate(filters.startDate) : 'N/A'}" readonly>
                <label>To</label>
                <input type="text" value="${filters.endDate ? formatDate(filters.endDate) : 'N/A'}" readonly>
                <label>Order By</label>
                <select disabled>
                    <option>Room</option>
                </select>
                <label>Tax Inclusive</label>
                <select disabled>
                    <option>${filters.taxInclusive ? 'Yes' : 'No'}</option>
                </select>
            </div>

            ${data.length > 0 ? `
            <table>
                <thead>
                    <tr>${tableHeaders}</tr>
                </thead>
                <tbody>
                    ${tableRows}
                    <tr class="footer-row">
                        <td colspan="2"><strong>Total Reservations</strong></td>
                        <td><strong>#(${summary.totalReservations || 0})</strong></td>
                        <td colspan="${columns.length - 3}"><strong>Total Pax: ${summary.totalPax || 0}</strong></td>
                    </tr>
                </tbody>
            </table>
            ` : `
            <div class="no-data">
                No data matches the selected filters
            </div>
            `}
        </div>
    </div>
</body>
</html>
    `
}

  // Génère un rapport HTML pour les réservations annulées
  static generateCancelledReservationsHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'resNo', label: 'Res. No' },
        { key: 'bookingDate', label: 'Booking Date' },
        { key: 'guest', label: 'Guest' },
        { key: 'rateType', label: 'Rate Type' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'departure', label: 'Departure' },
        { key: 'folioNo', label: 'Folio No' },
        { key: 'adr', label: 'ADR' },
        { key: 'charges', label: 'Charges' },
        { key: 'paid', label: 'Paid' },
        { key: 'balance', label: 'Balance' },
        { key: 'source', label: 'Source' },
        { key: 'cancelledBy', label: 'Cancelled By' },
        { key: 'cancelledDate', label: 'Cancelled Date' }
    ]

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    let tableRows = ''
    data.forEach((item, index) => {
        const cells = columns.map(column => {
            const value = item[column.key] || '-'
            return `<td>${value}</td>`
        })
        tableRows += `<tr>${cells.join('')}</tr>`

        if (item.remarks) {
            tableRows += `<tr class="remark-row">
                <td colspan="${columns.length}" class="remark-cell">Remarks: ${item.remarks}</td>
            </tr>`
        }
    })



    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data[0]?.hotelName || 'Hotel'} - Cancelled Reservations</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            background-color: white;
            border: 2px solid #666;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #999;
        }

        .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color: rgb(10, 5, 144); /* BLEU */
        }

        .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #800000; /* ROUGE BORDEAU */
            text-align: right;
        }

        .cancelled-btn {
            border: 2px solid #c00;
            background: white;
            color: #c00;
            padding: 8px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }

        .filters {
            display: flex;
            gap: 0px;
            align-items: center;
            margin-bottom: 20px;
            font-size: 13px;
            padding-left: 0;
        }

        .filters label {
            font-weight: bold;
        }

        .filters input {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
        }

        .filters select {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
            background-color: transparent;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        table th {
            background-color: transparent;
            border: none;
            border-top: 1px solid #999;
            border-bottom: 1px solid #999;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        table td {
            border: none;
            border-bottom: 1px solid #999;
            padding: 8px;
            font-size: 13px;
        }

        .remark-row {
            background-color: #f9f9f9;
        }

        .remark-cell {
            color: #666;
            font-style: italic;
            padding-left: 24px !important;
        }

        .footer-row {
            background-color: #fff;
            font-weight: bold;
        }

        .no-data {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        @media print {
            body {
                background-color: white;
                padding: 0;
            }

            .container {
                border: none;
                max-width: 100%;
            }

            .cancelled-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
            <div class="report-title">Cancelled Reservations</div>
        </div>

        <div class="filters">
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'Hotel'}" readonly>
            <label>Cancellation From</label>
            <input type="text" value="${filters.startDate}" readonly>
            <label>To</label>
            <input type="text" value="${filters.endDate }" readonly>
            <label>Order By</label>
            <select disabled>
                <option>Room</option>
            </select>
            <label>Tax Inclusive</label>
            <select disabled>
                <option>${filters.taxInclusive ? 'Yes' : 'No'}</option>
            </select>
        </div>

        ${data.length > 0 ? `
        <table>
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr class="footer-row">
                    <td colspan="7"><strong>Total Cancelled: ${summary.totalCancelled || 0}</strong></td>
                    <td><strong>${summary.totalADR ? summary.totalADR : 0}</strong></td>
                    <td><strong>${summary.totalCharges ? summary.totalCharges : 0}</strong></td>
                    <td><strong>${summary.totalPaid ? summary.totalPaid : 0}</strong></td>
                    <td colspan="4"><strong>${summary.totalBalance ? summary.totalBalance : 0}</strong></td>
                </tr>
            </tbody>
        </table>
        ` : `
        <div class="no-data">
            No data matches the selected filters
        </div>
        `}
    </div>
</body>
</html>
    `
  }

  // Génère un rapport HTML pour les réservations Void
  static generateVoidReservationsHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'resNo', label: 'Res. No' },
        { key: 'bookingDate', label: 'Booking Date' },
        { key: 'guest', label: 'Guest' },
        { key: 'rateType', label: 'Rate Type' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'departure', label: 'Departure' },
        { key: 'folioNo', label: 'Folio No' },
        { key: 'adr', label: 'ADR' },
        { key: 'charges', label: 'Charges' },
        { key: 'paid', label: 'Paid' },
        { key: 'balance', label: 'Balance' },
        { key: 'source', label: 'Source' },
        // FIX #1 : clés alignées avec le frontend (cancelledBy / cancelledDate)
        { key: 'voidBy', label: 'Voided By' },
        { key: 'voidDate', label: 'Voided Date' }
    ]

    const tableHeaders = columns.map(column => `<th class="vr-th">${column.label}</th>`).join('')

    let tableRows = ''
    data.forEach((item) => {
        const cells = columns.map(column => {
            const value = item[column.key] || '-'
            return `<td class="vr-td">${value}</td>`
        })
        tableRows += `<tr class="vr-tr">${cells.join('')}</tr>`

        if (item.remarks) {
            tableRows += `<tr class="vr-tr vr-remark-row">
                <td colspan="${columns.length}" class="vr-td vr-remark-cell">Remarks: ${item.remarks}</td>
            </tr>`
        }
    })

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromFormat(dateString, 'dd/MM/yyyy').toFormat('dd/MM/yyyy')
        } catch {
            return dateString
        }
    }

    return `
<style>
  /* ── Void Reservations report styles (scoped avec préfixe vr-) ── */
  .vr-wrapper {
    font-family: Arial, sans-serif;
    font-size: 13px;
    width: 100%;
  }

  /* Header : hotel name + titre */
  .vr-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 16px;
    border-bottom: 1px solid #d1d5db; /* gray-300 */
  }

  /* FIX #4 : remplace rgb(10,5,144) par une variable CSS compatible dark mode */
  .vr-hotel-name {
    font-size: 20px;
    font-weight: bold;
    color: #1e3a8a; /* blue-900, lisible en light */
  }

  /* FIX #4 : remplace #800000 par une variable CSS */
  .vr-report-title {
    font-size: 20px;
    font-weight: bold;
    color: #991b1b; /* red-800, lisible en light */
    text-align: right;
  }

  /* Ligne de filtres */
  .vr-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
    font-size: 12px;
    color: #374151; /* gray-700 */
  }

  .vr-filters label {
    font-weight: bold;
    color: #374151;
  }

  .vr-filters span {
    color: #4b5563;
  }

  /* Table */
  .vr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }

  .vr-th {
    background-color: transparent;
    border-top: 1px solid #d1d5db;
    border-bottom: 1px solid #d1d5db;
    padding: 8px 6px;
    text-align: left;
    font-weight: bold;
    font-size: 11px;
    color: #374151;
    white-space: nowrap;
  }

  .vr-td {
    border-bottom: 1px solid #e5e7eb;
    padding: 7px 6px;
    font-size: 12px;
    color: #111827;
  }

  .vr-tr:hover .vr-td {
    background-color: #f9fafb;
  }

  /* FIX #6 : remark row cohérente avec le front */
  .vr-remark-row .vr-td {
    background-color: #f9fafb;
    color: #6b7280;
    font-style: italic;
    padding-left: 20px;
  }

  /* Footer totaux */
  .vr-footer-td {
    border-top: 2px solid #d1d5db;
    border-bottom: none;
    padding: 8px 6px;
    font-weight: bold;
    font-size: 12px;
    color: #111827;
  }

  /* FIX #5 : dark mode — les couleurs s'adaptent via media query */
  @media (prefers-color-scheme: dark) {
    .vr-hotel-name   { color: #93c5fd; } /* blue-300 */
    .vr-report-title { color: #fca5a5; } /* red-300 */
    .vr-filters,
    .vr-filters label,
    .vr-filters span { color: #d1d5db; }
    .vr-th           { color: #d1d5db; border-color: #4b5563; }
    .vr-td           { color: #f3f4f6; border-color: #374151; }
    .vr-tr:hover .vr-td   { background-color: #1f2937; }
    .vr-remark-row .vr-td { background-color: #1f2937; color: #9ca3af; }
    .vr-footer-td    { color: #f9fafb; border-color: #4b5563; }
    .vr-header       { border-color: #4b5563; }
  }
</style>

<div class="vr-wrapper">
  <div class="vr-header">
    <div class="vr-hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
    <div class="vr-report-title">Void Reservations</div>
  </div>

  <div class="vr-filters">
    <label>Hotel</label>
    <span>${data[0]?.hotelName || 'Hotel'}</span>
    <label>Void From</label>
    <span>${filters.startDate }</span>
    <label>To</label>
    <span>${filters.endDate}</span>
    <label>Order By</label>
    <span>Room</span>
    <label>Tax Inclusive</label>
    <span>${filters.taxInclusive ? 'Yes' : 'No'}</span>
  </div>

  ${data.length > 0 ? `
  <table class="vr-table">
    <thead>
      <tr>${tableHeaders}</tr>
    </thead>
    <tbody>
      ${tableRows}
      <tr>
        <td colspan="7" class="vr-footer-td">Total Void: ${summary.totalCancelled || 0}</td>
        <td class="vr-footer-td">${summary.totalADR ? Number(summary.totalADR) : 0}</td>
        <td class="vr-footer-td">${summary.totalCharges ? Number(summary.totalCharges) : 0 }</td>
        <td class="vr-footer-td">${summary.totalPaid ? Number(summary.totalPaid) : 0 }</td>
        <td colspan="4" class="vr-footer-td">${summary.totalBalance ? Number(summary.totalBalance) : 0 }</td>
      </tr>
    </tbody>
  </table>
  ` : `
  <div style="padding: 32px; text-align: center; color: #6b7280; font-size: 14px;">
    No data matches the selected filters
  </div>
  `}
</div>
    `
  }

  // Génère un rapport HTML pour les clients sortis (Checked Out)
  static generateGuestCheckedOutHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'resNo', label: 'Res. No' },
        { key: 'guest', label: 'Guest' },
        { key: 'room', label: 'Room' },
        { key: 'rate', label: 'Rate<br>(Rs)' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'departure', label: 'Departure' },
        { key: 'pax', label: 'Pax' },
        { key: 'BusiSour', label: 'Business Source' },
        { key: 'restyp', label: 'Res.Type' },
        { key: 'user', label: 'User' }
    ]

    if (filters.selectedColumns && filters.selectedColumns.length > 0) {
        filters.selectedColumns.forEach(column => {
            columns.push({
                key: column.toLowerCase().replace(/\s+/g, '').replace('.', ''),
                label: column
            })
        })
    }

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    let tableRows = ''
    data.forEach((item, index) => {
        const cells = columns.map(column => {
            const value = item[column.key] || '-'
            const cellClass = column.key === 'user' ? ' class="user-cell"' : ''
            const alignClass = column.key === 'rate' ? ' class="rate-cell"' : ''
            return `<td${cellClass}${alignClass}>${value}</td>`
        })
        tableRows += `<tr>${cells.join('')}</tr>`
    })

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromISO(dateString).toFormat('dd/MM/yyyy')
        } catch {
            return dateString
        }
    }

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data[0]?.hotelName || 'Hotel'} - Guest Checked Out</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            background-color: white;
            border: 2px solid #666;
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #999;
        }

        .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color: rgb(10, 5, 144); /* BLEU */
        }

        .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #800000; /* ROUGE BORDEAU */
            text-align: right;
        }

        .checkout-btn {
            border: 2px solid #c00;
            background: white;
            color: #c00;
            padding: 8px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }

        .filters {
            display: flex;
            gap: 0px;
            align-items: center;
            margin-bottom: 20px;
            font-size: 13px;
            padding-left: 0;
        }

        .filters label {
            font-weight: bold;
        }

        .filters input {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
        }

        .filters select {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
            background-color: transparent;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        table th {
            background-color: transparent;
            border: none;
            border-top: 1px solid #999;
            border-bottom: 1px solid #999;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        table td {
            border: none;
            border-bottom: 1px solid #999;
            padding: 8px;
            font-size: 13px;
        }

        .user-cell {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .rate-cell {
            text-align: right;
        }

        .footer-row {
            background-color: #fff;
            font-weight: bold;
        }

        .no-data {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        @media print {
            body {
                background-color: white;
                padding: 0;
            }

            .container {
                border: none;
                max-width: 100%;
            }

            .checkout-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
            <div class="report-title">Guest Checked Out</div>
        </div>

        <div class="filters">
            <label>From</label>
            <input type="text" value="${filters.startDate}" readonly>
            <label>To</label>
            <input type="text" value="${filters.endDate}"readonly>
        </div>

        ${data.length > 0 ? `
        <table>
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr class="footer-row">
                    <td colspan="2"><strong>Total Reservations</strong></td>
                    <td><strong>#(${summary.totalReservations || 0})</strong></td>
                    <td colspan="2"><strong>Total Pax: ${summary.totalPax || 0}</strong></td>
                    <td colspan="2"><strong>Revenue: ${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="${columns.length - 7}"><strong>Avg. Rate: ${summary.averageRate ? Number(summary.averageRate).toFixed(2) : '0.00'}</strong></td>
                </tr>
            </tbody>
        </table>
        ` : `
        <div class="no-data">
            No data matches the selected filters
        </div>
        `}
    </div>
</body>
</html>
    `
  }

  // Génère un rapport HTML pour les clients enregistrés (Checked In)
  static generateGuestCheckedInHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'resNo', label: 'Res. No' },
        { key: 'guest', label: 'Guest' },
        { key: 'room', label: 'Room' },
        { key: 'rate', label: 'Rate<br>(Rs)' },
        { key: 'arrival', label: 'Arrival' },
        { key: 'departure', label: 'Departure' },
        { key: 'pax', label: 'Pax' },
        { key: 'BusiSour', label: 'Business Source' },
        { key: 'restyp', label: 'Res.Type' },
        { key: 'user', label: 'User' }
    ]

    if (filters.selectedColumns && filters.selectedColumns.length > 0) {
        filters.selectedColumns.forEach(column => {
            columns.push({
                key: column.toLowerCase().replace(/\s+/g, '').replace('.', ''),
                label: column
            })
        })
    }

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    let tableRows = ''
    data.forEach((item) => {
        const cells = columns.map(column => {
            const value = item[column.key] || '-'
            const classes = []
            if (column.key === 'user') classes.push('user-cell')
            if (column.key === 'rate') classes.push('rate-cell')
            const classAttr = classes.length ? ` class="${classes.join(' ')}"` : ''
            return `<td${classAttr}>${value}</td>`
        })
        tableRows += `<tr>${cells.join('')}</tr>`
    })

    const hotelName = data[0]?.hotelName || 'Hotel'

    return `
<style>
    .report-container {
        font-family: Arial, sans-serif;
        background-color: #ffffff;
        border: 2px solid #666;
        padding: 20px;
        max-width: 100%;
        box-sizing: border-box;
    }

    .report-container * {
        box-sizing: border-box;
    }

    .report-container .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 20px;
        border-bottom: 1px solid #999;
    }

    .report-container .hotel-name {
        font-size: 24px;
        font-weight: bold;
        color: rgb(10, 5, 144);
    }

    .report-container .report-title {
        font-size: 24px;
        font-weight: bold;
        color: #800000;
        text-align: right;
    }

    .report-container .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 20px;
        font-size: 13px;
    }

    .report-container .filters label {
        font-weight: bold;
    }

    .report-container .filters input,
    .report-container .filters select {
        border: none;
        padding: 4px 8px;
        font-size: 13px;
        background-color: transparent;
    }

    .report-container table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
    }

    .report-container table th {
        border: none;
        border-top: 1px solid #999;
        border-bottom: 1px solid #999;
        padding: 8px;
        text-align: left;
        font-weight: bold;
        font-size: 12px;
        white-space: nowrap;
    }

    .report-container table td {
        border: none;
        border-bottom: 1px solid #ddd;
        padding: 8px;
        font-size: 13px;
    }

    .report-container table tr:hover td {
        background-color: #f9f9f9;
    }

    .report-container .user-cell {
        color: #000;
        text-decoration: none;
        cursor: default;
    }

    .report-container .rate-cell {
        text-align: right;
    }

    .report-container .footer-row td {
        font-weight: bold;
        border-top: 2px solid #999;
        border-bottom: 2px solid #999;
        padding: 10px 8px;
    }

    .report-container .no-data {
        padding: 40px 20px;
        text-align: center;
        color: #666;
        font-size: 14px;
    }

    .report-container .generated-info {
        margin-top: 16px;
        font-size: 11px;
        color: #999;
        text-align: right;
    }

    @media print {
        .report-container {
            border: none;
            padding: 0;
        }
    }
</style>

<div class="report-container">
    <div class="header">
        <div class="hotel-name">${hotelName}</div>
        <div class="report-title">Guest Checked In</div>
    </div>

    <div class="filters">
        <label>Hotel:</label>
        <input type="text" value="${hotelName}" readonly>
        <label>Checked-in From:</label>
        <input type="text" value="${filters.arrivalFrom || 'N/A'}" readonly>
        <label>To:</label>
        <input type="text" value="${filters.arrivalTo || 'N/A'}" readonly>
    </div>

    ${data.length > 0 ? `
    <table>
        <thead>
            <tr>${tableHeaders}</tr>
        </thead>
        <tbody>
            ${tableRows}
            <tr class="footer-row">
                <td colspan="2">Total Reservations</td>
                <td>#(${summary.totalReservations || 0})</td>
                <td colspan="2">Total Pax: ${summary.totalPax || 0}</td>
                <td colspan="2">Revenue: ${summary.totalRevenue ? Number(summary.totalRevenue) : 0 }</td>
                <td colspan="${columns.length - 7}">Avg. Rate: ${summary.averageRate ? Number(summary.averageRate) : 0 }</td>
            </tr>
        </tbody>
    </table>
    ` : `
    <div class="no-data">
        No data matches the selected filters
    </div>
    `}

    <div class="generated-info">
        Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm')} | ${summary.totalReservations || 0} records
    </div>
</div>
    `
}

  static generateNoShowReservationsHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const columns = [
        { key: 'reservationNumber', label: 'Res. No' },
        { key: 'guestName', label: 'Guest' },
        { key: 'guestPhone', label: 'Phone' },
        { key: 'roomType', label: 'Room Type' },
        { key: 'roomNumber', label: 'Room' },
        { key: 'arrivalDate', label: 'Arrival' },
        { key: 'departureDate', label: 'Departure' },
        { key: 'nights', label: 'Nights' },
        { key: 'totalPax', label: 'Pax' },
        { key: 'lostRevenue', label: 'Lost Revenue' },
        { key: 'businessSource', label: 'Business Source' },
        { key: 'reservationType', label: 'Res.Type' },
        { key: 'isGuaranteed', label: 'Guaranteed' },
        { key: 'createdBy', label: 'User' }
    ]

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    let tableRows = ''
    data.forEach((item, index) => {
        const cells = columns.map(column => {
            let value = item[column.key] || '-'

            // Formater les valeurs spécifiques
            if (column.key === 'lostRevenue') {
                value = Number(value || 0).toFixed(2)
            } else if (column.key === 'isGuaranteed') {
                value = value ? 'Yes' : 'No'
            } else if (column.key === 'nights') {
                value = Math.round(value || 0)
            }

            const cellClass = column.key === 'createdBy' ? ' class="user-cell"' : ''
            const alignClass = column.key === 'lostRevenue' ? ' class="rate-cell"' : ''
            return `<td${cellClass}${alignClass}>${value}</td>`
        })
        tableRows += `<tr>${cells.join('')}</tr>`

        // Ajouter une ligne pour les remarques si présentes
        if (item.noShowReason) {
            tableRows += `<tr class="remark-row">
                <td colspan="${columns.length}" class="remark-cell">Reason: ${item.noShowReason}</td>
            </tr>`
        }
    })

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromISO(dateString).toFormat('dd/MM/yyyy')
        } catch {
            return dateString
        }
    }

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${data[0]?.hotelName || 'Hotel'} - No-Show Reservations</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }

        .container {
            background-color: white;
            border: 2px solid #666;
            padding: 20px;
            max-width: 1600px;
            margin: 0 auto;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px solid #999;
        }

        .hotel-name {
            font-size: 24px;
            font-weight: bold;
            color: rgb(10, 5, 144); /* BLEU */
        }

        .report-title {
            font-size: 24px;
            font-weight: bold;
            color: #800000; /* ROUGE BORDEAU */
            text-align: right;
        }

        .noshow-btn {
            border: 2px solid #c00;
            background: white;
            color: #c00;
            padding: 8px 20px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            border-radius: 4px;
        }

        .filters {
            display: flex;
            gap: 0px;
            align-items: center;
            margin-bottom: 20px;
            font-size: 13px;
            padding-left: 0;
        }

        .filters label {
            font-weight: bold;
        }

        .filters input {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
        }

        .filters select {
            border: none;
            padding: 4px 8px;
            font-size: 13px;
            background-color: transparent;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }

        table th {
            background-color: transparent;
            border: none;
            border-top: 1px solid #999;
            border-bottom: 1px solid #999;
            padding: 8px;
            text-align: left;
            font-weight: bold;
            font-size: 12px;
        }

        table td {
            border: none;
            border-bottom: 1px solid #999;
            padding: 8px;
            font-size: 13px;
        }

        .user-cell {
            color: #000;
            text-decoration: none;
            cursor: default;
        }

        .rate-cell {
            text-align: right;
        }

        .remark-row {
            background-color: #f9f9f9;
        }

        .remark-cell {
            color: #666;
            font-style: italic;
            padding-left: 24px !important;
        }

        .footer-row {
            background-color: #fff;
            font-weight: bold;
        }

        .no-data {
            padding: 40px 20px;
            text-align: center;
            color: #666;
            font-size: 14px;
        }

        @media print {
            body {
                background-color: white;
                padding: 0;
            }

            .container {
                border: none;
                max-width: 100%;
            }

            .noshow-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="hotel-name">${data[0]?.hotelName || 'Hotel'}</div>
            <div class="report-title">No-Show Reservations</div>
        </div>

        <div class="filters">
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'All Hotels'}" readonly>
            <label>No-Show From</label>
            <input type="text" value="${filters.startDate ? formatDate(filters.startDate) : 'N/A'}" readonly>
            <label>To</label>
            <input type="text" value="${filters.endDate ? formatDate(filters.endDate) : 'N/A'}" readonly>
            <label>Order By</label>
            <select disabled>
                <option>Arrival Date</option>
            </select>
        </div>

        ${data.length > 0 ? `
        <table>
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr class="footer-row">
                    <td colspan="4"><strong>Total No-Shows: ${summary.totalNoShows || 0}</strong></td>
                    <td colspan="3"><strong>Guaranteed: ${summary.guaranteedNoShows || 0}</strong></td>
                    <td colspan="2"><strong>Total Nights: ${summary.totalNights || 0}</strong></td>
                    <td><strong>${summary.totalRevenueLost ? Number(summary.totalRevenueLost).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="${columns.length - 10}"><strong>Total Pax: ${summary.totalAdults || 0}/${summary.totalChildren || 0}</strong></td>
                </tr>
            </tbody>
        </table>
        ` : `
        <div class="no-data">
            No data matches the selected filters
        </div>
        `}
    </div>
</body>
</html>
    `
  }
}
