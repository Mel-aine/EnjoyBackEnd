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
            return Number(value).toFixed(2)
          }
          
          return value.toString()
        }
    
        // Formater les dates avec heure pour l'arrivée
        const formatArrivalDate = (dateString: string, timeString: string) => {
          if (!dateString) return ''
          const time = timeString || '12:00 PM'
          return `${dateString}<br><span class="time">${time}</span>`
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
            // Appliquer la classe user-cell pour la colonne User
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
        <title>${data[0].hotelName} - Arrival List</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
    
            @page {
                margin: 20mm 15mm;
                @top-center {
                    content: element(pageHeader);
                }
                @bottom-center {
                    content: element(pageFooter);
                }
            }
    
            body {
                font-family: Arial, sans-serif;
                padding: 20px;
                background-color: #f5f5f5;
            }
    
            .page-header {
                position: running(pageHeader);
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-bottom: 1px solid #999;
                margin-bottom: 20px;
            }
    
            .page-footer {
                position: running(pageFooter);
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 0;
                border-top: 1px solid #999;
                margin-top: 20px;
                font-size: 12px;
                color: #666;
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
                gap: 10px;
                align-items: center;
                margin-bottom: 20px;
                font-size: 13px;
                flex-wrap: wrap;
            }
    
            .filters label {
                font-weight: bold;
            }
    
            .filters input,
            .filters select {
                border: none;
                padding: 4px 8px;
                font-size: 13px;
                background-color: transparent;
            }
    
            .filters select {
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
                text-align: center;
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
    
                @page {
                    margin: 20mm 15mm;
                }
    
                .page-break {
                    page-break-after: always;
                }
            }
        </style>
    </head>
    <body>
        <!-- Header pour l'impression -->
        <div class="page-header">
            <h1 style="font-size: 18px; margin: 0;">${data[0].hotelName || 'Hotel Nihal'}</h1>
            <div style="font-weight: bold;">Arrival List</div>
        </div>
    
        <!-- Footer pour l'impression -->
    
        <div class="container">
    
            <div class="filters">
                <label>Date From</label>
                <input type="text" value="${filters.startDate ? formatDate(filters.startDate) : 'N/A'}" readonly>
                <label>To</label>
                <input type="text" value="${filters.endDate ? formatDate(filters.endDate) : 'N/A'}" readonly>
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
    
        <script>
            // Pagination pour l'impression
            window.addEventListener('load', function() {
                const pageNumbers = document.querySelectorAll('.page-number');
                const pageCounts = document.querySelectorAll('.page-count');
                
                pageNumbers.forEach(el => el.textContent = '1');
                pageCounts.forEach(el => el.textContent = '1');
            });
    
            // Gestion de l'impression avec pagination
            window.addEventListener('beforeprint', function() {
                // Le navigateur gère automatiquement la pagination
                // On peut ajouter des sauts de page personnalisés si nécessaire
            });
        <\/script>
    </body>
    </html>
        `
      }
   //Génère un prapport HTML pour la liste de depart
  static generateDepartureListHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    // Colonnes à afficher (basées sur le template Vue.js)
    const columns = [
      { key: 'resNo', label: 'Res. No' },
      { key: 'guest', label: 'Guest' },
      { key: 'room', label: 'Room' },
      { key: 'rate', label: 'Rate' },
      { key: 'arrival', label: 'Arrival' },
      { key: 'departure', label: 'Departure' },
      { key: 'pax', label: 'Pax' },
      { key: 'BusiSour', label: 'Business Source' },
      { key: 'restyp', label: 'Res.Type' },
      { key: 'user', label: 'User' }
    ]

    // Générer les en-têtes du tableau
    const tableHeaders = columns.map(column => 
      `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
    ).join('')

    // Générer les lignes du tableau
    const tableRows = data.map((item, index) => {
      const cells = columns.map(column => {
        const value = item[column.key] || '-'
        return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
      })

      const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'
      return `<tr class="${rowClass} hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${cells.join('')}</tr>`
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

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Departure List Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8fafc; 
            color: #1f2937; 
        }
        
        .report-container { 
            max-width: 100%; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .dark .report-container {
            background-color: #1f2937;
            color: #e5e7eb;
        }
        
        .report-header { 
            padding: 20px 24px; 
            background-color: white;
        }
        
        .dark .report-header {
            background-color: #1f2937;
        }
        
        .report-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 8px; 
        }
        
        .dark .report-title {
            color: #f9fafb;
        }
        
        .report-subtitle { 
            font-size: 14px; 
            color: #6b7280; 
        }
        
        .dark .report-subtitle {
            color: #9ca3af;
        }
        
        .filters-info { 
            padding: 16px 24px; 
            background-color: #f8fafc; 
            font-size: 14px; 
            color: #6b7280; 
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .filters-info {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .filters-info span { 
            margin-right: 16px; 
        }
        
        .results-section { 
            background-color: white;
        }
        
        .dark .results-section {
            background-color: #1f2937;
        }
        
        .results-header { 
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .results-header {
            border-color: #4b5563;
        }
        
        .results-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin: 0;
        }
        
        .dark .results-title {
            color: #f9fafb;
        }
        
        .results-meta { 
            font-size: 12px; 
            color: #6b7280; 
            margin-top: 4px;
        }
        
        .dark .results-meta {
            color: #9ca3af;
        }
        
        .table-container {
            background-color: white;
            overflow-x: auto;
        }
        
        .dark .table-container {
            background-color: #1f2937;
        }
        
        .results-table { 
            width: 100%; 
            border-collapse: separate;
            border-spacing: 0;
            font-size: 14px; 
        }
        
        .results-table th { 
            background-color: #f9fafb; 
            padding: 12px 16px; 
            text-align: left; 
            font-weight: 500; 
            color: #6b7280; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
        }
        
        .dark .results-table th {
            background-color: #374151;
            color: #9ca3af;
        }
        
        .results-table td { 
            padding: 16px; 
            font-size: 14px; 
            white-space: nowrap;
        }
        
        .dark .results-table td {
            color: #e5e7eb;
        }
        
        .results-table tr:hover { 
            background-color: #f0f9ff !important; 
        }
        
        .dark .results-table tr:hover {
            background-color: #374151 !important;
        }
        
        .results-footer { 
            padding: 20px 24px; 
            background-color: #f9fafb; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            font-weight: 500; 
            color: #374151; 
        }
        
        .dark .results-footer {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .summary-stats { 
            display: flex; 
            gap: 20px; 
            margin-top: 12px; 
            flex-wrap: wrap; 
        }
        
        .summary-stat { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-width: 80px; 
        }
        
        .stat-value { 
            font-size: 14px; 
            font-weight: 600; 
            color: #3b82f6; 
        }
        
        .dark .stat-value {
            color: #60a5fa;
        }
        
        .stat-label { 
            font-size: 12px; 
            color: #6b7280; 
        }
        
        .dark .stat-label {
            color: #9ca3af;
        }
        
        .report-meta { 
            margin-top: 20px; 
            padding-top: 16px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280; 
            text-align: center; 
        }
        
        .dark .report-meta {
            border-color: #4b5563;
            color: #9ca3af;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .report-container {
                border-radius: 0;
            }
            
            .results-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .summary-stat {
                min-width: 60px;
            }
            
            .filters-info span {
                display: block;
                margin-bottom: 8px;
                margin-right: 0;
            }
            
            .results-table th,
            .results-table td {
                padding: 8px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">Departure List Report</h1>
            <p class="report-subtitle">View and manage departing guest reservations</p>
        </div>
        
        <div class="filters-info">
            <span><strong>Departure From:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} <strong>To:</strong> ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
            <span><strong>Order By:</strong> Room</span>
            <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
        </div>
        
        <div class="results-section">
            <div class="table-container">
                <table class="results-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            
            <div class="results-footer">
                <div style="margin-bottom: 8px;">
                    <span>Total Reservations: ${summary.totalReservations || 0} • Total Pax: ${summary.totalPax || 0}</span>
                </div>
            </div>
            
            <div class="report-meta">
                <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} records</p>
            </div>
        </div>
    </div>

    <script>
        // Script pour détecter le mode sombre du système
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark');
        }
        
        // Écouter les changements de mode sombre
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        });
    <\/script>
