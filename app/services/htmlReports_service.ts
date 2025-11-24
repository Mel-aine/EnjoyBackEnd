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
            return Number(value).toFixed(2)
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
            `<td>${item.arrivalDate}${item.arrivalTime ? `<br><span class="time">${item.arrivalTime}</span>` : ''}</td>`,
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
         {
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
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
            text-align: right;
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
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="arrival-btn">Arrival List</button>
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
         {
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
        }

        .departure-btn {
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

            .departure-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="departure-btn">Departure List</button>
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
        { key: 'carRevenue', label: 'Car Revenue' },
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

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromFormat(dateString, 'dd/MM/yyyy').toFormat('dd/MM/yyyy')
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
    <title>${filters.hotelId || 'Hotel'} - Cancelled Reservations</title>
    <style>
        {
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
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
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="cancelled-btn">Cancelled Reservations</button>
        </div>

        <div class="filters">
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'Hotel'}" readonly>
            <label>Cancellation From</label>
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
                    <td colspan="7"><strong>Total Cancelled: ${summary.totalCancelled || 0}</strong></td>
                    <td><strong>${summary.totalADR ? Number(summary.totalADR).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalCarRevenue ? Number(summary.totalCarRevenue).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalCharges ? Number(summary.totalCharges).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalPaid ? Number(summary.totalPaid).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="4"><strong>${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}</strong></td>
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
        { key: 'carRevenue', label: 'Car Revenue' },
        { key: 'charges', label: 'Charges' },
        { key: 'paid', label: 'Paid' },
        { key: 'balance', label: 'Balance' },
        { key: 'source', label: 'Source' },
        { key: 'voidedBy', label: 'Voided By' },
        { key: 'voidedDate', label: 'Voided Date' }
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

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A'
        try {
            return DateTime.fromFormat(dateString, 'dd/MM/yyyy').toFormat('dd/MM/yyyy')
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
    <title>${filters.hotelId || 'Hotel'} - Void Reservations</title>
    <style>
         {
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
        }

        .void-btn {
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

            .void-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="void-btn">Void Reservations</button>
        </div>

        <div class="filters">
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'Hotel'}" readonly>
            <label>Void From</label>
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
                    <td colspan="7"><strong>Total Void: ${summary.totalCancelled || 0}</strong></td>
                    <td><strong>${summary.totalADR ? Number(summary.totalADR).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalCarRevenue ? Number(summary.totalCarRevenue).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalCharges ? Number(summary.totalCharges).toFixed(2) : '0.00'}</strong></td>
                    <td><strong>${summary.totalPaid ? Number(summary.totalPaid).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="4"><strong>${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}</strong></td>
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

// Génère un rapport HTML pour les clients sortis (Checked Out)
static generateGuestCheckedOutHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    const dataFormat = filters.status || 'booking'
    const isFolioFormat = dataFormat === 'folio'

    const columns = isFolioFormat ? [
        { key: 'folioNumber', label: 'Folio No' },
        { key: 'reservationNumber', label: 'Res. No' },
        { key: 'guestName', label: 'Guest' },
        { key: 'roomNumbers', label: 'Room' },
        { key: 'checkoutDate', label: 'Check-out' },
        { key: 'totalCharges', label: 'Charges' },
        { key: 'totalPayments', label: 'Payments' },
        { key: 'balance', label: 'Balance' },
        { key: 'paymentStatus', label: 'Status' },
        { key: 'folioType', label: 'Folio Type' }
    ] : [
        { key: 'reservationNumber', label: 'Res. No' },
        { key: 'guestName', label: 'Guest' },
        { key: 'roomNumbers', label: 'Room' },
        { key: 'roomType', label: 'Room Type' },
        { key: 'checkinDate', label: 'Check-in' },
        { key: 'checkoutDate', label: 'Check-out' },
        { key: 'actualNights', label: 'Nights' },
        { key: 'totalCharges', label: 'Charges' },
        { key: 'totalPayments', label: 'Payments' },
        { key: 'balance', label: 'Balance' },
        { key: 'paymentStatus', label: 'Status' }
    ]

    const tableHeaders = columns.map(column => `<th>${column.label}</th>`).join('')

    const tableRows = data.map((item, index) => {
        const cells = columns.map(column => {
            let value = item[column.key] || '-'
            
            if (['totalCharges', 'totalPayments', 'balance', 'roomRate', 'actualNights'].includes(column.key)) {
                if (column.key === 'actualNights') {
                    value = Math.round(value)
                } else {
                    value = Number(value).toFixed(2)
                }
            }
            
            return `<td>${value}</td>`
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
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
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="checkout-btn">Guest Checked Out</button>
        </div>

        <div class="filters">
            <label>Data Format</label>
            <select disabled>
                <option>${isFolioFormat ? 'By Folio' : 'By Booking'}</option>
            </select>
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'All Hotels'}" readonly>
            <label>Check-out From</label>
            <input type="text" value="${filters.startDate ? formatDate(filters.startDate) : 'N/A'}" readonly>
            <label>To</label>
            <input type="text" value="${filters.endDate ? formatDate(filters.endDate) : 'N/A'}" readonly>
        </div>

        ${data.length > 0 ? `
        <table>
            <thead>
                <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
                ${tableRows}
                <tr class="footer-row">
                    <td colspan="3"><strong>${isFolioFormat ? `Total Folios: ${summary.totalFolios}` : `Total Checked Out: ${summary.totalCheckedOut}`}</strong></td>
                    <td colspan="3"><strong>Total Revenue: ${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="2"><strong>Payments: ${summary.totalPayments ? Number(summary.totalPayments).toFixed(2) : '0.00'}</strong></td>
                    <td colspan="${columns.length - 8}"><strong>Outstanding: ${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}</strong></td>
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
            return DateTime.fromFormat(dateString, 'dd/MM/yyyy').toFormat('dd/MM/yyyy')
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
    <title>${data[0]?.hotelName || 'Hotel'} - Guest Checked In</title>
    <style>
         {
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
        }

        .checkin-btn {
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

            .checkin-btn {
                display: none;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${data[0]?.hotelName || 'Hotel`'}</h1>
            <button class="checkin-btn">Guest Checked In</button>
        </div>

        <div class="filters">
            <label>Hotel</label>
            <input type="text" value="${data[0]?.hotelName || 'Hotel'}" readonly>
            <label>Checked-in From</label>
            <input type="text" value="${filters.arrivalFrom ? formatDate(filters.arrivalFrom) : 'N/A'}" readonly>
            <label>To</label>
            <input type="text" value="${filters.arrivalTo ? formatDate(filters.arrivalTo) : 'N/A'}" readonly>
            <label>Order By</label>
            <select disabled>
                <option>Room</option>
            </select>
            <label>Tax Inclusive</label>
            <select disabled>
                <option>${filters.taxInclusive ? 'Yes' : 'No'}</option>
            </select>
            <label>Direct Check-in</label>
            <select disabled>
                <option>${filters.checkin ? 'Yes' : 'No'}</option>
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

        .header h1 {
            font-size: 24px;
            font-weight: bold;
            color: #000;
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
            <h1>${data[0]?.hotelName || 'Hotel'}</h1>
            <button class="noshow-btn">No-Show Reservations</button>
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
