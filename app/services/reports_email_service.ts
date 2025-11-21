import MailService from '#services/mail_service'
import Hotel from '#models/hotel'
import DailySummaryFact from '#models/daily_summary_fact'
import { DateTime } from 'luxon'
import PdfGenerationService from '#services/pdf_generation_service'
import ReportsService from '#services/reports_service'

type AnyRecipient = string | { address: string; name?: string }

export default class ReportsEmailService {
  /**
   * Send a Daily Summary email using data from DailySummaryFact
   */
  public async sendDailySummaryEmail(dailySummary: DailySummaryFact): Promise<void> {
    const hotel = await Hotel.findOrFail(dailySummary.hotelId)

    const subject = `[${hotel.hotelName}] Daily Summary - ${dailySummary.auditDate.toFormat('yyyy-LL-dd')}`
    const html = this.buildDailySummaryHtml(hotel, dailySummary)

    const { to, cc, bcc, separateTo } = this.resolveRecipients(hotel)
    const attachments = await this.buildReportAttachments(hotel, dailySummary)

    // Fallback: if no recipients configured, try hotel.email
    const finalTo: AnyRecipient[] = to.length > 0 ? to : (hotel.email ? [hotel.email] : [])

    if (finalTo.length === 0) {
      // No recipients available; do nothing gracefully
      return
    }

    //buila  all tthe dps attacment here 

    if (separateTo && finalTo.length > 0) {
      for (const recipient of finalTo) {
        await MailService.sendWithAttachments({
          to: recipient,
          subject,
          html,
          attachments,
        })
      }
    } else {
      await MailService.sendWithAttachments({
        to: finalTo,
        subject,
        html,
        cc,
        bcc,
        attachments,
      })
    }
  }

  /**
   * Attempt to resolve recipients from hotel.printEmailSettings
   * Supports a variety of shapes to be resilient to config differences.
   */
  private resolveRecipients(hotel: Hotel): { to: AnyRecipient[]; cc: AnyRecipient[]; bcc: AnyRecipient[]; separateTo: boolean } {
    const settings: any = hotel.printEmailSettings || {}

    const normalize = (val: unknown): AnyRecipient[] => {
      if (!val) return []
      if (typeof val === 'string') return [val]
      if (Array.isArray(val)) return val.filter((v) => typeof v === 'string' || (v && typeof v === 'object')) as AnyRecipient[]
      if (typeof val === 'object' && 'address' in (val as any)) return [val as AnyRecipient]
      return []
    }

    // Common patterns
    const daily = settings.dailySummary || {}
    // Daily summary recipients block
    const to = normalize(daily.recipients || settings.dailySummaryRecipients || settings.recipients)
    const cc = normalize(daily.cc || settings.dailySummaryCc || settings.cc)
    const bcc = normalize(daily.bcc || settings.dailySummaryBcc || settings.bcc)
    
    // Reports-level recipients and sending policy
    const reports = settings.reports || {}
    const reportsSendTo = normalize(reports.sendTo)
    // Send separately per recipient as requested; default to true when multiple recipients found
    const combinedTo = (to.length ? to : reportsSendTo)
    const separateTo = true

    return { to: combinedTo, cc, bcc, separateTo }
  }