</body>
</html>
    `
  }
  //Génère un prapport HTML pour la iste des reservations annulées
  static generateCancelledReservationsHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
  // Colonnes à afficher
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

  // Générer les en-têtes du tableau
  const tableHeaders = columns.map(column => 
    `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
  ).join('')

  // Générer les lignes du tableau avec les remarques
  let tableRows = ''
  data.forEach((item, index) => {
    const cells = columns.map(column => {
      const value = item[column.key] || '-'
      return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
    })

    tableRows += `<tr class="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${cells.join('')}</tr>`
    
    // Ajouter la ligne de remarques si elle existe
    if (item.remarks) {
      tableRows += `<tr class="remark-row">
        <td colspan="${columns.length}" class="remark-cell">Remarks: ${item.remarks}</td>
      </tr>`
    }
  })

  // Formater les dates pour l'affichage des filtres
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
    <title>Cancelled Reservations Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8fafc; 
            color: #1f2937; 
        }
        
        .report-container { 
            max-width: 100%; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .dark .report-container {
            background-color: #1f2937;
            color: #e5e7eb;
        }
        
        .report-header { 
            padding: 20px 24px; 
            background-color: white;
        }
        
        .dark .report-header {
            background-color: #1f2937;
        }
        
        .report-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 8px; 
        }
        
        .dark .report-title {
            color: #f9fafb;
        }
        
        .report-subtitle { 
            font-size: 14px; 
            color: #6b7280; 
        }
        
        .dark .report-subtitle {
            color: #9ca3af;
        }
        
        .filters-info { 
            padding: 16px 24px; 
            background-color: #f8fafc; 
            font-size: 14px; 
            color: #6b7280; 
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .filters-info {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .filters-info span { 
            margin-right: 16px; 
        }
        
        .results-section { 
            background-color: white;
        }
        
        .dark .results-section {
            background-color: #1f2937;
        }
        
        .results-header { 
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .results-header {
            border-color: #4b5563;
        }
        
        .results-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin: 0;
        }
        
        .dark .results-title {
            color: #f9fafb;
        }
        
        .results-meta { 
            font-size: 12px; 
            color: #6b7280; 
            margin-top: 4px;
        }
        
        .dark .results-meta {
            color: #9ca3af;
        }
        
        .table-container {
            background-color: white;
            overflow-x: auto;
        }
        
        .dark .table-container {
            background-color: #1f2937;
        }
        
        .results-table { 
            width: 100%; 
            border-collapse: separate;
            border-spacing: 0;
            font-size: 14px; 
        }
        
        .results-table th { 
            background-color: #f9fafb; 
            padding: 12px 16px; 
            text-align: left; 
            font-weight: 500; 
            color: #6b7280; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
        }
        
        .dark .results-table th {
            background-color: #374151;
            color: #9ca3af;
        }
        
        .results-table td { 
            padding: 16px; 
            font-size: 14px; 
            white-space: nowrap;
        }
        
        .dark .results-table td {
            color: #e5e7eb;
        }
        
        .results-table tr:hover { 
            background-color: #f0f9ff !important; 
        }
        
        .dark .results-table tr:hover {
            background-color: #374151 !important;
        }
        
        .results-footer { 
            padding: 20px 24px; 
            background-color: #f9fafb; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            font-weight: 500; 
            color: #374151; 
        }
        
        .dark .results-footer {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .summary-stats { 
            display: flex; 
            gap: 20px; 
            margin-top: 12px; 
            flex-wrap: wrap; 
        }
        
        .summary-stat { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-width: 80px; 
        }
        
        .stat-value { 
            font-size: 14px; 
            font-weight: 600; 
            color: #3b82f6; 
        }
        
        .dark .stat-value {
            color: #60a5fa;
        }
        
        .stat-label { 
            font-size: 12px; 
            color: #6b7280; 
        }
        
        .dark .stat-label {
            color: #9ca3af;
        }
        
        .report-meta { 
            margin-top: 20px; 
            padding-top: 16px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280; 
            text-align: center; 
        }
        
        .dark .report-meta {
            border-color: #4b5563;
            color: #9ca3af;
        }
        
        .remark-row {
            background-color: #f9fafb;
            font-style: italic;
        }
        
        .dark .remark-row {
            background-color: #374151;
        }
        
        .remark-cell {
            color: #6b7280;
            padding-left: 32px !important;
        }
        
        .dark .remark-cell {
            color: #9ca3af;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .report-container {
                border-radius: 0;
            }
            
            .results-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .summary-stat {
                min-width: 60px;
            }
            
            .filters-info span {
                display: block;
                margin-bottom: 8px;
                margin-right: 0;
            }
            
            .results-table th,
            .results-table td {
                padding: 8px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">Cancelled Reservations Report</h1>
            <p class="report-subtitle">View and manage cancelled guest reservations</p>
        </div>
        
        <div class="filters-info">
            <span><strong>Hotel:</strong> ${filters.hotelId || 'Hotel Nihal'}</span>
            <span><strong>Cancellation From:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} <strong>To:</strong> ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
            <span><strong>Order By:</strong> Room</span>
            <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
        </div>
        
        <div class="results-section">
            
            <div class="table-container">
                <table class="results-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            
            <div class="results-footer">
                <div style="margin-bottom: 8px;">
                    <span>Total Cancelled Reservations: ${summary.totalCancelled || 0}</span>
                </div>
                
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalADR ? Number(summary.totalADR).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">ADR</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalCarRevenue ? Number(summary.totalCarRevenue).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Car Revenue</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalCharges ? Number(summary.totalCharges).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Charges</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalPaid ? Number(summary.totalPaid).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Paid</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Balance</span>
                    </div>
                </div>
            </div>
            
            <div class="report-meta">
                <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} records | ${columns.length} columns displayed</p>
            </div>
        </div>
    </div>

    <script>
        // Script pour détecter le mode sombre du système
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark');
        }
        
        // Écouter les changements de mode sombre
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        });
    </script>
