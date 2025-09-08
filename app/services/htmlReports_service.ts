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
      `<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">${column.label}</th>`
    ).join('')

    // Générer les lignes du tableau
    const tableRows = data.map((item) => {
      const roomInfo = `${item.roomNumber || 'N/A'} ${item.roomType ? `- ${item.roomType}` : ''}`
      const paxInfo = `${item.adults || 0}/${item.children || 0}`
      
      // Cellules de base
      const baseCells = [
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${item.reservationNumber || 'N/A'}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${item.guestName || 'N/A'}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${roomInfo}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${item.ratePerNight ? Number(item.ratePerNight).toFixed(2) : '0.00'}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${item.arrivalDate || 'N/A'}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${item.departureDate || 'N/A'}</td>`,
        `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${paxInfo}</td>`
      ]

      // Cellules supplémentaires basées sur la sélection
      const additionalCells = selectedAdditionalColumns.map(column => {
        const value = item[column.key] || ''
        return `<td class="px-6 py-4 text-sm text-gray-900 dark:text-white">${value}</td>`
      })

      return `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">${[...baseCells, ...additionalCells].join('')}</tr>`
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
            padding: 0; 
            background-color: #f9fafb; 
            color: #1f2937; 
        }
        
        .report-container { 
            max-width: 100%; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 0.5rem; 
            border: 1px solid #e5e7eb;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }
        
        .dark .report-container {
            background-color: #1f2937;
            border-color: #374151;
            color: #e5e7eb;
        }
        
        .report-header { 
            padding: 1.5rem; 
            border-bottom: 1px solid #e5e7eb; 
            background-color: #f9fafb;
        }
        
        .dark .report-header {
            background-color: #374151;
            border-color: #4b5563;
        }
        
        .report-title { 
            font-size: 1.5rem; 
            font-weight: 600; 
            color: #111827; 
            margin-bottom: 0.5rem; 
        }
        
        .dark .report-title {
            color: #f9fafb;
        }
        
        .report-subtitle { 
            font-size: 0.875rem; 
            color: #6b7280; 
        }
        
        .dark .report-subtitle {
            color: #9ca3af;
        }
        
        .filters-info { 
            padding: 1rem 1.5rem; 
            background-color: #f8fafc; 
            border-bottom: 1px solid #e5e7eb; 
            font-size: 0.875rem; 
            color: #6b7280; 
        }
        
        .dark .filters-info {
            background-color: #374151;
            border-color: #4b5563;
            color: #d1d5db;
        }
        
        .filters-info span { 
            margin-right: 1rem; 
        }
        
        .results-section { 
            padding: 1.5rem; 
        }
        
        .results-header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 1rem; 
            padding-bottom: 1rem; 
            border-bottom: 1px solid #e5e7eb; 
        }
        
        .dark .results-header {
            border-color: #4b5563;
        }
        
        .results-title { 
            font-size: 1.125rem; 
            font-weight: 600; 
            color: #111827; 
        }
        
        .dark .results-title {
            color: #f9fafb;
        }
        
        .results-meta { 
            font-size: 0.875rem; 
            color: #6b7280; 
        }
        
        .dark .results-meta {
            color: #9ca3af;
        }
        
        .results-table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 1rem; 
            font-size: 0.875rem; 
        }
        
        .results-table th { 
            background-color: #f9fafb; 
            padding: 0.75rem 1.5rem; 
            text-align: left; 
            font-weight: 500; 
            color: #374151; 
            border-bottom: 1px solid #e5e7eb; 
            font-size: 0.75rem; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .dark .results-table th {
            background-color: #374151;
            color: #d1d5db;
            border-color: #4b5563;
        }
        
        .results-table td { 
            padding: 1rem 1.5rem; 
            border-bottom: 1px solid #e5e7eb; 
            font-size: 0.875rem; 
        }
        
        .dark .results-table td {
            border-color: #4b5563;
            color: #e5e7eb;
        }
        
        .results-table tr:hover { 
            background-color: #f8fafc; 
        }
        
        .dark .results-table tr:hover {
            background-color: #374151;
        }
        
        .results-footer { 
            padding: 1rem; 
            background-color: #f9fafb; 
            border-top: 1px solid #e5e7eb; 
            font-size: 0.875rem; 
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
            gap: 1.25rem; 
            margin-top: 0.75rem; 
            flex-wrap: wrap; 
        }
        
        .summary-stat { 
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            min-width: 5rem; 
        }
        
        .stat-value { 
            font-size: 0.875rem; 
            font-weight: 600; 
            color: #3b82f6; 
        }
        
        .dark .stat-value {
            color: #60a5fa;
        }
        
        .stat-label { 
            font-size: 0.75rem; 
            color: #6b7280; 
        }
        
        .dark .stat-label {
            color: #9ca3af;
        }
        
        .report-meta { 
            margin-top: 1.25rem; 
            padding-top: 1rem; 
            border-top: 1px solid #e5e7eb; 
            font-size: 0.75rem; 
            color: #6b7280; 
            text-align: center; 
        }
        
        .dark .report-meta {
            border-color: #4b5563;
            color: #9ca3af;
        }
        
        .selected-columns-info { 
            background-color: #eff6ff; 
            padding: 0.5rem 0.75rem; 
            border-radius: 0.25rem; 
            margin: 0.5rem 0; 
            font-size: 0.75rem; 
        }
        
        .dark .selected-columns-info {
            background-color: #1e40af;
            color: #dbeafe;
        }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .report-container {
                margin: 0;
                border-radius: 0;
                border: none;
            }
            
            .results-header {
                flex-direction: column;
                align-items: flex-start;
                gap: 0.5rem;
            }
            
            .summary-stats {
                justify-content: center;
            }
            
            .summary-stat {
                min-width: 4rem;
            }
            
            .filters-info span {
                display: block;
                margin-bottom: 0.5rem;
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
            <span><strong>Period:</strong> ${filters.startDate ? formatDate(filters.startDate) : 'N/A'} - ${filters.endDate ? formatDate(filters.endDate) : 'N/A'}</span>
            <span><strong>Room Type:</strong> ${filters.roomTypeId || 'All Types'}</span>
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
                <div class="results-meta">Generated: ${generatedAt.toFormat('dd/MM/yyyy HH:mm')}</div>
            </div>
            
            <div style="overflow-x: auto;">
                <table class="results-table">
                    <thead>
                        <tr>${tableHeaders}</tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>
            </div>
            
            <div class="results-footer">
                <div style="margin-bottom: 0.5rem;">
                    <span>Total Reservations: ${summary.totalArrivals || 0}</span> • 
                    <span>Total Pax: ${(summary.totalAdults || 0) + (summary.totalChildren || 0)} (${summary.totalAdults || 0} adults, ${summary.totalChildren || 0} children)</span>
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
}