  /**
   * Minimal, readable HTML summary. You can replace with an Edge template later.
   */
  private buildDailySummaryHtml(hotel: Hotel, fact: DailySummaryFact): string {
    const auditDateStr = fact.auditDate.toFormat('yyyy-LL-dd')

    const currency = hotel.currencyCode || ''

    const money = (n?: number) => {
      if (typeof n !== 'number') return '-'
      return `${currency} ${n.toFixed(2)}`
    }

    const percent = (n?: number) => {
      if (typeof n !== 'number') return '-'
      return `${(n * 100).toFixed(2)}%`
    }

    const contactInfo = hotel.contactInfo as Record<string, unknown> | null
    const phone = hotel.phoneNumber || (contactInfo && (contactInfo['phone'] as string)) || ''
    const email = hotel.email || (contactInfo && (contactInfo['email'] as string)) || ''

    return `
      <div style="font-family: Arial, sans-serif; color: #222;">
        <h2 style="margin: 0 0 8px 0;">${hotel.hotelName}</h2>
        <div style="font-size: 12px; color: #555; margin-bottom: 16px;">
          <div>${hotel.address || ''}</div>
          <div>${hotel.city || ''} ${hotel.stateProvince || ''} ${hotel.postalCode || ''}</div>
          <div>${hotel.country || ''}</div>
          <div>${phone ? `Phone: ${phone}` : ''} ${email ? ` | Email: ${email}` : ''}</div>
        </div>

        <h3 style="margin: 0 0 4px 0;">Daily Summary</h3>
        <div style="font-size: 12px; color: #555; margin-bottom: 12px;">Audit Date: ${auditDateStr}</div>

        <table cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%; font-size: 13px;">
          <thead>
            <tr style="background:#f3f4f6; text-align:left;">
              <th style="border:1px solid #e5e7eb">Metric</th>
              <th style="border:1px solid #e5e7eb">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #e5e7eb">Total Room Revenue</td><td style="border:1px solid #e5e7eb">${money(fact.totalRoomRevenue)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total F&B Revenue</td><td style="border:1px solid #e5e7eb">${money(fact.totalFoodBeverageRevenue)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Misc Revenue</td><td style="border:1px solid #e5e7eb">${money(fact.totalMiscellaneousRevenue)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Taxes</td><td style="border:1px solid #e5e7eb">${money(fact.totalTaxes)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Resort Fees</td><td style="border:1px solid #e5e7eb">${money(fact.totalResortFees)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Revenue</td><td style="border:1px solid #e5e7eb">${money(fact.totalRevenue)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Payments</td><td style="border:1px solid #e5e7eb">${money(fact.totalPayments)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Total Discounts</td><td style="border:1px solid #e5e7eb">${money(fact.totalDiscounts)}</td></tr>

            <tr><td style="border:1px solid #e5e7eb">Occupied Rooms</td><td style="border:1px solid #e5e7eb">${typeof fact.occupiedRooms === 'number' ? fact.occupiedRooms : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Available Rooms</td><td style="border:1px solid #e5e7eb">${typeof fact.totalAvailableRooms === 'number' ? fact.totalAvailableRooms : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Occupancy Rate</td><td style="border:1px solid #e5e7eb">${percent(fact.occupancyRate)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">RevPAR</td><td style="border:1px solid #e5e7eb">${money(fact.revPAR)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">ADR</td><td style="border:1px solid #e5e7eb">${money(fact.adr)}</td></tr>

            <tr><td style="border:1px solid #e5e7eb">Checked In</td><td style="border:1px solid #e5e7eb">${typeof fact.numCheckedIn === 'number' ? fact.numCheckedIn : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Checked Out</td><td style="border:1px solid #e5e7eb">${typeof fact.numCheckedOut === 'number' ? fact.numCheckedOut : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">No Shows</td><td style="border:1px solid #e5e7eb">${typeof fact.numNoShows === 'number' ? fact.numNoShows : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Cancellations</td><td style="border:1px solid #e5e7eb">${typeof fact.numCancellations === 'number' ? fact.numCancellations : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Bookings Made</td><td style="border:1px solid #e5e7eb">${typeof fact.numBookingsMade === 'number' ? fact.numBookingsMade : '-'}</td></tr>

            <tr><td style="border:1px solid #e5e7eb">Payments Received</td><td style="border:1px solid #e5e7eb">${money(fact.totalPaymentsReceived)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Accounts Receivable</td><td style="border:1px solid #e5e7eb">${money(fact.totalAccountsReceivable)}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Outstanding Folios</td><td style="border:1px solid #e5e7eb">${typeof fact.totalOutstandingFolios === 'number' ? fact.totalOutstandingFolios : '-'}</td></tr>
            <tr><td style="border:1px solid #e5e7eb">Outstanding Folios Balance</td><td style="border:1px solid #e5e7eb">${money(fact.totalOutstandingFoliosBalance)}</td></tr>
          </tbody>
        </table>

        <div style="margin-top: 16px; font-size: 12px; color: #666;">
          This email was generated automatically by Night Audit.
        </div>
      </div>
    `
  }