</body>
</html>
    `
  }
  //Génère un prapport HTML pour la liste des réservations Null
  static generateVoidReservationsHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
    // Colonnes à afficher
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

    // Générer les en-têtes du tableau
    const tableHeaders = columns.map(column => 
        `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
    ).join('')

    // Générer les lignes du tableau avec les remarques
    let tableRows = ''
    data.forEach((item, index) => {
        const cells = columns.map(column => {
        const value = item[column.key] || '-'
        return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
        })

        tableRows += `<tr class="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${cells.join('')}</tr>`
        
        // Ajouter la ligne de remarques si elle existe
        if (item.remarks) {
        tableRows += `<tr class="remark-row">
            <td colspan="${columns.length}" class="remark-cell">Remarks: ${item.remarks}</td>
        </tr>`
        }
    })

    // Formater les dates pour l'affichage des filtres
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
        <title>Void Reservations Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
        <style>
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background-color: #f8fafc; 
                color: #1f2937; 
            }
            
            .report-container { 
                max-width: 100%; 
                margin: 0 auto; 
                background-color: white; 
                border-radius: 8px; 
                box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                overflow: hidden;
            }
            
            .dark .report-container {
                background-color: #1f2937;
                color: #e5e7eb;
            }
            
            .report-header { 
                padding: 20px 24px; 
                background-color: white;
            }
            
            .dark .report-header {
                background-color: #1f2937;
            }
            
            .report-title { 
                font-size: 24px; 
                font-weight: 600; 
                color: #111827; 
                margin-bottom: 8px; 
            }
            
            .dark .report-title {
                color: #f9fafb;
            }
            
            .report-subtitle { 
                font-size: 14px; 
                color: #6b7280; 
            }
            
            .dark .report-subtitle {
                color: #9ca3af;
            }
            
            .filters-info { 
                padding: 16px 24px; 
                background-color: #f8fafc; 
                font-size: 14px; 
                color: #6b7280; 
                border-top: 1px solid #e5e7eb;
            }
            
            .dark .filters-info {
                background-color: #374151;
                border-color: #4b5563;
                color: #d1d5db;
            }
            
            .filters-info span { 
                margin-right: 16px; 
            }
            
            .results-section { 
                background-color: white;
            }
            
            .dark .results-section {
                background-color: #1f2937;
            }
            
            .results-header { 
                padding: 20px 24px;
                border-top: 1px solid #e5e7eb;
            }
            
            .dark .results-header {
                border-color: #4b5563;
            }
            
            .results-title { 
                font-size: 18px; 
                font-weight: 600; 
                color: #111827; 
                margin: 0;
            }
            
            .dark .results-title {
                color: #f9fafb;
            }
            
            .results-meta { 
                font-size: 12px; 
                color: #6b7280; 
                margin-top: 4px;
            }
            
            .dark .results-meta {
                color: #9ca3af;
            }
            
            .table-container {
                background-color: white;
                overflow-x: auto;
            }
            
            .dark .table-container {
                background-color: #1f2937;
            }
            
            .results-table { 
                width: 100%; 
                border-collapse: separate;
                border-spacing: 0;
                font-size: 14px; 
            }
            
            .results-table th { 
                background-color: #f9fafb; 
                padding: 12px 16px; 
                text-align: left; 
                font-weight: 500; 
                color: #6b7280; 
                font-size: 12px; 
                text-transform: uppercase;
                letter-spacing: 0.05em;
                position: sticky;
                top: 0;
            }
            
            .dark .results-table th {
                background-color: #374151;
                color: #9ca3af;
            }
            
            .results-table td { 
                padding: 16px; 
                font-size: 14px; 
                white-space: nowrap;
            }
            
            .dark .results-table td {
                color: #e5e7eb;
            }
            
            .results-table tr:hover { 
                background-color: #f0f9ff !important; 
            }
            
            .dark .results-table tr:hover {
                background-color: #374151 !important;
            }
            
            .results-footer { 
                padding: 20px 24px; 
                background-color: #f9fafb; 
                border-top: 1px solid 'e5e7eb'; 
                font-size: 14px; 
                font-weight: 500; 
                color: #374151; 
            }
            
            .dark .results-footer {
                background-color: #374151;
                border-color: #4b5563;
                color: #d1d5db;
            }
            
            .summary-stats { 
                display: flex; 
                gap: 20px; 
                margin-top: 12px; 
                flex-wrap: wrap; 
            }
            
            .summary-stat { 
                display: flex; 
                flex-direction: column; 
                align-items: center; 
                min-width: 80px; 
            }
            
            .stat-value { 
                font-size: 14px; 
                font-weight: 600; 
                color: #3b82f6; 
            }
            
            .dark .stat-value {
                color: #60a5fa;
            }
            
            .stat-label { 
                font-size: 12px; 
                color: #6b7280; 
            }
            
            .dark .stat-label {
                color: #9ca3af;
            }
            
            .report-meta { 
                margin-top: 20px; 
                padding-top: 16px; 
                border-top: 1px solid #e5e7eb; 
                font-size: 12px; 
                color: #6b7280; 
                text-align: center; 
            }
            
            .dark .report-meta {
                border-color: #4b5563;
                color: #9ca3af;
            }
            
            .remark-row {
                background-color: #f9fafb;
                font-style: italic;
            }
            
            .dark .remark-row {
                background-color: #374151;
            }
            
            .remark-cell {
                color: #6b7280;
                padding-left: 32px !important;
            }
            
            .dark .remark-cell {
                color: #9ca3af;
            }
            
            /* Responsive design */
            @media (max-width: 768px) {
                body {
                    padding: 10px;
                }
                
                .report-container {
                    border-radius: 0;
                }
                
                .results-header {
                    flex-direction: column;
                    align-items: flex-start;
                    gap: 8px;
                }
                
                .summary-stats {
                    justify-content: center;
                }
                
                .summary-stat {
                    min-width: 60px;
                }
                
                .filters-info span {
                    display: block;
                    margin-bottom: 8px;
                    margin-right: 0;
                }
                
                .results-table th,
                .results-table td {
                    padding: 8px;
                    font-size: 12px;
                }
                
                .results-footer {
                    flex-direction: column;
                    gap: 8px;
                }
            }
        </style>
    </head>
    <body class="bg-gray-50 dark:bg-gray-900">
        <div class="report-container">
            <div class="report-header">
                <h1 class="report-title">Void Reservations Report</h1>
            </div>
            
            <div class="filters-info">
                <span><strong>Hotel:</strong> ${filters.hotelId || 'Hotel Nihal'}</span>
                <span><strong>Void From:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} <strong>To:</strong> ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
                <span><strong>Order By:</strong> Room</span>
                <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
            </div>
            
            <div class="results-section">
                 
                <div class="table-container">
                    <table class="results-table">
                        <thead>
                            <tr>${tableHeaders}</tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
                
                <div class="results-footer">
                    <div style="margin-bottom: 8px;">
                        <span>Total Void Reservations: ${summary.totalCancelled || 0}</span>
                    </div>
                    
                    <div class="summary-stats">
                        <div class="summary-stat">
                            <span class="stat-value">${summary.totalADR ? Number(summary.totalADR).toFixed(2) : '0.00'}</span>
                            <span class="stat-label">ADR</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${summary.totalCarRevenue ? Number(summary.totalCarRevenue).toFixed(2) : '0.00'}</span>
                            <span class="stat-label">Car Revenue</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${summary.totalCharges ? Number(summary.totalCharges).toFixed(2) : '0.00'}</span>
                            <span class="stat-label">Charges</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${summary.totalPaid ? Number(summary.totalPaid).toFixed(2) : '0.00'}</span>
                            <span class="stat-label">Paid</span>
                        </div>
                        <div class="summary-stat">
                            <span class="stat-value">${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}</span>
                            <span class="stat-label">Balance</span>
                        </div>
                    </div>
                </div>
                
                <div class="report-meta">
                    <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} records | ${columns.length} columns displayed</p>
                </div>
            </div>
        </div>

        <script>
            // Script pour détecter le mode sombre du système
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark');
            }
            
            // Écouter les changements de mode sombre
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
                if (e.matches) {
                    document.body.classList.add('dark');
                } else {
                    document.body.classList.remove('dark');
                }
            });
        </script>
    </body>
    </html>
        `
  }

  //Generé un rapport pour la liste des reservation checked out
  /**
 * Génère un rapport HTML pour la liste des clients sortis (format folio ou booking)
 */
  static generateGuestCheckedOutHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
// Déterminer le format des données
const dataFormat = filters.status || 'booking'
const isFolioFormat = dataFormat === 'folio'

// Colonnes selon le format
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

// Générer les en-têtes du tableau
const tableHeaders = columns.map(column => 
    `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
).join('')

