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
      'Pick Up': { key: 'pickUp', label: 'Pick Up' },
      'Drop Off': { key: 'dropOff', label: 'Drop Off' },
      'Res.Type': { key: 'reservationType', label: 'Res.Type' },
      'Company': { key: 'company', label: 'Company' },
      'User': { key: 'createdBy', label: 'User' },
      'Deposit': { key: 'depositPaid', label: 'Deposit' },
      'Balance Due': { key: 'balanceDue', label: 'Balance Due' },
      'Market Code': { key: 'marketSegment', label: 'Market Code' },
      'Business Source': { key: 'businessSource', label: 'Business Source' },
      'Meal Plan': { key: 'mealPlan', label: 'Meal Plan' },
      'Rate Type': { key: 'ratePlan', label: 'Rate Type' }
    }

    // Colonnes de base toujours visibles
    const baseColumns = [
      { key: 'reservationNumber', label: 'Res. No' },
      { key: 'guestName', label: 'Guest' },
      { key: 'roomInfo', label: 'Room' },
      { key: 'ratePerNight', label: 'Rate' },
      { key: 'arrivalDate', label: 'Arrival' },
      { key: 'departureDate', label: 'Departure' },
      { key: 'paxInfo', label: 'Pax' }
    ]

    // Colonnes supplémentaires sélectionnées
    const selectedAdditionalColumns = (filters.selectedColumns || [])
      .filter(col => availableColumns[col as keyof typeof availableColumns])
      .map(col => availableColumns[col as keyof typeof availableColumns])

    // Toutes les colonnes à afficher
    const allColumns = [...baseColumns, ...selectedAdditionalColumns]

    // Générer les en-têtes du tableau
    const tableHeaders = allColumns.map(column => 
      `<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
    ).join('')

    // Générer les lignes du tableau
    const tableRows = data.map((item, index) => {
      const roomInfo = `${item.roomNumber || 'N/A'} ${item.roomType ? `- ${item.roomType}` : ''}`
      const paxInfo = `${item.adults || 0}/${item.children || 0}`
      
      // Cellules de base
      const baseCells = [
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${item.reservationNumber || 'N/A'}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${item.guestName || 'N/A'}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${roomInfo}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${item.ratePerNight ? Number(item.ratePerNight).toFixed(2) : '0.00'}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${item.arrivalDate || 'N/A'}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${item.departureDate || 'N/A'}</td>`,
        `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${paxInfo}</td>`
      ]

      // Cellules supplémentaires basées sur la sélection
      const additionalCells = selectedAdditionalColumns.map(column => {
        const value = item[column.key] || '-'
        return `<td class="px-4 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
      })

      const rowClass = index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'
      return `<tr class="${rowClass} hover:bg-blue-50 dark:hover:bg-gray-600 transition-colors cursor-pointer">${[...baseCells, ...additionalCells].join('')}</tr>`
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
    <title>Arrival List Report - ${generatedAt.toFormat('dd/MM/yyyy')}</title>
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
        
        .selected-columns-info { 
            background-color: #eff6ff; 
            padding: 8px 12px; 
            border-radius: 4px; 
            margin: 8px 0; 
            font-size: 12px; 
        }
        
        .dark .selected-columns-info {
            background-color: #1e40af;
            color: #dbeafe;
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
            <h1 class="report-title">Arrival List Report</h1>
            <p class="report-subtitle">View and manage upcoming guest arrivals</p>
        </div>
        
        <div class="filters-info">
            <span><strong>Hotel:</strong> ${filters.hotelId || 'All Hotels'}</span>
            <span><strong>Date From:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} <strong>To:</strong> ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
            <span><strong>Order By:</strong> ${filters.orderBy || 'Room'}</span>
            <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
        </div>
        
        ${selectedAdditionalColumns.length > 0 ? `
        <div class="filters-info selected-columns-info">
            <strong>Selected Columns:</strong> 
            ${selectedAdditionalColumns.map(col => col.label).join(', ')}
        </div>
        ` : ''}
        
        <div class="results-section">
            <div class="results-header">
                <h2 class="results-title">Arrival List Results</h2>
                <div class="results-meta">Hotel Nihai • Date From: ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} To ${filters.endDate ? formatDate(filters.endDate) : 'N/A'} • Order By: ${filters.orderBy || 'Room'} • Tax Inclusive: ${filters.taxInclusive ? 'Yes' : 'No'}</div>
            </div>
            
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
                    <span>Total Reservations: #${summary.totalArrivals || 1} • Total Pax: ${(summary.totalAdults || 0) + (summary.totalChildren || 0)}</span>
                </div>
                
                <div class="summary-stats">
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalArrivals || 0}</span>
                        <span class="stat-label">Total Arrivals</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalRevenue ? Number(summary.totalRevenue).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Total Revenue</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.totalNights || 0}</span>
                        <span class="stat-label">Total Nights</span>
                    </div>
                    <div class="summary-stat">
                        <span class="stat-value">${summary.averageRate ? Number(summary.averageRate).toFixed(2) : '0.00'}</span>
                        <span class="stat-label">Average Rate</span>
                    </div>
                </div>
            </div>
            
            <div class="report-meta">
                <p>Generated on ${generatedAt.toFormat('dd/MM/yyyy HH:mm:ss')} | ${data.length} records | ${allColumns.length} columns displayed</p>
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
            <span><strong>Hotel:</strong> ${filters.hotelId || 'Hotel Nihal'}</span>
            <span><strong>Departure From:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} <strong>To:</strong> ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
            <span><strong>Order By:</strong> Room</span>
            <span><strong>Tax Inclusive:</strong> ${filters.taxInclusive ? 'Yes' : 'No'}</span>
        </div>
        
        <div class="results-section">
            <div class="results-header">
                <h2 class="results-title">Departure List Results</h2>
                <div class="results-meta">Hotel Nihal • Departure From: ${filters.arrivalFrom || 'N/A'} To ${filters.arrivalTo || 'N/A'} • Order By: Room • Tax Inclusive: ${filters.taxInclusive ? 'Yes' : 'No'}</div>
            </div>
            
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
            <div class="results-header">
                <h2 class="results-title">Cancelled Reservations Results</h2>
                <div class="results-meta">Hotel Nihal • Date From: ${filters.arrivalFrom || 'N/A'} To ${filters.arrivalTo || 'N/A'} • Order By: Room • Tax Inclusive: ${filters.taxInclusive ? 'Yes' : 'No'}</div>
            </div>
            
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
                <div class="results-header">
                    <h2 class="results-title">Void Reservations Results</h2>
                    <div class="results-meta">Hotel Nihal • Void From: ${filters.arrivalFrom || 'N/A'} To ${filters.arrivalTo || 'N/A'} • Order By: Room • Tax Inclusive: ${filters.taxInclusive ? 'Yes' : 'No'}</div>
                </div>
                
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
}