  /**
   * Build attachments based on Hotel.printEmailSettings.reports flags.
   * For now, attachments are minimal PDFs generated from simple HTML summaries.
   */
  private async buildReportAttachments(hotel: Hotel, fact: DailySummaryFact) {
    const settings: any = hotel.printEmailSettings || {}
    const reports: any = settings.reports || {}
    const dateStr = fact.auditDate.toFormat('yyyy-LL-dd')
    const attachments: { filename: string; content: Buffer; contentType?: string }[] = []

    const addPdf = async (title: string, htmlBody: string) => {
      const pdf = await PdfGenerationService.generatePdfFromHtml(`
        <div style="font-family: Arial, sans-serif; font-size: 12px; color:#222;">
          <h3 style="margin:0 0 8px 0;">${title} — ${dateStr}</h3>
          ${htmlBody}
        </div>
      `)
      attachments.push({ filename: `${title.replace(/\s+/g, '_')}_${dateStr}.pdf`, content: pdf, contentType: 'application/pdf' })
    }

    // Night Audit
    if (reports.nightAudit === true) {
      const naData = fact.nightAuditReportData || {}
      await addPdf('Night Audit', `<pre style="white-space:pre-wrap">${this.safeJson(naData)}</pre>`)
    }

    // City Ledger Summary (simplified)
    if (reports.cityLedgerSummary === true) {
      const ignoreZero = reports.ignoreZeroBalanceAccount === true
      const htmlBody = `<div>City Ledger Summary${ignoreZero ? ' (Ignoring zero-balance accounts)' : ''}. Data source not configured; summary placeholder.</div>`
      await addPdf('City Ledger Summary', htmlBody)
    }

    // Expense Voucher (Back Office Expenses summary for the day)
    if (reports.expenseVoucher === true) {
      const filters = { hotelId: fact.hotelId, startDate: fact.auditDate.toISODate(), endDate: fact.auditDate.toISODate() }
      try {
        const data = await ReportsService.getExpenseReport(filters)
        const rows = (data.data || []).slice(0, 100).map((r: any) => `<tr><td>${r.date || ''}</td><td>${r.department || ''}</td><td>${r.description || ''}</td><td>${r.amount || 0}</td></tr>`).join('')
        const htmlBody = `<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Date</th><th>Dept</th><th>Description</th><th>Amount</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No expenses</td></tr>'}</tbody></table>`
        await addPdf('Expense Voucher', htmlBody)
      } catch {
        await addPdf('Expense Voucher', '<div>No data available</div>')
      }
    }

    // Manager Report (use stored managerReportData if present)
    if (reports.managerReport === true) {
      const mgr = fact.managerReportData || {}
      await addPdf('Manager Report', `<pre style="white-space:pre-wrap">${this.safeJson(mgr)}</pre>`)
    }

    // Front Desk Activities (checked-in/out summaries for the day)
    if (reports.frontDeskActivities === true) {
      try {
        const filters = { hotelId: fact.hotelId, startDate: fact.auditDate.toISODate(), endDate: fact.auditDate.toISODate() }
        const checkedIn = await ReportsService.getGuestCheckedIn(filters)
        const checkedOut = await ReportsService.getGuestCheckedOut(filters)
        const ciCount = (checkedIn?.filters ? (checkedIn as any).totalRecords : 0) || (checkedIn as any)?.data?.length || 0
        const coCount = (checkedOut?.filters ? (checkedOut as any).totalRecords : 0) || (checkedOut as any)?.data?.length || 0
        await addPdf('Front Desk Activities', `<div>Checked In: ${ciCount} • Checked Out: ${coCount}</div>`)
      } catch {
        await addPdf('Front Desk Activities', '<div>No data available</div>')
      }
    }

    // No Show Report
    if (reports.noShowReport === true) {
      try {
        const filters = { hotelId: fact.hotelId, startDate: fact.auditDate.toISODate(), endDate: fact.auditDate.toISODate() }
        const report = await ReportsService.getNoShowReservations(filters)
        const rows = (report.data || []).slice(0, 100).map((r: any) => `<tr><td>${r.reservationNumber || ''}</td><td>${r.guestName || ''}</td><td>${r.arrivalDate || ''}</td><td>${r.roomType || ''}</td></tr>`).join('')
        const htmlBody = `<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Res #</th><th>Guest</th><th>Arrival</th><th>Room Type</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No no-shows</td></tr>'}</tbody></table>`
        await addPdf('No Show Report', htmlBody)
      } catch {
        await addPdf('No Show Report', '<div>No data available</div>')
      }
    }

    // Monthly Occupancy Report
    if (reports.monthlyOccupancyReport === true) {
      try {
        const start = (fact.auditDate as DateTime).startOf('month').toISODate()
        const end = (fact.auditDate as DateTime).endOf('month').toISODate()
        const report = await ReportsService.getOccupancyReport({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const htmlBody = `<div>Total Records: ${report.totalRecords || 0}</div>`
        await addPdf('Monthly Occupancy Report', htmlBody)
      } catch {
        await addPdf('Monthly Occupancy Report', '<div>No data available</div>')
      }
    }

    // Monthly Statistics Report (ADR/RevPAR)
    if (reports.monthlyStatisticsReport === true) {
      try {
        const start = (fact.auditDate as DateTime).startOf('month').toISODate()
        const end = (fact.auditDate as DateTime).endOf('month').toISODate()
        const adr = await ReportsService.getADRReport({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const revpar = await ReportsService.getRevPARReport({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const htmlBody = `<div>ADR Records: ${adr.totalRecords || 0} • RevPAR Records: ${revpar.totalRecords || 0}</div>`
        await addPdf('Monthly Statistics Report', htmlBody)
      } catch {
        await addPdf('Monthly Statistics Report', '<div>No data available</div>')
      }
    }

    // Yearly Statistics Report (ADR/RevPAR year-to-date)
    if (reports.yearlyStatisticsReport === true) {
      try {
        const start = (fact.auditDate as DateTime).startOf('year').toISODate()
        const end = (fact.auditDate as DateTime).endOf('year').toISODate()
        const adr = await ReportsService.getADRReport({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const revpar = await ReportsService.getRevPARReport({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const htmlBody = `<div>ADR Records: ${adr.totalRecords || 0} • RevPAR Records: ${revpar.totalRecords || 0}</div>`
        await addPdf('Yearly Statistics Report', htmlBody)
      } catch {
        await addPdf('Yearly Statistics Report', '<div>No data available</div>')
      }
    }

    // Rooms On Books Report (use reservation forecast as proxy)
    if (reports.roomsOnBooksReport === true) {
      try {
        const start = (fact.auditDate as DateTime).toISODate()
        const end = (fact.auditDate as DateTime).plus({ days: 14 }).toISODate()
        const report = await ReportsService.getReservationForecast({ hotelId: fact.hotelId, startDate: start, endDate: end })
        const htmlBody = `<div>Total Records: ${report.totalRecords || 0}</div>`
        await addPdf('Rooms On Books Report', htmlBody)
      } catch {
        await addPdf('Rooms On Books Report', '<div>No data available</div>')
      }
    }

    // receiveTodayNextDaysBookingHtml => do NOT send here (handled elsewhere)

    return attachments
  }

  private safeJson(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2)
    } catch {
      return String(obj)
    }
  }

  /// TODO Create a new function  to send Daily email 
  //docs\today.html
  // app\services\today_report_service.ts
}