// Générer les lignes du tableau
const tableRows = data.map((item, index) => {
    const cells = columns.map(column => {
    let value = item[column.key] || '-'
    
    // Formater les valeurs numériques
    if (['totalCharges', 'totalPayments', 'balance', 'roomRate', 'actualNights'].includes(column.key)) {
        if (column.key === 'actualNights') {
        value = Math.round(value)
        } else {
        value = Number(value).toFixed(2)
        }
    }
    
    return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
    })

    const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'
    return `<tr class="${rowClass} hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${cells.join('')}</tr>`
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

return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guest Checked Out Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guest Checked Out Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8fafc; 
            color: #1f2937; 
        }
        
        .report-container { 
            max-width: 100%; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .dark .report-container {
            background-color: #1f2937;
            color: #e5e7eb;
        }
        
        .report-header { 
            padding: 20px 24px; 
            background-color: white;
        }
        
        .dark .report-header {
            background-color: #1f2937;
        }
        
        .report-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 8px; 
        }
        
        .dark .report-title {
            color: #f9fafb;
        }
        
        .report-subtitle { 
            font-size: 14px; 
            color: #6b7280; 
        }
        
        .dark .report-subtitle {
            color: #9ca3af;
        }
        
        .filters-info { 
            padding: 16px 24px; 
            background-color: #f8fafc; 
            font-size: 14px; 
            color: #6b7280; 
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .filters-info {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .filters-info span { 
            margin-right: 16px; 
        }
        
        .results-section { 
            background-color: white;
        }
        
        .dark .results-section {
            background-color: #1f2937;
        }
        
        .results-header { 
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .results-header {
            border-color: #4b5563;
        }
        
        .results-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin: 0;
        }
        
        .dark .results-title {
            color: #f9fafb;
        }
        
        .results-meta { 
            font-size: 12px; 
            color: #6b7280; 
            margin-top: 4px;
        }
        
        .dark .results-meta {
            color: #9ca3af;
        }
        
        .table-container {
            background-color: white;
            overflow-x: auto;
        }
        
        .dark .table-container {
            background-color: #1f2937;
        }
        
        .results-table { 
            width: 100%; 
            border-collapse: separate;
            border-spacing: 0;
            font-size: 14px; 
        }
        
        .results-table th { 
            background-color: #f9fafb; 
            padding: 12px 16px; 
            text-align: left; 
            font-weight: 500; 
            color: #6b7280; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
        }
        
        .dark .results-table th {
            background-color: #374151;
            color: #9ca3af;
        }
        
        .results-table td { 
            padding: 16px; 
            font-size: 14px; 
            white-space: nowrap;
        }
        
        .dark .results-table td {
            color: #e5e7eb;
        }
        
        .results-table tr:hover { 
            background-color: #f0f9ff !important; 
        }
        
        .dark .results-table tr:hover {
            background-color: #374151 !important;
        }
        
        .results-footer { 
            padding: 20px 24px; 
            background-color: #f9fafb; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            font-weight: 500; 
            color: #374151; 
        }
        
        .dark .results-footer {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .summary-stats { 
            display: flex; 
            gap: 20px; 
            margin-top: 12px; 
            flex-wrap: wrap; 
        }
        
        .summary-stat { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-width: 80px; 
        }
        
        .stat-value { 
            font-size: 14px; 
            font-weight: 600; 
            color: #3b82f6; 
        }
        
        .dark .stat-value {
            color: #60a5fa;
        }
        
        .stat-label { 
            font-size: 12px; 
            color: #6b7280; 
        }
        
        .dark .stat-label {
            color: #9ca3af;
        }
        
        .report-meta { 
            margin-top: 20px; 
            padding-top: 16px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280; 
            text-align: center; 
        }
        
        .dark .report-meta {
            border-color: #4b5563;
            color: #9ca3af;
        }
        
        .financial-positive {
            color: #059669;
            font-weight: 600;
        }
        
        .financial-negative {
            color: #dc2626;
            font-weight: 600;
        }
        
        .financial-neutral {
            color: #6b7280;
        }
        
        .dark .financial-positive {
            color: #34d399;
        }
        
        .dark .financial-negative {
            color: #f87171;
        }
        
        .dark .financial-neutral {
            color: #9ca3af;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .report-container {
                border-radius: 0;
            }
            
            .results-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .summary-stat {
                min-width: 60px;
            }
            
            .filters-info span {
                display: block;
                margin-bottom: 8px;
                margin-right: 0;
            }
            
            .results-table th,
            .results-table td {
                padding: 8px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">Guest Checked Out Report</h1>
            <p class="report-subtitle">${isFolioFormat ? 'View by Folio' : 'View by Booking'} | Check-out Date: ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} to ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</p>
        </div>
        
        <div class="filters-info">
            <span><strong>Data Format:</strong> ${isFolioFormat ? 'By Folio' : 'By Booking'}</span>
            <span><strong>Hotel:</strong> ${data[0].hotelName || 'All Hotels'}</span>
            ${filters.roomTypeId ? `<span><strong>Room Type:</strong> ${filters.roomTypeId}</span>` : ''}
            ${filters.guestId ? `<span><strong>Guest ID:</strong> ${filters.guestId}</span>` : ''}
        </div>
        
        <div class="results-section">
            ${data.length > 0 ? `
            <div class="table-container">
                <table class="results-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            
            <div class="results-footer">
                <div style="margin-bottom: 8px;">
                    <span>${isFolioFormat ? `Total Folios: ${summary.totalFolios}` : `Total Checked Out: ${summary.totalCheckedOut}`} • Total Revenue: ${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</span>
                </div>
                
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-value">${isFolioFormat ? summary.totalFolios : summary.totalCheckedOut}</span>
                        <span class="stat-label">${isFolioFormat ? 'Folios' : 'Check-outs'}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Total Revenue</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalPayments ? Number(summary.totalPayments).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Total Payments</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value ${summary.totalBalance > 0 ? 'financial-negative' : 'financial-positive'}">
                            ${summary.totalBalance ? Number(summary.totalBalance).toFixed(2) : '0.00'}
                        </span>
                        <span class="stat-label">Outstanding</span>
                    </div>
                    ${!isFolioFormat ? `
                    <div class="summary-stat">
                        <span class="stat-value">${summary.averageStayLength ? Number(summary.averageStayLength).toFixed(1) : '0.0'}</span>
                        <span class="stat-label">Avg. Nights</span>
                    </div>
                    ` : ''}
                </div>
            </div>
            ` : `
            <div class="no-data" style="padding: 60px 20px; text-align: center; color: #6b7280; font-size: 16px;">
                Aucune donnée ne correspond aux filtres sélectionnés
            </div>
            `}
            
            <div class="report-meta">
                <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} ${isFolioFormat ? 'folios' : 'bookings'} | ${columns.length} columns displayed</p>
            </div>
        </div>
    </div>

    <script>
        // Script pour la coloration des soldes
        document.addEventListener('DOMContentLoaded', function() {
            const balanceCells = document.querySelectorAll('td:nth-child(8), td:nth-child(9), td:nth-child(10)'); // Colonnes financières
            balanceCells.forEach(cell => {
                const value = parseFloat(cell.textContent);
                if (!isNaN(value)) {
                    if (value > 0) {
                        cell.classList.add('financial-negative');
                    } else if (value < 0) {
                        cell.classList.add('financial-positive');
                    } else {
                        cell.classList.add('financial-neutral');
                    }
                }
            });
        });
    </script>
</body>
</html>
    `
  }
  static generateGuestCheckedInHtml(data: any[], summary: any, filters: ReportFilters, generatedAt: DateTime): string {
  // Colonnes à afficher
  const columns = [
    { key: 'resNo', label: 'Res. No' },
    { key: 'guest', label: 'Guest' },
    { key: 'room', label: 'Room' },
    { key: 'rate', label: 'Rate' },
    { key: 'arrival', label: 'Arrival' },
    { key: 'departure', label: 'Departure' },
    { key: 'pax', label: 'Pax' },
    { key: 'BusiSour', label: 'Business Source' },
    { key: 'restyp', label: 'Res. Type' },
    { key: 'user', label: 'User' }
  ]

  // Ajouter les colonnes supplémentaires si sélectionnées
  if (filters.selectedColumns && filters.selectedColumns.length > 0) {
    filters.selectedColumns.forEach(column => {
      columns.push({ 
        key: column.toLowerCase().replace(/\s+/g, '').replace('.', ''), 
        label: column 
      })
    })
  }

  // Générer les en-têtes du tableau
  const tableHeaders = columns.map(column => 
    `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
  ).join('')

  // Générer les lignes du tableau
  let tableRows = ''
  data.forEach((item, index) => {
    const cells = columns.map(column => {
      const value = item[column.key] || '-'
      return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
    })

    tableRows += `<tr class="bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${cells.join('')}</tr>`
  })

  // Formater les dates pour l'affichage des filtres
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
    <title>Guest Checked In Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
    <style>
        body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f8fafc; 
            color: #1f2937; 
        }
        
        .report-container { 
            max-width: 100%; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        
        .dark .report-container {
            background-color: #1f2937;
            color: #e5e7eb;
        }
        
        .report-header { 
            padding: 20px 24px; 
            background-color: white;
        }
        
        .dark .report-header {
            background-color: #1f2937;
        }
        
        .report-title { 
            font-size: 24px; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 8px; 
        }
        
        .dark .report-title {
            color: #f9fafb;
        }
        
        .report-subtitle { 
            font-size: 14px; 
            color: #6b7280; 
        }
        
        .dark .report-subtitle {
            color: #9ca3af;
        }
        
        .filters-info { 
            padding: 16px 24px; 
            background-color: #f8fafc; 
            font-size: 14px; 
            color: #6b7280; 
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .filters-info {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .filters-info span { 
            margin-right: 16px; 
        }
        
        .results-section { 
            background-color: white;
        }
        
        .dark .results-section {
            background-color: #1f2937;
        }
        
        .results-header { 
            padding: 20px 24px;
            border-top: 1px solid #e5e7eb;
        }
        
        .dark .results-header {
            border-color: #4b5563;
        }
        
        .results-title { 
            font-size: 18px; 
            font-weight: 600; 
            color: #111827; 
            margin: 0;
        }
        
        .dark .results-title {
            color: #f9fafb;
        }
        
        .results-meta { 
            font-size: 12px; 
            color: #6b7280; 
            margin-top: 4px;
        }
        
        .dark .results-meta {
            color: #9ca3af;
        }
        
        .table-container {
            background-color: white;
            overflow-x: auto;
        }
        
        .dark .table-container {
            background-color: #1f2937;
        }
        
        .results-table { 
            width: 100%; 
            border-collapse: separate;
            border-spacing: 0;
            font-size: 14px; 
        }
        
        .results-table th { 
            background-color: #f9fafb; 
            padding: 12px 16px; 
            text-align: left; 
            font-weight: 500; 
            color: #6b7280; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
            position: sticky;
            top: 0;
        }
        
        .dark .results-table th {
            background-color: #374151;
            color: #9ca3af;
        }
        
        .results-table td { 
            padding: 16px; 
            font-size: 14px; 
            white-space: nowrap;
        }
        
        .dark .results-table td {
            color: #e5e7eb;
        }
        
        .results-table tr:hover { 
            background-color: #f0f9ff !important; 
        }
        
        .dark .results-table tr:hover {
            background-color: #374151 !important;
        }
        
        .results-footer { 
            padding: 20px 24px; 
            background-color: #f9fafb; 
            border-top: 1px solid #e5e7eb; 
            font-size: 14px; 
            font-weight: 500; 
            color: #374151; 
        }
        
        .dark .results-footer {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .summary-stats { 
            display: flex; 
            gap: 20px; 
            margin-top: 12px; 
            flex-wrap: wrap; 
        }
        
        .summary-stat { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-width: 80px; 
        }
        
        .stat-value { 
            font-size: 14px; 
            font-weight: 600; 
            color: #3b82f6; 
        }
        
        .dark .stat-value {
            color: #60a5fa;
        }
        
        .stat-label { 
            font-size: 12px; 
            color: #6b7280; 
        }
        
        .dark .stat-label {
            color: #9ca3af;
        }
        
        .report-meta { 
            margin-top: 20px; 
            padding-top: 16px; 
            border-top: 1px solid #e5e7eb; 
            font-size: 12px; 
            color: #6b7280; 
            text-align: center; 
        }
        
        .dark .report-meta {
            border-color: #4b5563;
            color: #9ca3af;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            body {
                padding: 10px;
            }
            
            .report-container {
                border-radius: 0;
            }
            
            .results-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 8px;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .summary-stat {
                min-width: 60px;
            }
            
            .filters-info span {
                display: block;
                margin-bottom: 8px;
                margin-right: 0;
            }
            
            .results-table th,
            .results-table td {
                padding: 8px;
                font-size: 12px;
            }
        }
    </style>
</head>
<body class="bg-gray-50 dark:bg-gray-900">
    <div class="report-container">
        <div class="report-header">
            <h1 class="report-title">Guest Checked In Report</h1>
            <p class="report-subtitle">View and manage currently checked-in guests</p>
        </div>
        
        <div class="filters-info">
            <span><strong>Hotel:</strong> ${data[0]?.hotelName || 'Hotel Nihal'}</span>
            <span><strong>Checked-in From:</strong> ${filters.arrivalFrom ? formatDate(filters.arrivalFrom) : 'N/A'} <strong>To:</strong> ${filters.arrivalTo ? formatDate(filters.arrivalTo) : 'N/A'}</span>
            <span><strong>Order By:</strong> Room</span>
            <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
            <span><strong>Direct Check-in:</strong> ${filters.checkin ? 'Yes' : 'No'}</span>
        </div>
        
        <div class="results-section">
            
            <div class="table-container">
                <table class="results-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            
            <div class="results-footer">
                <div style="margin-bottom: 8px;">
                    <span>Total Reservations: ${summary.totalReservations || 0}</span>
                    <span style="margin-left: 16px;">Total Pax: ${summary.totalPax || 0}</span>
                </div>
                
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalReservations || 0}</span>
                        <span class="stat-label">Reservations</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalPax || 0}</span>
                        <span class="stat-label">Guests</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Revenue</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.averageRate ? Number(summary.averageRate).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Avg. Rate</span>
                    </div>
                </div>
            </div>
            
            <div class="report-meta">
                <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} records | ${columns.length} columns displayed</p>
            </div>
        </div>
    </div>

    <script>
        // Script pour détecter le mode sombre du système
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            document.body.classList.add('dark');
        }
        
        // Écouter les changements de mode sombre
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (e.matches) {
                document.body.classList.add('dark');
            } else {
                document.body.classList.remove('dark');
            }
        });
    </script>
</body>
</html>
    `
  }
}
