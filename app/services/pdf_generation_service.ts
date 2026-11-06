// @ts-ignore
import htmlPdf from 'html-pdf-node'
import sanitizeHtml from 'sanitize-html'
import { FolioPrintData } from '#services/folio_print_service'

export interface PdfOptions {
  format?: 'A4' | 'A3' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  displayHeaderFooter?: boolean
  printBackground?: boolean
  headerTemplate?: string
  footerTemplate?: string
}

export interface GuestHistoryInvoiceReservation {
  reservationNumber: string
  folioNumber: string
  guestName: string
  company: string
  nationality: string
  guestCode: string
  pax: number
  adults: number
  children: number
  nights: number
  roomNumber: string
  arrivalDate: string | Date
  departureDate: string | Date
  checkInTime: string
  checkOutTime: string
  tariff: number
  rateType: string
  reservedBy: string
  checkedInBy: string
  checkedOutBy: string
  totals: {
    totalChargesWithTaxes: number
    totalPayments: number
    totalTaxes: number
    outstandingBalance: number
  }
}

export interface GuestHistoryInvoiceData {
  hotel: {
    name: string
    address: string
    city?: string
    state?: string
    country?: string
    phone: string
    email: string
    website?: string
    registrationNumber?: string | null
    rcNumber?: string | null
  }
  guest: {
    name: string
    email?: string | null
    phone?: string | null
    address?: string | null
    city?: string | null
    country?: string | null
  }
  meta: {
    invoiceNumber: string
    generatedAt: string
    printedBy: string
    periodFrom: string
    periodTo: string
  }
  currency: { code: string }
  reservations: GuestHistoryInvoiceReservation[]
}

interface HotelInvoiceTemplateData {
  hotel: {
    name: string
    address: string
    phone: string
    email: string
    website?: string
    registrationNumber?: string | null
    rcNumber?: string | null
    cancellationPolicy?: string
    hotelPolicy?: string
  }
  reservation: {
    reservationNumber: string
    guest: {
      displayName: string
      guestCode?: string
      address?: string
      country?: string
    }
    company?: string
    adults: number
    children: number
    roomNumber: string
    checkInDate: string | Date
    checkOutDate: string | Date
    tariff: number
    checkInTime: string
    checkOutTime: string
    rateType: string
    reservedBy: string
    checkedInBy: string
    checkedOutBy: string
  }
  folio: {
    folioNumber: string
    reservationNumber: string
  }
  transactions: Array<{
    date: string | Date
    transactionNumber: string
    description: string
    amount: number
    balance: number
  }>
  totals: {
    totalChargesWithTaxes: number
    totalPayments: number
    totalTaxes: number
    outstandingBalance: number
  }
  currency: { code: string }
}

export default class PdfGenerationService {
  /**
   * Generate PDF from folio print data
   */
  static async generateFolioPdf(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '30mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      // Generate HTML content
      const htmlContent = this.generateHtmlTemplate(folioPrintData)

      // PDF generation options for html-pdf-node (puppeteer-style)
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate PDF: ${message}`)
    }
  }

  /**
   * Generate PDF from HTML content
   */
  static async generatePdfFromHtml(htmlContent: string, options: PdfOptions = {}): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: true,
        printBackground: true,
        ...options,
      }

      // PDF generation options for html-pdf-node (puppeteer-style)
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        printBackground: true,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate PDF from HTML: ${message}`)
    }
  }

  /**
   * Generate PDF from booking confirmation data
   */
  static async generateBookingPdf(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      // Generate HTML content
      const htmlContent = this.generateBookingHtmlTemplate(folioPrintData)

      // PDF generation options for html-pdf-node
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        border: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate booking PDF: ${message}`)
    }
  }
  /**
   * Generate PDF from booking confirmation data
   */
  static async generateBookingPdfFrench(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      // Generate HTML content
      const htmlContent = this.generateBookingHtmlTemplateFrench(folioPrintData)

      // PDF generation options for html-pdf-node
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        border: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate booking PDF: ${message}`)
    }
  }

  /**
   * Generate HTML template from folio print data
   */
  private static generateHtmlTemplate(data: FolioPrintData): string {
    const { hotel, reservation, folio, transactions, totals, currency } = data

    // Convert amount to words (simplified version)
    const amountInWords = this.numberToWords(totals.totalChargesWithTaxes)

    return `<!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tax Invoice - ${hotel.name}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
                font-family: Arial, sans-serif;
            }

            body {
                background-color: #f5f5f5;
                padding: 10px;
                font-size: 12px;
            }

            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background-color: white;
                border: 2px solid #000;
                box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            }

            .header {
                text-align: center;
                padding: 10px;
                border-bottom: 2px solid #000;
            }

            .hotel-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 5px;
            }

            .hotel-info {
                font-size: 11px;
                line-height: 1.3;
            }

            .registration-info {
                font-size: 11px;
                margin-top: 5px;
            }

            .tax-invoice-title {
                text-align: center;
                padding: 10px 0;
                font-size: 14px;
                font-weight: bold;
                text-decoration: underline;
            }

            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
            }

            th, td {
                padding: 5px;
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                border-left: none;
                border-right: none;
            }

            th {
                background-color: #f0f0f0;
                font-weight: bold;
            }

            .invoice-details {
                padding: 5px;
            }

            .invoice-details table {
                border: none;
            }

            .invoice-details td {
                border: none;
                padding: 1px 5px;
                vertical-align: top;
            }

            .label {
                font-weight: bold;
            }

            .guest-table, .stay-table {
                margin-bottom: 5px;
            }

            .charges-table {
                margin-bottom: 5px;
            }

            .charges-table td {
                padding: 3px 5px;
            }

            .text-right {
                text-align: right;
            }

            .text-center {
                text-align: center;
            }

            .totals-section {
                padding: 5px;
                margin-bottom: 5px;
            }

            .totals-section table {
                border: none;
            }

            .totals-section td {
                border: none;
                padding: 2px 5px;
            }

            .amount-in-words {
                padding: 5px;
                margin-bottom: 5px;
            }

            .amount-in-words table {
                border-top: 2px solid #000;
                border-bottom: 2px solid #000;
                border-left: none;
                border-right: none;
            }

            .amount-in-words td {
                border: none;
            }

            .bill-to-section {
                padding: 5px;
                margin-bottom: 5px;
            }

            .bill-to-section table {
                border: none;
            }

            .bill-to-section td {
                border: none;
                padding: 2px 5px;
                vertical-align: top;
            }

            .footer {
                text-align: center;
                padding: 10px;
                font-size: 11px;
                border-top: 2px solid #000;
            }

            .folio-notice {
                padding: 5px;
                font-size: 11px;
                font-weight: bold;
            }

            .verification-info {
                padding: 5px;
                font-size: 11px;
            }

            .verification-info table {
                border: none;
            }

            .verification-info td {
                border: none;
                padding: 2px 5px;
            }

            .page-info {
                text-align: right;
                padding: 5px;
                font-size: 11px;
            }

            .url {
                padding: 5px;
                font-size: 10px;
                text-align: center;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="hotel-name">${hotel.name}</div>
                <div class="hotel-info">
                    ${hotel.address}<br>
                    Phone: ${hotel.phone}; Email: ${hotel.email}<br>
                    URL: ${hotel.website || 'N/A'}
                </div>
                <div class="registration-info">
                    M${hotel.registrationNumber || 'N/A'}<br>
                    RC${hotel.rcNumber || 'N/A'}
                </div>
                <div class="tax-invoice-title">Tax Invoice</div>
            </div>

            <!-- Invoice Details -->
            <div class="invoice-details">
                <table>
                    <tr>
                        <td style="width: 50%;">
                            <span class="label">Folio No./Res No.</span> ${folio.folioNumber} / ${reservation.reservationNumber || 'N/A'}<br>
                            <span class="label">Guest Name</span> : ${reservation.guest?.displayName || 'N/A'}<br>
                            <span class="label">Company Name</span> : ${reservation.guest?.companyName || reservation.businessSource?.name || reservation.bookingSource?.sourceName || (reservation as any).sourceOfBusiness || 'None'}
                        </td>
                        <td style="width: 25%;">
                            <span class="label">Invoice No.</span> : ${folio.folioNumber || 'N/A'}
                        </td>
                        <td style="width: 25%;">
                            <span class="label">Date:</span> ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Guest Details Table -->
            <table class="guest-table">
                <tr>
                    <th>Nationality</th>
                    <th>No of Pax</th>
                    <th>Adult Child</th>
                    <th>G.R. Card No</th>
                    <th>Room No</th>
                </tr>
                <tr>
                    <td>${reservation.guest?.nationality || ''}</td>
                    <td>${reservation.adults + reservation.children || 1}</td>
                    <td>${reservation.adults || 1} / ${reservation.children || 0}</td>
                    <td>${reservation.guest?.guestCode || 'N/A'}</td>
                    <td>${reservation.roomNumber || 'N/A'}</td>
                </tr>
            </table>

            <!-- Stay Details Table -->
            <table class="stay-table">
                <tr>
                    <th>Date of Arrival</th>
                    <td>${new Date(reservation.arrivalDate).toLocaleDateString('fr-FR')}</td>
                    <th>Date of Departure</th>
                    <td>${new Date(reservation.departureDate).toLocaleDateString('fr-FR')}</td>
                    <th>Tariff</th>
                    <td>${reservation.tariff || '0'}</td>
                </tr>
                <tr>
                    <th>Time Of Arrival</th>
                    <td>${reservation.checkInTime}</td>
                    <th>Time of Departure</th>
                    <td>${reservation.checkOutTime}</td>
                    <th>Rate Type</th>
                    <td>${reservation.rateType || 'N/A'}</td>
                </tr>
            </table>

            <!-- Charges Table -->
            <table class="charges-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref.No.</th>
                        <th>Particular</th>
                        <th class="text-right">Charges</th>
                        <th class="text-right">Payment</th>
                        <th class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${
                      transactions
                        ?.map(
                          (transaction, index) => `
                    <tr>
                        <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                        <td>${transaction.transactionNumber || ''}</td>
                        <td>${transaction.description}</td>
                        <td class="text-right">${(transaction.amount || 0) > 0 ? this.formatAmount(transaction.amount) : '0'}</td>
                        <td class="text-right">${(transaction.amount || 0) < 0 ? this.formatAmount(Math.abs(transaction.amount)) : '0'}</td>
                        <td class="text-right">${this.formatAmount(transaction.balance)}</td>
                    </tr>
                    `
                        )
                        .join('') ||
                      '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'
                    }
                </tbody>
            </table>

            <!-- Totals Section -->
            <div class="totals-section">
                <table>
                    <tr>
                        <td style="width: 85%; text-align: right;" class="label">Grand Total</td>
                        <td style="width: 5%; text-align: right;">${totals.totalChargesWithTaxes?.toLocaleString() || '0'}</td>
                        <td style="width: 5%; text-align: right;">-${totals.totalPayments?.toLocaleString() || '0'}</td>
                        <td style="width: 5%;"></td>
                    </tr>
                    <tr>
                        <td style="text-align: right;" class="label">Tax</td>
                        <td style="text-align: right;">${this.formatCurrency(totals.totalTaxes)}</td>
                        <td></td>
                        <td></td>
                    </tr>
                </table>
            </div>

            <!-- Amount in words section -->
            <div class="amount-in-words">
                <table>
                    <tr>
                        <td style="width: 20%;" class="label">This Folio is in :</td>
                        <td style="width: 30%;">${this.formatCurrency(totals.totalChargesWithTaxes || 0)}XAF</td>
                        <td style="width: 30%;">${amountInWords}</td>
                        <td style="width: 10%;" class="label">Total Paid</td>
                        <td style="width: 10%; text-align: right;">${this.formatCurrency(totals.totalPayments || 0)}</td>
                    </tr>
                    <tr>
                        <td colspan="3"></td>
                        <td class="label">Balance</td>
                        <td style="text-align: right;">${this.formatCurrency(totals.outstandingBalance || 0)}</td>
                    </tr>
                </table>
            </div>

            <!-- Bill To Section -->
            <div class="bill-to-section">
                <table>
                    <tr>
                        <td style="width: 10%;" class="label">Bill To</td>
                        <td style="width: 40%;">: ${reservation.guest?.displayName || 'N/A'}</td>
                        <td style="width: 50%;"></td>
                    </tr>
                    <tr>
                        <td class="label">Address</td>
                        <td>: ${reservation.guest?.address || reservation.guest?.country || 'N/A'}</td>
                        <td></td>
                    </tr>
                    <tr>
                        <td class="label">Remark</td>
                        <td></td>
                        <td></td>
                    </tr>
                </table>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Thank you for your stay with us. Please visit us again.</p>
            </div>

            <!-- Folio Notice -->
            <div class="folio-notice">
                <p>Folio NOTICE</p>
                <p>Folio NOTICE</p>
            </div>

            <!-- Verification Info -->
            <div class="verification-info">
                <table>
                    <tr>
                        <td style="width: 33%;"><span class="label">Reserved By :</span> ${reservation.reservedBy || 'N/A'}</td>
                        <td style="width: 33%;"><span class="label">Checked In By :</span> ${reservation.checkedInBy || 'N/A'}</td>
                        <td style="width: 33%;"><span class="label">Checked Out By :</span> ${reservation.checkedOutBy || 'N/A'}</td>
                        <td style="width: 33%;"><span class="label">Modified by :</span> ${reservation.modifier || 'N/A'}</td>
                    </tr>
                    </tr>
                </table>
            </div>

            <!-- Page Info -->
            <div class="page-info">
                Page 1 of 1
            </div>

        </div>
    </body>
    </html>`
  }

  /**
   * Generate HTML template for booking confirmation
   */
  private static generateBookingHtmlTemplate(data: FolioPrintData): string {
    const { hotel, reservation, totals, currency, billingAddress } = data

    return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Booking Confirmation - ${reservation.confirmationCode}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                background: white;
                padding: 20px;
            }

            .print-page {
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
            }

            .border-classic {
                border: 2px solid #333;
                padding: 16px;
            }
            .border-2{
            border: 2px solid #333;
            padding: 3px;
        margin-bottom: 16px;
            }
        .border-1{
            border: 1px solid #333;
            padding: 3px;
        margin-bottom: 16px;
            }
        .border-header{
            border: 1px solid #333;
            padding: 3px;
            }
        .border-1-inside{
            border: 1px solid #333;
            padding: 6px;
            }
            .flex {
                display: flex;
            }

            .justify-between {
                justify-content: space-between;
            }

            .items-start {
                align-items: flex-start;
            }

            .text-right {
                text-align: right;
            }

            .text-center {
                text-align: center;
            }

            .p-4 {
                padding: 16px;
            }

            .p-3 {
                padding: 12px;
            }

            .mb-4 {
                margin-bottom: 16px;
            }

            .mb-2 {
                margin-bottom: 8px;
            }

            .mt-2 {
                margin-top: 8px;
            }

            .mt-4 {
                margin-top: 16px;
            }

            .mt-6 {
                margin-top: 24px;
            }

            .text-sm {
                font-size: 14px;
            }

            .text-lg {
                font-size: 18px;
            }

            .text-xl {
                font-size: 20px;
            }

            .font-bold {
                font-weight: bold;
            }

            .bg-gray-200 {
                background-color: #edf2f7;
            }

            .data-grid {
                display: grid;
                width: 100%;
                gap: 1px;
                background-color: #cbd5e0;
            }

            .grid-header {
                display: contents;
            }

            .grid-header-cell {
                padding: 4px 8px;
                background-color: #edf2f7;
                font-weight: bold;
                text-align: left;
                width: 100%;
            }

            .grid-row {
                display: contents;
            }

            .grid-cell {
                padding: 4px 8px;
                background-color: white;
                text-align: left;
            }

            .room-details-grid {
                grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
            }

            .rates-grid {
                grid-template-columns: 2fr 1fr;
            }

            .rates-grid .grid-header-cell:last-child,
            .rates-grid .grid-cell:last-child {
                text-align: right;
                justify-self: end;
            }

            .border-2 {
                border-width: 2px;
            }

            .border-black {
                border-color: #000;
            }

            .border-t {
            }

            .list-disc {
                list-style-type: disc;
            }

            .pl-5 {
                padding-left: 20px;
            }

            u {
                text-decoration: underline;
            }

            em {
                font-style: italic;
            }

            .grid {
                display: grid;
            }

            .grid-cols-2 {
                grid-template-columns: repeat(2, 1fr);
            }

            .gap-2 {
                gap: 8px;
            }
        </style>
    </head>
    <body>
        <div class="print-page p-4">
            <!-- Main Header Box -->
            <div class='border-2'>
            <div class="border-classic">
                <div class="flex justify-between">
                    <div>
                        <h1 class="text-lg font-bold mb-2">BOOKING CONFIRMATION</h1>
                        <div class="mb-2">
                            <strong>BOOKING REFERENCE NO</strong><br>
                            <span class="text-xl font-bold">: ${reservation.reservationNumber}</span>
                        </div>
                        <div class="text-sm">
                            Kindly print this confirmation and have it<br>
                            ready upon check-in at the Hotel
                        </div>
                    </div>
                    <div class="text-right">
                        <h2 class="text-lg font-bold">${hotel.hotelName}</h2>
                        <div class="text-sm mt-2">
                            ${hotel.address}<br>
                            ${hotel.city}, ${hotel.country}<br>
                            <u>${hotel.email}</u><br>
                            Phone : ${hotel.phoneNumber}
                        </div>
                    </div>
                </div>
            </div>
            </div>

            <!-- Guest Information -->
            <div class="mb-4">
                <p class="text-sm">Dear ${reservation.guest?.displayName},</p>
                <p class="text-sm mt-2">
                    Thank you for choosing ${hotel.hotelName} for your stay. We are pleased to inform you that your
                    reservation request is CONFIRMED and your reservation details are as follows.
                </p>
            </div>

            <!-- Booking Details -->
            <div class="mb-4">
                <h3 class="font-bold mb-2">Booking Details</h3>
                <div class="text-sm grid grid-cols-2 gap-2">
                    <div>Booking Date : ${this.formatDate(data.printInfo.printedDate.toString())}</div>
                    <div>Check In Date : ${this.formatDate(reservation.arrivedDate!.toString())}</div>
                    <div>Check Out Date : ${this.formatDate(reservation.departDate!.toString())}</div>
                    <div>Nights : ${reservation.numberOfNights}</div>
                    <div>Arrival Time : ${reservation.checkInTime}</div>
                    <div>Special Request : ${reservation.specialRequests ?? ''}</div>
                </div>
            </div>

            <!-- Your Details -->
            <div class="mb-4">
                <h3 class="font-bold mb-2">Your Details</h3>
                <div class="text-sm">
                    ${reservation.guest?.displayName}<br>
                    Email ID : ${billingAddress?.email || reservation.guest?.email || 'N/A'}<br>
                    Phone : ${billingAddress?.phone || reservation.guest?.phonePrimary || 'N/A'}
                </div>
            </div>

            <!-- Room Details -->
            <div class="mb-4">
                <h3 class="font-bold mb-2">Room Details</h3>
                <div class="border-header mb-2">
                <div class="data-grid room-details-grid border-1-inside">
                    <div class="grid-header">
                        <div class="grid-header-cell">Room Type</div>
                        <div class="grid-header-cell">Guest(s)</div>
                        <div class="grid-header-cell">No of rooms</div>
                        <div class="grid-header-cell">Package if any</div>
                        <div class="grid-header-cell">Promotion if any</div>
                    </div>
                    </div></div>
                    <div class="data-grid room-details-grid">
                    ${reservation.reservationRooms
                      ?.map(
                        (room) => `
                    <div class="grid-row">
                        <div class="grid-cell"><strong>${room.roomType?.roomTypeName} ${room.roomRates?.rateType?.rateTypeName ?? ''}</strong></div>
                        <div class="grid-cell">${room.adults || 1} Adults, ${room.children || 0} Children</div>
                        <div class="grid-cell">1</div>
                        <div class="grid-cell">none</div>
                        <div class="grid-cell">none</div>
                    </div>`
                      )
                      .join('')}
                </div>
            </div>

            <!-- Rates Details -->
            <div class="mb-4">
                <h3 class="font-bold mb-2">Rates Details</h3>
                <div class="border-header mb-2">
                <div class="data-grid rates-grid border-1-inside">
                    <div class="grid-header">
                        <div class="grid-header-cell ">Details</div>
                        <div class="grid-header-cell text-right">Rates (${currency.code})</div>
                    </div>
                    </div>
                    </div>
                <div class="data-grid rates-grid">
                    <div class="grid-row">
                        <div class="grid-cell">Total Room Charges</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalCharges)}</div>
                    </div>
                    <div class="grid-row">
                        <div class="grid-cell">Room Charges Tax</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalTaxes)}</div>
                    </div>
                    <div class="grid-row">
                        <div class="grid-cell">Service Charges</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalServiceCharges)}</div>
                    </div>
                    <div class="grid-row">
                        <div class="grid-cell">Extra Charges Including Discounts and Tax</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalDiscounts)}</div>
                    </div>
                    <div class="grid-row">
                        <div class="grid-cell">Round off</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalDiscounts)}</div>
                    </div>
                    <div class="grid-row font-bold">
                        <div class="grid-cell font-bold">Grand Total</div>
                        <div class="grid-cell text-right font-bold">${this.formatAmount(totals.totalChargesWithTaxes)}</div>
                    </div>
                    <div class="grid-row">
                        <div class="grid-cell">Total Paid</div>
                        <div class="grid-cell text-right">${this.formatAmount(totals.totalPayments)}</div>
                    </div>
                    <div class="grid-row font-bold">
                        <div class="grid-cell font-bold">Amount due at time of check in</div>
                        <div class="grid-cell text-right font-bold">${this.formatAmount(totals.outstandingBalance)}</div>
                    </div>
                </div>
            </div>

            <!-- Booking Amount Box -->
            <div class="flex justify-between items-start mb-4">
                <div class="border-1">
                    <div class="text-center font-bold border-1-inside">
                    <h2>BOOKING AMOUNT</h2>
                    <h3> ${this.formatAmount(totals.totalChargesWithTaxes)} ${currency.code}</h3>
                    </div>
                </div>
                <div class="text-right text-sm">
                    <strong>Booked & Payable By</strong><br>
                    ${reservation.guest?.displayName}
                </div>
            </div>

            <!-- Conditions & Policies -->
            <div class="mb-4">
            <div class='border-1'>
            <div class='border-1-inside'>
                                    <h3 class="font-bold bg-gray-200">Conditions & Policies</h3>
            </div>
            </div>

                <div class="text-sm mt-6">

                    <div>
                    <h3 class="font-bold">Cancellation Policy</h3>
                    <p>${hotel.cancellationPolicy}</>
                    <div/>
                    <div>
                    <h3 class="font-bold">Hotel Policy</h3>
                    <p>${hotel.hotelPolicy}</p>
                    <div/>
                    <p><strong>Hotel Check in Time:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkInTime ?? '12:00'}</p>
                    <p><strong>Hotel Check out Time:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkOutTime ?? '12:00'}</p>
                    <div class="mt-4 font-bold text-center">
                        <em>This email has been sent from an automated system - please do not reply to it.</em>
                    </div>

                    <div class="mt-6 mb-4 pt-4 border-t">
                        <strong>**** FOR ANY FURTHER QUERY ****</strong><br>
                        Contact us by Email Id ${hotel.email}<br>
                        Phone NO : ${hotel.phoneNumber}<br>
                        ${hotel.address}, ${hotel.city}, ${hotel.country}
                    </div>
                    <div class="border-t"></div>
                </div>
            </div>
        </div>
    </body>
    </html>
        `
  }

  /**
   * Generate HTML template for booking confirmation
   */
  private static generateBookingHtmlTemplateFrench(data: FolioPrintData): string {
    const { hotel, reservation, totals, currency, billingAddress } = data

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Confirmation de Réservation - ${reservation.confirmationCode}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            line-height: 1.4;
            color: #333;
            background: white;
            padding: 20px;
        }

        .print-page {
            width: 100%;
            max-width: 800px;
            margin: 0 auto;
        }

        .border-classic {
            border: 2px solid #333;
            padding: 16px;
        }
        .border-2{
         border: 2px solid #333;
         padding: 3px;
    margin-bottom: 16px;
        }
    .border-1{
         border: 1px solid #333;
         padding: 3px;
    margin-bottom: 16px;
        }
    .border-header{
         border: 1px solid #333;
         padding: 3px;
        }
     .border-1-inside{
         border: 1px solid #333;
         padding: 6px;
        }
        .flex {
            display: flex;
        }

        .justify-between {
            justify-content: space-between;
        }

        .items-start {
            align-items: flex-start;
        }

        .text-right {
            text-align: right;
        }

        .text-center {
            text-align: center;
        }

        .p-4 {
            padding: 16px;
        }

        .p-3 {
            padding: 12px;
        }

        .mb-4 {
            margin-bottom: 16px;
        }

        .mb-2 {
            margin-bottom: 8px;
        }

        .mt-2 {
            margin-top: 8px;
        }

        .mt-4 {
            margin-top: 16px;
        }

        .mt-6 {
            margin-top: 24px;
        }

        .text-sm {
            font-size: 14px;
        }

        .text-lg {
            font-size: 18px;
        }

        .text-xl {
            font-size: 20px;
        }

        .font-bold {
            font-weight: bold;
        }

        .bg-gray-200 {
            background-color: #edf2f7;
        }

        .data-grid {
            display: grid;
            width: 100%;
            gap: 1px;
            background-color: #cbd5e0;
        }

        .grid-header {
            display: contents;
        }

        .grid-header-cell {
            padding: 4px 8px;
            background-color: #edf2f7;
            font-weight: bold;
            text-align: left;
            width: 100%;
        }

        .grid-row {
            display: contents;
        }

        .grid-cell {
            padding: 4px 8px;
            background-color: white;
            text-align: left;
        }

        .room-details-grid {
            grid-template-columns: 2fr 1fr 1fr 1fr 1fr;
        }

        .rates-grid {
            grid-template-columns: 2fr 1fr;
        }

        .rates-grid .grid-header-cell:last-child,
        .rates-grid .grid-cell:last-child {
            text-align: right;
            justify-self: end;
        }

        .border-2 {
            border-width: 2px;
        }

        .border-black {
            border-color: #000;
        }

        .border-t {
        }

        .list-disc {
            list-style-type: disc;
        }

        .pl-5 {
            padding-left: 20px;
        }

        u {
            text-decoration: underline;
        }

        em {
            font-style: italic;
        }

        .grid {
            display: grid;
        }

        .grid-cols-2 {
            grid-template-columns: repeat(2, 1fr);
        }

        .gap-2 {
            gap: 8px;
        }
    </style>
</head>
<body>
    <div class="print-page p-4">
        <!-- En-tête Principal -->
        <div class='border-2'>
        <div class="border-classic">
            <div class="flex justify-between">
                <div>
                    <h1 class="text-lg font-bold mb-2">CONFIRMATION DE RÉSERVATION</h1>
                    <div class="mb-2">
                        <strong>NUMÉRO DE RÉFÉRENCE</strong><br>
                        <span class="text-xl font-bold">: ${reservation.reservationNumber}</span>
                    </div>
                    <div class="text-sm">
                        Veuillez imprimer cette confirmation et l'avoir<br>
                        à portée de main lors de votre arrivée à l'hôtel
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-lg font-bold">${hotel.hotelName}</h2>
                    <div class="text-sm mt-2">
                        ${hotel.address}<br>
                        ${hotel.city}, ${hotel.country}<br>
                        <u>${hotel.email}</u><br>
                        Téléphone : ${hotel.phoneNumber}
                    </div>
                </div>
            </div>
        </div>
        </div>

        <!-- Informations Client -->
        <div class="mb-4">
            <p class="text-sm">Cher(e) ${reservation.guest?.displayName},</p>
            <p class="text-sm mt-2">
                Merci d'avoir choisi ${hotel.hotelName} pour votre séjour. Nous avons le plaisir de vous informer que votre
                demande de réservation est CONFIRMÉE et les détails de votre réservation sont les suivants.
            </p>
        </div>

        <!-- Détails de la Réservation -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Détails de la Réservation</h3>
            <div class="text-sm grid grid-cols-2 gap-2">
                <div>Date de réservation : ${this.formatDate(data.printInfo.printedDate.toString())}</div>
                <div>Date d'arrivée : ${this.formatDate(reservation.arrivedDate!.toString())}</div>
                <div>Date de départ : ${this.formatDate(reservation.departDate!.toString())}</div>
                <div>Nuits : ${reservation.numberOfNights}</div>
                <div>Heure d'arrivée : ${reservation.checkInTime}</div>
                <div>Demandes spéciales : ${reservation.specialRequests ?? ''}</div>
            </div>
        </div>

        <!-- Vos Coordonnées -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Vos Coordonnées</h3>
            <div class="text-sm">
                ${reservation.guest?.displayName}<br>
                Email : ${billingAddress?.email || reservation.guest?.email || 'N/A'}<br>
                Téléphone : ${billingAddress?.phone || reservation.guest?.phonePrimary || 'N/A'}
            </div>
        </div>

        <!-- Détails des Chambres -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Détails des Chambres</h3>
            <div class="border-header mb-2">
            <div class="data-grid room-details-grid border-1-inside">
                <div class="grid-header">
                    <div class="grid-header-cell">Type de Chambre</div>
                    <div class="grid-header-cell">Occupant(s)</div>
                    <div class="grid-header-cell">Nombre de chambres</div>
                    <div class="grid-header-cell">Forfait le cas échéant</div>
                    <div class="grid-header-cell">Promotion le cas échéant</div>
                </div>
                </div></div>
                  <div class="data-grid room-details-grid">
                ${reservation.reservationRooms
                  ?.map(
                    (room) => `
                <div class="grid-row">
                    <div class="grid-cell"><strong>${room.roomType?.roomTypeName} ${room.roomRates?.rateType?.rateTypeName ?? ''}</strong></div>
                    <div class="grid-cell">${room.adults || 1} Adultes, ${room.children || 0} Enfants</div>
                    <div class="grid-cell">1</div>
                    <div class="grid-cell">aucun</div>
                    <div class="grid-cell">aucune</div>
                </div>`
                  )
                  .join('')}
            </div>
        </div>

        <!-- Détails des Tarifs -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Détails des Tarifs</h3>
            <div class="border-header mb-2">
            <div class="data-grid rates-grid border-1-inside">
                <div class="grid-header">
                    <div class="grid-header-cell ">Détails</div>
                    <div class="grid-header-cell text-right">Tarifs (${currency.code})</div>
                </div>
                </div>
                </div>
            <div class="data-grid rates-grid">
                <div class="grid-row">
                    <div class="grid-cell">Total des charges de chambre</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalCharges)}</div>
                </div>
                <div class="grid-row">
                    <div class="grid-cell">Taxes sur les chambres</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalTaxes)}</div>
                </div>
                <div class="grid-row">
                    <div class="grid-cell">Frais de service</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalServiceCharges)}</div>
                </div>
                <div class="grid-row">
                    <div class="grid-cell">Charges supplémentaires incluant remises et taxes</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalDiscounts)}</div>
                </div>
                <div class="grid-row">
                    <div class="grid-cell">Arrondi</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalDiscounts)}</div>
                </div>
                <div class="grid-row font-bold">
                    <div class="grid-cell font-bold">Total Général</div>
                    <div class="grid-cell text-right font-bold">${this.formatAmount(totals.totalChargesWithTaxes)}</div>
                </div>
                <div class="grid-row">
                    <div class="grid-cell">Total Payé</div>
                    <div class="grid-cell text-right">${this.formatAmount(totals.totalPayments)}</div>
                </div>
                <div class="grid-row font-bold">
                    <div class="grid-cell font-bold">Montant dû à l'arrivée</div>
                    <div class="grid-cell text-right font-bold">${this.formatAmount(totals.outstandingBalance)}</div>
                </div>
            </div>
        </div>

        <!-- Boîte Montant de la Réservation -->
        <div class="flex justify-between items-start mb-4">
            <div class="border-1">
                <div class="text-center font-bold border-1-inside">
                  <h2>MONTANT DE LA RÉSERVATION</h2>
                   <h3> ${this.formatAmount(totals.totalChargesWithTaxes)} ${currency.code}</h3>
                </div>
            </div>
            <div class="text-right text-sm">
                <strong>Réservé & Payable Par</strong><br>
                ${reservation.guest?.displayName}
            </div>
        </div>

        <!-- Conditions & Politiques -->
        <div class="mb-4">
        <div class='border-1'>
        <div class='border-1-inside'>
                                <h3 class="font-bold bg-gray-200">Conditions & Politiques</h3>
        </div>
        </div>

            <div class="text-sm mt-6">

                <div>
                <h3 class="font-bold">Politique d'Annulation</h3>
                <p>${hotel.cancellationPolicy}</>
                <div/>
                <div>
                <h3 class="font-bold">Politique de l'Hôtel</h3>
                <p>${hotel.hotelPolicy}</p>
                <div/>
                <p><strong>Heure d'arrivée à l'hôtel:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkInTime ?? '12:00'}</p>
                 <p><strong>Heure de départ de l'hôtel:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkOutTime ?? '12:00'}</p>
                <div class="mt-4 font-bold text-center">
                    <em>Cet email a été envoyé depuis un système automatisé - merci de ne pas y répondre.</em>
                </div>

                <div class="mt-6 mb-4 pt-4 border-t">
                    <strong>**** POUR TOUTE DEMANDE SUPPLÉMENTAIRE ****</strong><br>
                    Contactez-nous par Email : ${hotel.email}<br>
                    Téléphone : ${hotel.phoneNumber}<br>
                    ${hotel.address}, ${hotel.city}, ${hotel.country}
                </div>
                <div class="border-t"></div>
            </div>
        </div>
    </div>
</body>
</html>
        `
  }
  /**
   * Generate PDF using the Suita Hotel template
   */
  static async generateSuitaHotelPdf(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      // Generate HTML content
      const htmlContent = this.generateHotelHtmlTemplate(folioPrintData)

      // PDF generation options for html-pdf-node (puppeteer-style)
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      throw new Error(`Failed to generate Suita Hotel PDF: ${error.message}`)
    }
  }
  static async generateSuitaHotelPdfFrench(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    try {
      // Default PDF options
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      // Generate HTML content
      const htmlContent = this.generateHotelHtmlTemplateFrench(folioPrintData)

      // PDF generation options for html-pdf-node (puppeteer-style)
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      throw new Error(`Failed to generate Suita Hotel PDF: ${error.message}`)
    }
  }
  /**
   * Generate HTML template for Suita Hotel
   */

  /** Nettoie le HTML d'une policy. Retourne '' si vide. */
  private static cleanPolicyHtml(value?: string | null): string {
    if (!value || !value.trim()) return ''

    // Ancien texte brut -> HTML
    let html = value
    if (!/<[a-z][\s\S]*>/i.test(html)) {
      html = this.escapeHtml(html).replace(/\n/g, '<br>')
    }

    const color = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i]

    const clean = sanitizeHtml(html, {
      allowedTags: [
        'p',
        'br',
        'div',
        'span',
        'strong',
        'b',
        'em',
        'i',
        'u',
        's',
        'strike',
        'sub',
        'sup',
        'ul',
        'ol',
        'li',
        'h1',
        'h2',
        'h3',
        'blockquote',
        'pre',
        'a',
        'hr',
        'table',
        'thead',
        'tbody',
        'tr',
        'td',
        'th',
      ],
      allowedAttributes: {
        '*': ['style'],
        'a': ['href'],
        'td': ['colspan', 'rowspan'],
        'th': ['colspan', 'rowspan'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      allowedStyles: {
        '*': {
          'font-weight': [/^(bold|normal|[1-9]00)$/],
          'font-style': [/^(italic|normal)$/],
          'text-decoration': [/^(underline|line-through|none)(\s+(underline|line-through))*$/],
          'text-decoration-line': [/^(underline|line-through|none)$/],
          'text-align': [/^(left|right|center|justify)$/],
          'color': color,
          'background-color': color,
          'font-size': [/^[a-z-]+$/, /^\d+(\.\d+)?(px|pt|em|rem|%)$/],
          'border': [/^[\w\s#.,()%-]+$/],
          'padding': [/^[\d\s.pxemrt%]+$/],
          'border-collapse': [/^(collapse|separate)$/],
          'width': [/^\d+(\.\d+)?(px|%)$/],
        },
      },
    })

    // S'il ne reste aucun texte (ex: <div><br></div>) -> vide
    const textOnly = clean
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim()
    return textOnly ? clean : ''
  }

  /** Bloc "Folio NOTICE + policies" : retourne '' si aucune policy */
  private static generatePoliciesHtml(hotel: any, french: boolean): string {
    const notices = hotel?.notices ?? {}

    const blocks = [
      {
        title: french ? "Politique de l'hôtel" : 'Hotel Policy',
        html: this.cleanPolicyHtml(notices.folio),
      },
      {
        title: french ? "Politique d'annulation" : 'Cancellation Policy',
        html: this.cleanPolicyHtml(notices.cancellation),
      },
    ].filter((b) => b.html)

    if (blocks.length === 0) return ''

    return `
        <div class="policies">
          ${blocks
            .map(
              (b) => `
            <div class="policy-block">
              <div class="policy-title">${b.title}</div>
              <div class="policy-text">${b.html}</div>
            </div>`
            )
            .join('')}
        </div>`
  }

  private static formatCurrency(amount: number): string {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '0'
    }
    return `${Math.round(Number(amount)).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
  }

  private static escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  }


  private static generateHotelHtmlTemplate(
    data: FolioPrintData | HotelInvoiceTemplateData,
    detailed = false
  ): string {
    const { hotel, reservation, folio, transactions, totals, currency } =
      data as HotelInvoiceTemplateData

    // Convert amount to words
    const amountInWords = this.numberToWords(totals.totalChargesWithTaxes)

    // Fiscal parameters + room/tax summary (detailed invoice only)
    const extras = detailed ? this.buildDetailedInvoiceExtras(data, false) : null

    // Policies (page dédiée si présentes)
    const policiesHtml = this.generatePoliciesHtml(hotel, false)
    const hasPoliciesPage = !!policiesHtml

    // Pagination: diviser les transactions en groupes de 10
    // const TRANSACTIONS_PER_PAGE = 10;
    // const transactionPages: any[][] = [];

    // if (transactions && transactions.length > 0) {
    //     for (let i = 0; i < transactions.length; i += TRANSACTIONS_PER_PAGE) {
    //         transactionPages.push(transactions.slice(i, i + TRANSACTIONS_PER_PAGE));
    //     }
    // } else {
    //     transactionPages.push([]);
    // }
    const FULL_PAGE_ROWS = 15
    const LAST_PAGE_ROWS = extras ? 4 : 8
    const transactionPages: any[][] = []
    const remaining = [...(transactions ?? [])]

    if (remaining.length === 0) {
      transactionPages.push([])
    } else {
      while (remaining.length > LAST_PAGE_ROWS) {
        transactionPages.push(remaining.splice(0, Math.min(FULL_PAGE_ROWS, remaining.length - 1)))
      }
      transactionPages.push(remaining)
    }

    const totalPages = transactionPages.length + (hasPoliciesPage ? 1 : 0)

    // Header + détails facture (répétés sur chaque page, y compris la dernière)
    const headerHtml = `
            <!-- Header -->
            <div class="header">
                <div class="registration-info">
                    <p>M${hotel.registrationNumber || 'N/A'}</p>
                    <p>RC${hotel.rcNumber || 'N/A'}</p>
                </div>
                <div class="hotel-info">
                    <h1>${hotel.name}</h1>
                    <div class="hotel-details">
                        <p>${hotel.address}</p>
                        <p>Phone: ${hotel.phone}; Email: ${hotel.email}</p>
                        <p>URL: ${hotel.website || 'N/A'}</p>
                    </div>
                    <div class="tax-invoice">Tax Invoice</div>
                </div>
            </div>

            <!-- Invoice Details -->
            <div class="invoice-details">
                <table class="details-table">
                    <tr>
                        <td style="width: 50%;">
                            <div><span class="font-bold">Folio No./Res No.</span> ${folio.folioNumber} / ${folio.reservationNumber || 'N/A'}</div>
                            <div><span class="font-bold">Guest Name</span> : ${reservation.guest?.displayName || 'N/A'}</div>
                            <div><span class="font-bold">Company Name</span> : ${reservation.company || 'N/A'}</div>
                        </td>
                        <td style="width: 25%;"></td>
                        <td style="width: 25%;">
                            <div><span class="font-bold">Date:</span> ${new Date().toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                            ${extras ? extras.fiscal : ''}
                        </td>
                    </tr>
                </table>
            </div>
        `
    const headerHtmlLastPage = `
            <!-- Header -->
            <div class="header">
                <div class="registration-info">
                    <p>M${hotel.registrationNumber || 'N/A'}</p>
                    <p>RC${hotel.rcNumber || 'N/A'}</p>
                </div>
                <div class="hotel-info">
                    <h1>${hotel.name}</h1>
                    <div class="hotel-details">
                        <p>${hotel.address}</p>
                        <p>Phone: ${hotel.phone}; Email: ${hotel.email}</p>
                        <p>URL: ${hotel.website || 'N/A'}</p>
                    </div>
                    <div class="tax-invoice">Tax Invoice</div>
                </div>
            </div>

        `

    // Suivi utilisateur + footer
    const trackingFooterHtml = `
            <!-- User Tracking Information -->
            <div class="user-tracking">
                <div><span class="font-bold">Reserved By:</span> ${reservation.reservedBy || 'N/A'}</div>
                <div><span class="font-bold">Checked In By:</span> ${reservation.checkedInBy || 'N/A'}</div>
                <div><span class="font-bold">Checked Out By:</span> ${reservation.checkedOutBy || 'N/A'}</div>
            </div>

            <!-- Footer -->
            <div class="footer">
                <p>Thank you for your stay with us. Please visit us again.</p>
            </div>
        `

    const continuedNotice = `
            <div class="continued-notice">Continued on next page...</div>
        `

    // Fonction pour générer les lignes de transactions d'une page
    const generateTransactionRows = (pageTransactions: any[]) => {
      if (pageTransactions.length === 0) {
        return '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'
      }

      return pageTransactions
        .map(
          (transaction, index) => `
                <tr>
                    <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                    <td>${(transaction.amount || 0) < 0 ? transaction.transactionNumber || '' : ''}</td>
                    <td>${transaction.description}</td>
                    <td class="text-right">${(transaction.amount || 0) > 0 ? this.formatCurrency(transaction.amount) : this.formatCurrency(0)}</td>
                    <td class="text-right">${(transaction.amount || 0) < 0 ? this.formatCurrency(Math.abs(transaction.amount)) : this.formatCurrency(0)}</td>
                    <td class="text-right">${this.formatCurrency(transaction.balance)}</td>
                </tr>
            `
        )
        .join('')
    }

    // Page de transactions
    const generatePage = (pageTransactions: any[], pageNumber: number) => {
      const isLastTxPage = pageNumber === transactionPages.length

      const lastTxContent = `
                <!-- Totals Section -->
                <div class="totals-section">
                    <div class="total-line">
                        <span class="font-bold">Grand Total</span>
                        <span style="margin-left: 30px;">${this.formatCurrency(totals.totalChargesWithTaxes || 0)}</span>
                        <span style="margin-left: 30px;">-${this.formatCurrency(totals.totalPayments || 0)}</span>
                    </div>
                    <div>
                        <span class="font-bold">Tax</span>
                        <span style="margin-left: 60px;">${this.formatCurrency(totals.totalTaxes || 0)}</span>
                    </div>
                </div>

                <!-- Amount in Words -->
                <div class="amount-words">
                    <table class="amount-table">
                        <tr>
                            <td class="font-bold" style="width: 25%;">This Folio is in ${currency.code}</td>
                            <td style="width: 35%;">${amountInWords}</td>
                            <td class="font-bold" style="width: 20%;">Total Paid</td>
                            <td class="text-right" style="width: 20%;">${this.formatCurrency(totals.totalPayments || 0)}</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td></td>
                            <td class="font-bold">Balance</td>
                            <td class="text-right">${this.formatCurrency(totals.outstandingBalance)}</td>
                        </tr>
                    </table>
                </div>

                <!-- Bill To Section -->
                <div class="bill-to">
                    <div style="margin-bottom: 8px;">
                        <span class="font-bold">Bill To</span>
                        <span style="margin-left: 40px;">: ${reservation.guest?.displayName || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-bold">Address</span>
                        <span style="margin-left: 35px;">: ${reservation.guest?.address || reservation.guest?.country || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-bold">Remark</span>
                    </div>
                </div>

                ${extras ? extras.summary : ''}

                ${hasPoliciesPage ? continuedNotice : trackingFooterHtml}
            `

      return `
                <div class="container" style="${pageNumber > 1 ? 'page-break-before: always;' : ''}">
                    ${headerHtml}

                    <!-- Guest Details & Stay Details - Combined Table -->
                    <table class="header-table">
                        <colgroup>
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 24%;">
                            <col style="width: 18%;">
                            <col style="width: 18%;">
                        </colgroup>
                        <tr>
                            <th colspan="2">Nationality</th>
                            <th>No of Pax</th>
                            <th colspan="2">Adult Child</th>
                            <th>G.R. Card No</th>
                            <th colspan="2" style="border:none; border-bottom: none; border-top: none">Room No</th>
                        </tr>
                        <tr>
                            <td colspan="2"></td>
                            <td style="border:none;">${reservation.adults + reservation.children || 1}</td>
                            <td colspan="2">${reservation.adults || 1} / ${reservation.children || 0}</td>
                            <td>${reservation.guest?.guestCode || 'N/A'}</td>
                            <td colspan="2" style="border:none; border-bottom: none; text-align:center;">${reservation.roomNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                            <th colspan="2">Date of Arrival</th>
                            <td>${new Date(reservation.checkInDate).toLocaleDateString('fr-FR')}</td>
                            <th colspan="2">Date of Departure</th>
                            <td>${new Date(reservation.checkOutDate).toLocaleDateString('fr-FR')}</td>
                            <th>Tariff</th>
                            <td>${this.formatCurrency(reservation.tariff || 0)}</td>
                        </tr>
                        <tr>
                            <th colspan="2">Time Of Arrival</th>
                            <td>${reservation.checkInTime}</td>
                            <th colspan="2">Time of Departure</th>
                            <td>${reservation.checkOutTime}</td>
                            <th>Rate Type</th>
                            <td>${reservation.rateType}</td>
                        </tr>
                    </table>

                    <!-- Charges Table -->
                    <div class="charges-table">
                        <table class="header-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Ref.No.</th>
                                    <th>Particular</th>
                                    <th>Charges</th>
                                    <th>Payment</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateTransactionRows(pageTransactions)}
                            </tbody>
                        </table>
                    </div>

                    ${isLastTxPage ? lastTxContent : continuedNotice}

                    <!-- Page Info -->
                    <div class="page-info">
                        Page ${pageNumber} of ${totalPages}
                    </div>
                </div>
            `
    }

    // Dernière page : header + policies
    const generatePoliciesPage = (pageNumber: number) => `
            <div class="container" style="page-break-before: always;">
                ${headerHtmlLastPage}

                <!-- Folio Notice + Policies -->
                ${policiesHtml}

                ${trackingFooterHtml}

                <!-- Page Info -->
                <div class="page-info">
                    Page ${pageNumber} of ${totalPages}
                </div>
            </div>
        `

    // Générer toutes les pages
    const allPages =
      transactionPages
        .map((pageTransactions, index) => generatePage(pageTransactions, index + 1))
        .join('') + (hasPoliciesPage ? generatePoliciesPage(totalPages) : '')

    return `<!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Tax Invoice - ${hotel.name}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                @page {
                    size: A4;
                    margin: 10mm;
                }

                body {
                    font-family: 'Times New Roman', serif;
                    font-size: 12px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    margin: 0;
                    padding: 0;
                }

                .container {
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #000;
                }

                .header {
                    text-align: center;
                    padding: 15px;
                    border-bottom: 1px solid #000;
                    position: relative;
                }

                .hotel-info h1 {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }

                .hotel-details {
                    font-size: 11px;
                    margin-bottom: 15px;
                }

                .policies { padding: 8px  8px 8px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
                .policy-block { margin-bottom: 10px; page-break-inside: avoid; }
                .policy-title {
                    font-size: 11px; font-weight: bold; text-transform: uppercase;
                    letter-spacing: 0.5px; margin-bottom: 3px;
                }
                .policy-text { font-size: 12px; line-height: 1.4; text-align: justify; color: #222; }
                .policy-text p { margin: 0 0 4px; }
                .policy-text h1, .policy-text h2, .policy-text h3 { font-size: 11px; font-weight: bold; margin: 4px 0; }
                .policy-text pre { font-size: 10px; white-space: pre-wrap; }
                .policy-text table { width: 100%; border-collapse: collapse; font-size: 10px; }

                .policy-text div { margin: 0; }
                .policy-text ul, .policy-text ol { margin: 0 0 2px; padding-left: 14px; }
                .policy-text ul { list-style: disc; }
                .policy-text ol { list-style: decimal; }
                .policy-text h1, .policy-text h2, .policy-text h3 { font-size: 9px; font-weight: bold; margin: 2px 0; }
                .policy-text blockquote { margin: 0 0 2px 8px; font-style: italic; }
                .policy-text td, .policy-text th { border: 1px solid #999; padding: 1px 3px; }
                .continued-notice {
                    padding: 8px;
                    font-size: 10px;
                    font-style: italic;
                    text-align: right;
                }

                .tax-invoice {
                    font-size: 12px;
                    font-weight: bold;
                }

                .registration-info {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 10px;
                    text-align: right;
                }

                .invoice-details {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                }

                .details-table {
                    width: 100%;
                    font-size: 10px;
                    border-collapse: collapse;
                }

                .details-table td {
                    padding: 2px 5px;
                    vertical-align: top;
                }

                .charges-table {
                    border-bottom: 1px solid #000;
                }

                .charges-table .amount {
                    text-align: right;
                }

                .totals-section {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                    text-align: center;
                    font-size: 10px;
                }

                .totals-section .total-line {
                    margin-bottom: 5px;
                }

                .amount-words {
                    border-bottom: 1px solid #000;
                }

                .amount-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .amount-table td {
                    border: 1px solid #000;
                    padding: 6px;
                    vertical-align: top;
                }

                .bill-to {
                    padding: 8px;
                    font-size: 10px;
                    border-bottom: 1px solid #000;
                }

                .footer {
                    text-align: center;
                    padding: 15px;
                    font-size: 10px;
                }

                .user-tracking {
                    padding: 8px;
                    font-size: 10px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    border-bottom: 1px solid #000;
                }

                .page-info {
                    text-align: right;
                    padding: 5px;
                    font-size: 10px;
                }

                .font-bold { font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }

                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .header-table th,
                .header-table td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    text-align: left;
                }

                .header-table th {
                    font-weight: bold;
                    background-color: #d3d3d3;
                    text-align: center;
                }

                .header-table td {
                    text-align: center;
                }

                .charges-table .header-table tbody tr td {
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                }

                .charges-table .header-table tbody tr:last-child td {
                    border-bottom: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:first-child {
                    border-left: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:last-child {
                    border-right: 1px solid #000;
                }

                /* Gestion de la pagination automatique */
                .charges-table .header-table tbody tr {
                    page-break-inside: avoid;
                }

                .charges-table .header-table thead {
                    display: table-header-group;
                }

                .charges-table .header-table tfoot {
                    display: table-footer-group;
                }

                @media print {
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .container {
                        page-break-after: always;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }

                    .container:last-child {
                        page-break-after: auto;
                    }
                }
            </style>
        </head>
        <body>
            ${allPages}
        </body>
        </html>`
  }

  private static generateHotelHtmlTemplateFrench(
    data: FolioPrintData | HotelInvoiceTemplateData,
    detailed = false
  ): string {
    const { hotel, reservation, folio, transactions, totals, currency } =
      data as HotelInvoiceTemplateData

    // Convertir le montant en lettres
    const amountInWords = this.numberToWords(totals.totalChargesWithTaxes)

    // Paramètres fiscaux + récapitulatif chambres/taxes (facture détaillée uniquement)
    const extras = detailed ? this.buildDetailedInvoiceExtras(data, true) : null

    // Policies (page dédiée si présentes)
    const policiesHtml = this.generatePoliciesHtml(hotel, true)
    const hasPoliciesPage = !!policiesHtml

    // Pagination : diviser les transactions en groupes de 10
    // const TRANSACTIONS_PER_PAGE = 10;
    // const transactionPages: any[][] = [];

    // if (transactions && transactions.length > 0) {
    //     for (let i = 0; i < transactions.length; i += TRANSACTIONS_PER_PAGE) {
    //         transactionPages.push(transactions.slice(i, i + TRANSACTIONS_PER_PAGE));
    //     }
    // } else {
    //     transactionPages.push([]);
    // }
    const FULL_PAGE_ROWS = 15
    const LAST_PAGE_ROWS = extras ? 4 : 8
    const transactionPages: any[][] = []
    const remaining = [...(transactions ?? [])]

    if (remaining.length === 0) {
      transactionPages.push([])
    } else {
      while (remaining.length > LAST_PAGE_ROWS) {
        transactionPages.push(remaining.splice(0, Math.min(FULL_PAGE_ROWS, remaining.length - 1)))
      }
      transactionPages.push(remaining)
    }

    const totalPages = transactionPages.length + (hasPoliciesPage ? 1 : 0)

    // En-tête + détails facture (répétés sur chaque page, y compris la dernière)
    const headerHtml = `
            <!-- En-tête -->
            <div class="header">
                <div class="registration-info">
                    <p>M${hotel.registrationNumber || 'N/A'}</p>
                    <p>RC${hotel.rcNumber || 'N/A'}</p>
                </div>
                <div class="hotel-info">
                    <h1>${hotel.name}</h1>
                    <div class="hotel-details">
                        <p>${hotel.address}</p>
                        <p>Téléphone: ${hotel.phone}; Email: ${hotel.email}</p>
                        <p>Site web: ${hotel.website || 'N/A'}</p>
                    </div>
                    <div class="tax-invoice">Facture Fiscale</div>
                </div>
            </div>

            <!-- Détails de la facture -->
            <div class="invoice-details">
                <table class="details-table">
                    <tr>
                        <td style="width: 50%;">
                            <div><span class="font-bold">N° Folio / N° Réservation</span> ${folio.folioNumber} / ${folio.reservationNumber || 'N/A'}</div>
                            <div><span class="font-bold">Nom du Client</span> : ${reservation.guest?.displayName || 'N/A'}</div>
                            <div><span class="font-bold">Nom de l'Entreprise</span> : ${reservation.company || 'N/A'}</div>
                        </td>
                        <td style="width: 25%;"></td>
                        <td style="width: 25%;">
                            <div><span class="font-bold">Date:</span> ${new Date().toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                            ${extras ? extras.fiscal : ''}
                        </td>
                    </tr>
                </table>
            </div>
        `

    const headerHtmlLastPage = `
            <!-- En-tête -->
            <div class="header">
                <div class="registration-info">
                    <p>M${hotel.registrationNumber || 'N/A'}</p>
                    <p>RC${hotel.rcNumber || 'N/A'}</p>
                </div>
                <div class="hotel-info">
                    <h1>${hotel.name}</h1>
                    <div class="hotel-details">
                        <p>${hotel.address}</p>
                        <p>Téléphone: ${hotel.phone}; Email: ${hotel.email}</p>
                        <p>Site web: ${hotel.website || 'N/A'}</p>
                    </div>
                    <div class="tax-invoice">Facture Fiscale</div>
                </div>
            </div>
        `

    // Suivi utilisateur + pied de page
    const trackingFooterHtml = `
            <!-- Informations de Suivi Utilisateur -->
            <div class="user-tracking">
                <div>
                    <span class="font-bold">Réservé Par:</span> ${reservation.reservedBy || 'N/A'}
                </div>
                <div>
                    <span class="font-bold">Check-in Par:</span> ${reservation.checkedInBy || 'N/A'}
                </div>
                <div>
                    <span class="font-bold">Check-out Par:</span> ${reservation.checkedOutBy || 'N/A'}
                </div>
            </div>

            <!-- Pied de page -->
            <div class="footer">
                <p>Merci pour votre séjour parmi nous. Au plaisir de vous revoir.</p>
            </div>
        `

    const continuedNotice = `
            <div class="continued-notice">Suite à la page suivante...</div>
        `

    // Fonction pour générer les lignes de transactions d'une page
    const generateTransactionRows = (pageTransactions: any[]) => {
      if (pageTransactions.length === 0) {
        return '<tr><td colspan="6" class="text-center">Aucune transaction trouvée</td></tr>'
      }

      return pageTransactions
        .map(
          (transaction, index) => `
                <tr>
                    <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                    <td>${(transaction.amount || 0) < 0 ? transaction.transactionNumber || '' : ''}</td>
                    <td>${transaction.description}</td>
                    <td class="text-right">${(transaction.amount || 0) > 0 ? this.formatCurrency(transaction.amount) : this.formatCurrency(0)}</td>
                    <td class="text-right">${(transaction.amount || 0) < 0 ? this.formatCurrency(Math.abs(transaction.amount)) : this.formatCurrency(0)}</td>
                    <td class="text-right">${this.formatCurrency(transaction.balance)}</td>
                </tr>
            `
        )
        .join('')
    }

    // Page de transactions
    const generatePage = (pageTransactions: any[], pageNumber: number) => {
      const isLastTxPage = pageNumber === transactionPages.length

      const lastTxContent = `
                <!-- Section Totaux -->
                <div class="totals-section">
                    <div class="total-line">
                        <span class="font-bold">Total Général</span>
                        <span style="margin-left: 30px;">${this.formatCurrency(totals.totalChargesWithTaxes || 0)}</span>
                        <span style="margin-left: 30px;">-${this.formatCurrency(totals.totalPayments || 0)}</span>
                    </div>
                    <div>
                        <span class="font-bold">Taxes</span>
                        <span style="margin-left: 60px;">${this.formatCurrency(totals.totalTaxes || 0)}</span>
                    </div>
                </div>

                <!-- Montant en Lettres -->
                <div class="amount-words">
                    <table class="amount-table">
                        <tr>
                            <td class="font-bold" style="width: 25%;">Ce Folio est en ${currency.code}</td>
                            <td style="width: 35%;">${amountInWords}</td>
                            <td class="font-bold" style="width: 20%;">Total Payé</td>
                            <td class="text-right" style="width: 20%;">${this.formatCurrency(totals.totalPayments || 0)}</td>
                        </tr>
                        <tr>
                            <td></td>
                            <td></td>
                            <td class="font-bold">Solde</td>
                            <td class="text-right">${this.formatCurrency(totals.outstandingBalance)}</td>
                        </tr>
                    </table>
                </div>

                <!-- Section Facturer À -->
                <div class="bill-to">
                    <div style="margin-bottom: 8px;">
                        <span class="font-bold">Facturer À</span>
                        <span style="margin-left: 40px;">: ${reservation.guest?.displayName || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-bold">Adresse</span>
                        <span style="margin-left: 35px;">: ${reservation.guest?.address || reservation.guest?.country || 'N/A'}</span>
                    </div>
                    <div>
                        <span class="font-bold">Remarques</span>
                    </div>
                </div>

                ${extras ? extras.summary : ''}

                ${hasPoliciesPage ? continuedNotice : trackingFooterHtml}
            `

      return `
                <div class="container" style="${pageNumber > 1 ? 'page-break-before: always;' : ''}">
                    ${headerHtml}

                    <!-- Détails du Client & Détails du Séjour - Tableau combiné -->
                    <table class="header-table">
                        <colgroup>
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 10%;">
                            <col style="width: 24%;">
                            <col style="width: 18%;">
                            <col style="width: 18%;">
                        </colgroup>
                        <tr>
                            <th colspan="2">Nationalité</th>
                            <th>Nombre de Personnes</th>
                            <th colspan="2">Adultes / Enfants</th>
                            <th>N° Carte G.R.</th>
                            <th colspan="2" style="border:none; border-bottom: none; border-top: none">N° Chambre</th>
                        </tr>
                        <tr>
                            <td colspan="2"></td>
                            <td style="border:none;">${reservation.adults + reservation.children || 1}</td>
                            <td colspan="2">${reservation.adults || 1} / ${reservation.children || 0}</td>
                            <td>${reservation.guest?.guestCode || 'N/A'}</td>
                            <td colspan="2" style="border:none; border-bottom: none; text-align:center;">${reservation.roomNumber || 'N/A'}</td>
                        </tr>
                        <tr>
                            <th colspan="2">Date d'Arrivée</th>
                            <td>${new Date(reservation.checkInDate).toLocaleDateString('fr-FR')}</td>
                            <th colspan="2">Date de Départ</th>
                            <td>${new Date(reservation.checkOutDate).toLocaleDateString('fr-FR')}</td>
                            <th>Tarif</th>
                            <td>${this.formatCurrency(reservation.tariff || 0)}</td>
                        </tr>
                        <tr>
                            <th colspan="2">Heure d'Arrivée</th>
                            <td>${reservation.checkInTime}</td>
                            <th colspan="2">Heure de Départ</th>
                            <td>${reservation.checkOutTime}</td>
                            <th>Type de Tarif</th>
                            <td>${reservation.rateType}</td>
                        </tr>
                    </table>

                    <!-- Tableau des Charges -->
                    <div class="charges-table">
                        <table class="header-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Réf. N°</th>
                                    <th>Détails</th>
                                    <th>Charges</th>
                                    <th>Paiements</th>
                                    <th>Solde</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${generateTransactionRows(pageTransactions)}
                            </tbody>
                        </table>
                    </div>

                    ${isLastTxPage ? lastTxContent : continuedNotice}

                    <!-- Information de Page -->
                    <div class="page-info">
                        Page ${pageNumber} sur ${totalPages}
                    </div>
                </div>
            `
    }

    // Dernière page : en-tête + policies
    const generatePoliciesPage = (pageNumber: number) => `
            <div class="container" style="page-break-before: always;">
                ${headerHtmlLastPage}

                <!-- Avis Folio + Policies -->
                ${policiesHtml}

                ${trackingFooterHtml}

                <!-- Information de Page -->
                <div class="page-info">
                    Page ${pageNumber} sur ${totalPages}
                </div>
            </div>
        `

    // Générer toutes les pages
    const allPages =
      transactionPages
        .map((pageTransactions, index) => generatePage(pageTransactions, index + 1))
        .join('') + (hasPoliciesPage ? generatePoliciesPage(totalPages) : '')

    return `<!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Facture Fiscale - ${hotel.name}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                @page {
                    size: A4;
                    margin: 10mm;
                }

                body {
                    font-family: 'Times New Roman', serif;
                    font-size: 12px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    margin: 0;
                    padding: 0;
                }

                .container {
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #000;
                }

                .header {
                    text-align: center;
                    padding: 15px;
                    border-bottom: 1px solid #000;
                    position: relative;
                }

                .hotel-info h1 {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }

                .hotel-details {
                    font-size: 11px;
                    margin-bottom: 15px;
                }

                .tax-invoice {
                    font-size: 12px;
                    font-weight: bold;
                }

                .registration-info {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 10px;
                    text-align: right;
                }

                .invoice-details {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                }

                .details-table {
                    width: 100%;
                    font-size: 10px;
                    border-collapse: collapse;
                }

                .details-table td {
                    padding: 2px 5px;
                    vertical-align: top;
                }

                .charges-table {
                    border-bottom: 1px solid #000;
                }

                .charges-table .amount {
                    text-align: right;
                }

                .totals-section {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                    text-align: center;
                    font-size: 10px;
                }

                .totals-section .total-line {
                    margin-bottom: 5px;
                }

                .amount-words {
                    border-bottom: 1px solid #000;
                }

                .amount-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .amount-table td {
                    border: 1px solid #000;
                    padding: 6px;
                    vertical-align: top;
                }

                .bill-to {
                    padding: 8px;
                    font-size: 10px;
                    border-bottom: 1px solid #000;
                }

                .footer {
                    text-align: center;
                    padding: 15px;
                    font-size: 10px;
                }

                .user-tracking {
                    padding: 8px;
                    font-size: 10px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    border-bottom: 1px solid #000;
                }

                .continued-notice {
                    padding: 8px;
                    font-size: 10px;
                    font-style: italic;
                    text-align: right;
                }

                .policies { padding: 8px 8px 8px; border-top: 1px solid #000; border-bottom: 1px solid #000; }
                .policy-block { margin-bottom: 10px; page-break-inside: avoid; }
                .policy-title {
                    font-size: 11px; font-weight: bold; text-transform: uppercase;
                    letter-spacing: 0.5px; margin-bottom: 3px;
                }
                .policy-text { font-size: 12px; line-height: 1.4; text-align: justify; color: #222; }
                .policy-text p { margin: 0 0 4px; }
                .policy-text h1, .policy-text h2, .policy-text h3 { font-size: 11px; font-weight: bold; margin: 4px 0; }
                .policy-text pre { font-size: 10px; white-space: pre-wrap; }
                .policy-text table { width: 100%; border-collapse: collapse; font-size: 10px; }
                .policy-text div { margin: 0; }
                .policy-text ul, .policy-text ol { margin: 0 0 2px; padding-left: 14px; }
                .policy-text ul { list-style: disc; }
                .policy-text ol { list-style: decimal; }
                .policy-text h1, .policy-text h2, .policy-text h3 { font-size: 9px; font-weight: bold; margin: 2px 0; }
                .policy-text blockquote { margin: 0 0 2px 8px; font-style: italic; }
                .policy-text td, .policy-text th { border: 1px solid #999; padding: 1px 3px; }

                .page-info {
                    text-align: right;
                    padding: 5px;
                    font-size: 10px;
                }

                .font-bold { font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }

                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .header-table th,
                .header-table td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    text-align: left;
                }

                .header-table th {
                    font-weight: bold;
                    background-color: #d3d3d3;
                    text-align: center;
                }

                .header-table td {
                    text-align: center;
                }

                .charges-table .header-table tbody tr td {
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                }

                .charges-table .header-table tbody tr:last-child td {
                    border-bottom: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:first-child {
                    border-left: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:last-child {
                    border-right: 1px solid #000;
                }

                /* Gestion de la pagination automatique */
                .charges-table .header-table tbody tr {
                    page-break-inside: avoid;
                }

                .charges-table .header-table thead {
                    display: table-header-group;
                }

                .charges-table .header-table tfoot {
                    display: table-footer-group;
                }

                @media print {
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .container {
                        page-break-after: always;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }

                    .container:last-child {
                        page-break-after: auto;
                    }
                }
            </style>
        </head>
        <body>
            ${allPages}
        </body>
        </html>`
  }

  /**
   * Données d'une réservation pour sa facture dans l'historique client.
   */
  private static generateGuestHistoryHotelTemplate(
    data: GuestHistoryInvoiceData,
    french: boolean
  ): string {
    const { hotel, guest, currency, reservations } = data
    const invoicePages = reservations.map((reservation) => {
      const charges = Number(reservation.totals.totalChargesWithTaxes) || 0
      const payments = Number(reservation.totals.totalPayments) || 0
      const balanceAfterCharges = charges
      const balanceAfterPayments = balanceAfterCharges - payments
      const arrivalDate = reservation.arrivalDate || new Date()
      const departureDate = reservation.departureDate || arrivalDate
      const transactionDate = arrivalDate

      const templateData: HotelInvoiceTemplateData = {
        hotel,
        reservation: {
          reservationNumber: reservation.reservationNumber,
          guest: {
            displayName: reservation.guestName || guest.name,
            guestCode: reservation.guestCode,
            address: guest.address || undefined,
            country: guest.country || undefined,
          },
          company: reservation.company,
          adults: reservation.adults,
          children: reservation.children,
          roomNumber: reservation.roomNumber,
          checkInDate: arrivalDate,
          checkOutDate: departureDate,
          tariff: reservation.tariff,
          checkInTime: reservation.checkInTime,
          checkOutTime: reservation.checkOutTime,
          rateType: reservation.rateType,
          reservedBy: reservation.reservedBy,
          checkedInBy: reservation.checkedInBy,
          checkedOutBy: reservation.checkedOutBy,
        },
        folio: {
          folioNumber:
            reservation.folioNumber && reservation.folioNumber !== '-'
              ? reservation.folioNumber
              : reservation.reservationNumber,
          reservationNumber: reservation.reservationNumber,
        },
        transactions: [
          {
            date: transactionDate,
            transactionNumber: '',
            description: french ? 'Charges de la réservation' : 'Reservation charges',
            amount: charges,
            balance: balanceAfterCharges,
          },
          ...(payments > 0
            ? [
                {
                  date: transactionDate,
                  transactionNumber: '',
                  description: french ? 'Paiements reçus' : 'Payments received',
                  amount: -payments,
                  balance: balanceAfterPayments,
                },
              ]
            : []),
        ],
        totals: {
          totalChargesWithTaxes: charges,
          totalPayments: payments,
          totalTaxes: Number(reservation.totals.totalTaxes) || 0,
          outstandingBalance: Number.isFinite(Number(reservation.totals.outstandingBalance))
            ? Number(reservation.totals.outstandingBalance)
            : balanceAfterPayments,
        },
        currency,
      }

      return french
        ? this.generateHotelHtmlTemplateFrench(templateData)
        : this.generateHotelHtmlTemplate(templateData)
    })

    const style = invoicePages[0]?.match(/<style>[\s\S]*?<\/style>/i)?.[0]
    const pageContents = invoicePages.map((invoicePage) => {
      const body = invoicePage.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
      if (!body) throw new Error('Unable to extract invoice page content')
      return body
    })

    if (!style) throw new Error('Unable to extract invoice template styles')

    return `<!DOCTYPE html>
      <html lang="${french ? 'fr' : 'en'}">
        <head>
          <meta charset="UTF-8">
          ${style}
        </head>
        <body>${pageContents.join('')}</body>
      </html>`
  }

  /** Escape values before inserting them into guest-history HTML. */
  static escapeGuestHistoryHtml(value: any): string {
    if (value === null || value === undefined || value === '') return '-'
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  /**
   * Génère une facture distincte par réservation de l'historique client.
   */
  static async generateGuestHistoryPdf(
    data: GuestHistoryInvoiceData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    return this.renderGuestHistoryPdf(data, options, false)
  }

  static async generateGuestHistoryPdfFrench(
    data: GuestHistoryInvoiceData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    return this.renderGuestHistoryPdf(data, options, true)
  }

  private static async renderGuestHistoryPdf(
    data: GuestHistoryInvoiceData,
    options: PdfOptions,
    french: boolean
  ): Promise<Buffer> {
    try {
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      const htmlContent = this.generateGuestHistoryHtmlTemplate(data, french)

      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      return await htmlPdf.generatePdf(file, pdfOptions as any)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate Guest History PDF: ${message}`)
    }
  }

  private static generateGuestHistoryHtmlTemplate(
    data: GuestHistoryInvoiceData,
    french: boolean
  ): string {
    const { hotel, guest, meta, currency, reservations } = data
    if (reservations.length > 0) {
      return this.generateGuestHistoryHotelTemplate(data, french)
    }

    const esc = (value: any) => this.escapeGuestHistoryHtml(value)
    const formatDate = (value: any) => {
      const date = new Date(value)
      if (!value || Number.isNaN(date.getTime())) return '-'
      return date.toLocaleDateString(french ? 'fr-FR' : 'en-GB')
    }

    const labels = french
      ? {
          htmlLang: 'fr',
          title: 'Facture Fiscale',
          taxInvoice: 'Facture Fiscale',
          folioRes: 'N° Folio / N° Réservation',
          guestName: 'Nom du Client',
          company: "Nom de l'Entreprise",
          date: 'Date:',
          nationality: 'Nationalité',
          pax: 'Nombre de Personnes',
          adultsChildren: 'Adultes / Enfants',
          grCard: 'N° Carte G.R.',
          roomNo: 'N° Chambre',
          arrival: "Date d'Arrivée",
          departure: 'Date de Départ',
          tariff: 'Tarif',
          arrivalTime: "Heure d'Arrivée",
          departureTime: 'Heure de Départ',
          status: 'Statut',
          rateType: 'Type de Tarif',
          colDate: 'Date',
          colRef: 'Réf. N°',
          colDetails: 'Détails',
          colCharges: 'Charges',
          colPayments: 'Paiements',
          colBalance: 'Solde',
          accommodation: 'Hébergement',
          taxes: 'Taxes',
          advance: 'Avance',
          noTransaction: 'Aucune transaction trouvée',
          grandTotal: 'Total Général',
          totalPaid: 'Total Payé',
          balance: 'Solde',
          currencyLine: 'Ce document est en',
          billTo: 'Facturer À',
          address: 'Adresse',
          remark: 'Remarques',
          nights: 'nuit(s)',
          thanks: 'Merci pour votre séjour parmi nous. Au plaisir de vous revoir.',
          noticeTitle: 'AVIS FOLIO',
          noticeBody: 'Ceci est un document de facturation officiel',
          reservedBy: 'Réservé Par:',
          checkedInBy: 'Check-in Par:',
          checkedOutBy: 'Check-out Par:',
          page: (current: number, total: number) => `Page ${current} sur ${total}`,
          summaryTitle: 'Récapitulatif des réservations',
          colRes: 'Res. N°',
          colRoom: 'N° Chambre',
          colNights: 'Nuits',
          colTotal: 'Total',
          invoiceNo: 'N° Facture',
          guestReservations: 'Réservations',
          printedBy: 'Imprimé par',
          phone: 'Téléphone:',
          website: 'Site web:',
        }
      : {
          htmlLang: 'en',
          title: 'Tax Invoice',
          taxInvoice: 'Tax Invoice',
          folioRes: 'Folio No./Res No.',
          guestName: 'Guest Name',
          company: 'Company Name',
          date: 'Date:',
          nationality: 'Nationality',
          pax: 'No of Pax',
          adultsChildren: 'Adult Child',
          grCard: 'G.R. Card No',
          roomNo: 'Room No',
          arrival: 'Date of Arrival',
          departure: 'Date of Departure',
          tariff: 'Tariff',
          arrivalTime: 'Time Of Arrival',
          departureTime: 'Time of Departure',
          status: 'Status',
          rateType: 'Rate Type',
          colDate: 'Date',
          colRef: 'Ref.No.',
          colDetails: 'Particular',
          colCharges: 'Charges',
          colPayments: 'Payment',
          colBalance: 'Balance',
          accommodation: 'Accommodation',
          taxes: 'Tax',
          advance: 'Advance',
          noTransaction: 'No transactions found',
          grandTotal: 'Grand Total',
          totalPaid: 'Total Paid',
          balance: 'Balance',
          currencyLine: 'This document is in',
          billTo: 'Bill To',
          address: 'Address',
          remark: 'Remark',
          nights: 'night(s)',
          thanks: 'Thank you for your stay with us. Please visit us again.',
          noticeTitle: 'Folio NOTICE',
          noticeBody: 'This is an official billing document',
          reservedBy: 'Reserved By:',
          checkedInBy: 'Checked In By:',
          checkedOutBy: 'Checked Out By:',
          page: (current: number, total: number) => `Page ${current} of ${total}`,
          summaryTitle: 'Reservations Summary',
          colRes: 'Res. No.',
          colRoom: 'Room No',
          colNights: 'Nights',
          colTotal: 'Total',
          invoiceNo: 'Invoice No.',
          guestReservations: 'Reservations',
          printedBy: 'Printed by',
          phone: 'Phone:',
          website: 'URL:',
        }

    const formatAmount = (value: number) => {
      const amount = Number(value)
      if (!Number.isFinite(amount)) return '0'
      return amount.toLocaleString(french ? 'fr-FR' : 'en-GB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    }

    const invoiceContent = reservations
      .map((reservation) => {
        const invoiceNumber =
          (reservation.folioNumber && reservation.folioNumber !== '-'
            ? reservation.folioNumber
            : '') ||
          reservation.reservationNumber ||
          meta.invoiceNumber
        const total = Number(reservation.totals.totalChargesWithTaxes) || 0
        const taxes = Number(reservation.totals.totalTaxes) || 0
        const charges = total - taxes

        return `
          <div class="container">
            <div class="header">
              <div class="registration-info">
                ${hotel.registrationNumber ? `${esc(hotel.registrationNumber)}<br>` : ''}
                ${hotel.rcNumber ? esc(hotel.rcNumber) : ''}
              </div>
              <div class="hotel-info">
                <h1>${esc(hotel.name)}</h1>
                <div class="hotel-details">
                  ${[hotel.address, hotel.city, hotel.state, hotel.country].filter(Boolean).map(esc).join(', ')}<br>
                  ${hotel.phone ? `${labels.phone} ${esc(hotel.phone)}<br>` : ''}
                  ${hotel.email ? esc(hotel.email) : ''}
                  ${hotel.website ? `<br>${labels.website} ${esc(hotel.website)}` : ''}
                </div>
                <div class="tax-invoice">${labels.taxInvoice}</div>
              </div>
            </div>

            <div class="invoice-details">
              <table class="details-table">
                <tr>
                  <td><strong>${labels.invoiceNo}</strong> ${esc(invoiceNumber)}</td>
                  <td><strong>${labels.date}</strong> ${esc(meta.generatedAt)}</td>
                </tr>
                <tr>
                  <td><strong>${labels.guestName}</strong> ${esc(guest.name)}</td>
                  <td><strong>${labels.folioRes}</strong> ${esc(reservation.folioNumber)} / ${esc(reservation.reservationNumber)}</td>
                </tr>
                <tr>
                  <td><strong>${labels.company}</strong> ${esc(reservation.company)}</td>
                  <td><strong>${labels.roomNo}</strong> ${esc(reservation.roomNumber)}</td>
                </tr>
                <tr>
                  <td><strong>${labels.arrival}</strong> ${formatDate(reservation.arrivalDate)}</td>
                  <td><strong>${labels.departure}</strong> ${formatDate(reservation.departureDate)}</td>
                </tr>
                <tr>
                  <td><strong>${labels.pax}</strong> ${formatAmount(reservation.pax)}</td>
                  <td><strong>${labels.nights}</strong> ${formatAmount(reservation.nights)}</td>
                </tr>
                <tr>
                  <td><strong>${labels.nationality}</strong> ${esc(reservation.nationality)}</td>
                  <td><strong>${labels.rateType}</strong> ${esc(reservation.rateType)}</td>
                </tr>
              </table>
            </div>

            <div class="charges-table">
              <table class="header-table">
                <thead>
                  <tr>
                    <th>${labels.colDetails}</th>
                    <th>${labels.colCharges}</th>
                    <th>${labels.colPayments}</th>
                    <th>${labels.colBalance}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>${labels.accommodation}</td>
                    <td>${formatAmount(charges)} ${esc(currency.code)}</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td>${labels.taxes}</td>
                    <td>${formatAmount(taxes)} ${esc(currency.code)}</td>
                    <td>-</td>
                    <td>-</td>
                  </tr>
                  <tr>
                    <td><strong>${labels.grandTotal}</strong></td>
                    <td><strong>${formatAmount(total)} ${esc(currency.code)}</strong></td>
                    <td>${formatAmount(reservation.totals.totalPayments)} ${esc(currency.code)}</td>
                    <td>${formatAmount(reservation.totals.outstandingBalance)} ${esc(currency.code)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="bill-to">
              <strong>${labels.billTo}:</strong> ${esc(guest.name)}
              ${guest.address ? `<br>${labels.address}: ${esc(guest.address)}` : ''}
              ${guest.email ? `<br>${esc(guest.email)}` : ''}
              ${guest.phone ? `<br>${labels.phone} ${esc(guest.phone)}` : ''}
            </div>

            <div class="user-tracking">
              <div>${labels.reservedBy} ${esc(reservation.reservedBy)}</div>
              <div>${labels.checkedInBy} ${esc(reservation.checkedInBy)}</div>
              <div>${labels.checkedOutBy} ${esc(reservation.checkedOutBy)}</div>
            </div>

            <div class="footer">
              ${labels.noticeTitle}: ${labels.noticeBody}<br>
              ${labels.printedBy}: ${esc(meta.printedBy)}<br>
              ${labels.thanks}
            </div>
          </div>`
      })
      .join('')

    return `<!DOCTYPE html>
        <html lang="${labels.htmlLang}">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${labels.title} - ${esc(hotel.name)}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                @page {
                    size: A4;
                    margin: 10mm;
                }

                body {
                    font-family: 'Times New Roman', serif;
                    font-size: 12px;
                    line-height: 1.4;
                    color: #000;
                    background: white;
                    margin: 0;
                    padding: 0;
                }

                .container {
                    width: 100%;
                    max-width: 800px;
                    margin: 0 auto;
                    border: 1px solid #000;
                }

                .header {
                    text-align: center;
                    padding: 15px;
                    border-bottom: 1px solid #000;
                    position: relative;
                }

                .hotel-info h1 {
                    font-size: 16px;
                    font-weight: bold;
                    margin-bottom: 8px;
                }

                .hotel-details {
                    font-size: 11px;
                    margin-bottom: 15px;
                }

                .tax-invoice {
                    font-size: 12px;
                    font-weight: bold;
                }

                .registration-info {
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    font-size: 10px;
                    text-align: right;
                }

                .invoice-details {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                }

                .details-table {
                    width: 100%;
                    font-size: 10px;
                    border-collapse: collapse;
                }

                .details-table td {
                    padding: 2px 5px;
                    vertical-align: top;
                }

                .charges-table {
                    border-bottom: 1px solid #000;
                }

                .totals-section {
                    padding: 8px;
                    border-bottom: 1px solid #000;
                    text-align: center;
                    font-size: 10px;
                }

                .totals-section .total-line {
                    margin-bottom: 5px;
                }

                .amount-words {
                    border-bottom: 1px solid #000;
                }

                .amount-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .amount-table td {
                    border: 1px solid #000;
                    padding: 6px;
                    vertical-align: top;
                }

                .bill-to {
                    padding: 8px;
                    font-size: 10px;
                    border-bottom: 1px solid #000;
                }

                .footer {
                    text-align: center;
                    padding: 15px;
                    font-size: 10px;
                }

                .user-tracking {
                    padding: 8px;
                    font-size: 10px;
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 10px;
                    border-bottom: 1px solid #000;
                }

                .folio-notice {
                    padding: 8px;
                    font-size: 10px;
                    font-weight: bold;
                }

                .page-info {
                    text-align: right;
                    padding: 5px;
                    font-size: 10px;
                }

                .font-bold { font-weight: bold; }
                .text-right { text-align: right; }
                .text-center { text-align: center; }

                .header-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                .header-table th,
                .header-table td {
                    border: 1px solid #000;
                    padding: 6px 8px;
                    text-align: left;
                }

                .header-table th {
                    font-weight: bold;
                    background-color: #d3d3d3;
                    text-align: center;
                }

                .header-table td {
                    text-align: center;
                }

                .charges-table .header-table tbody tr td {
                    border-left: none;
                    border-right: none;
                    border-bottom: none;
                }

                .charges-table .header-table tbody tr:last-child td {
                    border-bottom: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:first-child {
                    border-left: 1px solid #000;
                }

                .charges-table .header-table tbody tr td:last-child {
                    border-right: 1px solid #000;
                }

                .charges-table .header-table tbody tr {
                    page-break-inside: avoid;
                }

                .charges-table .header-table thead {
                    display: table-header-group;
                }

                @media print {
                    body {
                        margin: 0 !important;
                        padding: 0 !important;
                    }

                    .container {
                        page-break-after: always;
                        margin: 0 auto !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }

                    .container:last-child {
                        page-break-after: auto;
                    }
                }
            </style>
        </head>
        <body>
            ${invoiceContent}
        </body>
        </html>`
  }

  /**
   * Detailed (fiscal) invoice: same folio invoice plus fiscal parameters, room summary and tax breakdown.
   */
  static async generateDetailedHotelPdf(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    return this.renderDetailedHotelPdf(folioPrintData, options, false)
  }

  static async generateDetailedHotelPdfFrench(
    folioPrintData: FolioPrintData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    return this.renderDetailedHotelPdf(folioPrintData, options, true)
  }

  private static async renderDetailedHotelPdf(
    folioPrintData: FolioPrintData,
    options: PdfOptions,
    french: boolean
  ): Promise<Buffer> {
    try {
      const defaultOptions = {
        format: 'A4',
        orientation: 'portrait',
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm',
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options,
      }

      const htmlContent = french
        ? this.generateHotelHtmlTemplateFrench(folioPrintData, true)
        : this.generateHotelHtmlTemplate(folioPrintData, true)

      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left,
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1,
      }

      const file = { content: htmlContent }
      return await htmlPdf.generatePdf(file, pdfOptions as any)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to generate detailed hotel PDF: ${message}`)
    }
  }

  /**
   * Fiscal parameters and room/tax summary injected into the standard folio invoice.
   */
  private static buildDetailedInvoiceExtras(
    data: FolioPrintData | HotelInvoiceTemplateData,
    french: boolean
  ): { fiscal: string; summary: string } {
    const { reservation, totals } = data as any

    const labels = french
      ? {
          fiscalParams: 'Paramètres Fiscaux',
          vatRate: 'Taux TVA',
          cityTax: 'Taxe Séjour / nuit',
          roomType: 'Type de Chambre',
          rooms: 'Nb Chambres',
          nights: 'Nuitées',
          rackRate: 'Prix Affiché (TTC)',
          discountPerNight: 'Rabais / nuit',
          grossTotal: 'Total Brut (TTC)',
          discountTotal: 'Total Rabais',
          netTotal: 'Grand Total Net (TTC)',
          cityTaxTotal: 'Taxe de Séjour',
          taxableBase: 'Base Imposable (TTC Soumis à TVA)',
          amountHT: 'Montant Hors Taxes (HT)',
          vatAmount: (rate: number) => `Montant de la TVA (${rate}%)`,
          verification: 'Vérification Équilibre Comptable (HT + TVA + Taxe)',
        }
      : {
          fiscalParams: 'Fiscal Parameters',
          vatRate: 'VAT Rate',
          cityTax: 'City Tax / night',
          roomType: 'Room Type',
          rooms: 'No. Rooms',
          nights: 'Nights',
          rackRate: 'Rack Rate (Incl. Tax)',
          discountPerNight: 'Discount / night',
          grossTotal: 'Gross Total (Incl. Tax)',
          discountTotal: 'Total Discount',
          netTotal: 'Grand Total Net (Incl. Tax)',
          cityTaxTotal: 'City Tax',
          taxableBase: 'Taxable Base (Incl. Tax, VAT applicable)',
          amountHT: 'Amount Excl. Tax (HT)',
          vatAmount: (rate: number) => `VAT Amount (${rate}%)`,
          verification: 'Accounting Balance Check (HT + VAT + Tax)',
        }

    const summaryRows: any[] =
      (data as any).roomSummary?.length > 0
        ? (data as any).roomSummary
        : [
            {
              roomTypeName: reservation.roomType || (french ? 'Chambre' : 'Room'),
              rooms: 1,
              nights: Number(reservation.numberOfNights || 1),
              nightlyRate: Number(reservation.tariff || 0),
              discountPerNight: 0,
              grossTotal: Number(totals.totalChargesWithTaxes || 0),
              discountTotal: Number(totals.totalDiscounts || 0),
              netTotal: Number(totals.totalChargesWithTaxes || 0),
            },
          ]

    const tax = (data as any).taxSummary || {}
    const vatRate = Number(tax.vatRate ?? 0)
    const cityTaxPerNight = Number(tax.cityTaxPerNight ?? 0)
    const totalNights = Number(tax.totalNights ?? reservation.numberOfNights ?? 1)
    const grandTotalNet = Number(tax.grandTotalNet ?? totals.totalChargesWithTaxes ?? 0)
    const cityTaxTotal = Number(tax.cityTaxTotal ?? cityTaxPerNight * totalNights)
    const taxableBase = Number(tax.taxableBase ?? Math.max(grandTotalNet - cityTaxTotal, 0))
    const amountHT = Number(
      tax.amountHT ?? (vatRate > 0 ? taxableBase / (1 + vatRate / 100) : taxableBase)
    )
    const vatAmount = Number(tax.vatAmount ?? taxableBase - amountHT)
    const balanceVerification = Number(
      tax.balanceVerification ?? amountHT + vatAmount + cityTaxTotal
    )

    const roomRows = summaryRows
      .map(
        (room: any) => `
        <tr>
          <td>${room.roomTypeName || ''}</td>
          <td>${room.rooms || 0}</td>
          <td>${room.nights || 0}</td>
          <td class="text-right">${this.formatCurrency(room.nightlyRate)}</td>
          <td class="text-right">${this.formatCurrency(room.discountPerNight)}</td>
          <td class="text-right">${this.formatCurrency(room.grossTotal)}</td>
          <td class="text-right">${this.formatCurrency(room.discountTotal)}</td>
          <td class="text-right">${this.formatCurrency(room.netTotal)}</td>
        </tr>`
      )
      .join('')

    const fiscal = `
      <div style="margin-top: 6px; display: inline-block; text-align: left; font-size: 9px; line-height: 1.3;">
        <div class="font-bold">${labels.fiscalParams}</div>
        <div style="padding-left: 14px;">${labels.vatRate} : ${vatRate}%</div>
        <div style="padding-left: 14px;">${labels.cityTax} : ${this.formatCurrency(cityTaxPerNight)}</div>
      </div>`

    const summary = `
      <table class="header-table">
        <thead>
          <tr>
            <th>${labels.roomType}</th>
            <th>${labels.rooms}</th>
            <th>${labels.nights}</th>
            <th>${labels.rackRate}</th>
            <th>${labels.discountPerNight}</th>
            <th>${labels.grossTotal}</th>
            <th>${labels.discountTotal}</th>
            <th>${labels.netTotal}</th>
          </tr>
        </thead>
        <tbody>${roomRows}</tbody>
        <tfoot>
          <tr><td colspan="7" class="text-right font-bold">${labels.netTotal}</td><td class="text-right">${this.formatCurrency(grandTotalNet)}</td></tr>
          <tr><td colspan="7" class="text-right">${labels.cityTaxTotal}</td><td class="text-right">${this.formatCurrency(cityTaxTotal)}</td></tr>
          <tr><td colspan="7" class="text-right">${labels.taxableBase}</td><td class="text-right">${this.formatCurrency(taxableBase)}</td></tr>
          <tr><td colspan="7" class="text-right">${labels.amountHT}</td><td class="text-right">${this.formatCurrency(amountHT)}</td></tr>
          <tr><td colspan="7" class="text-right">${labels.vatAmount(vatRate)}</td><td class="text-right">${this.formatCurrency(vatAmount)}</td></tr>
          <tr><td colspan="7" class="text-right font-bold">${labels.verification}</td><td class="text-right font-bold">${this.formatCurrency(balanceVerification)}</td></tr>
        </tfoot>
      </table>`

    return { fiscal, summary }
  }

  /**
   * Convert number to words (simplifie
   * d implementation)
   */
  private static numberToWords(amount: number): string {
    const n = Number(amount)
    if (!Number.isFinite(n) || n === 0) return 'Zero'

    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const teens = [
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ]
    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ]
    const thousands = ['', 'Thousand', 'Million', 'Billion']

    function convertHundreds(num: number): string {
      let result = ''

      if (num >= 100) {
        result += ones[Math.floor(num / 100)] + ' Hundred '
        num %= 100
      }

      if (num >= 20) {
        result += tens[Math.floor(num / 10)] + ' '
        num %= 10
      } else if (num >= 10) {
        result += teens[num - 10] + ' '
        return result
      }

      if (num > 0) {
        result += ones[num] + ' '
      }

      return result
    }

    let result = ''
    let thousandIndex = 0
    let remaining = Math.floor(Math.abs(n))

    while (remaining > 0) {
      if (remaining % 1000 !== 0) {
        result = convertHundreds(remaining % 1000) + thousands[thousandIndex] + ' ' + result
      }
      remaining = Math.floor(remaining / 1000)
      thousandIndex++
    }

    return result.trim()
  }

  /**
   * Format date to DD/MM/YYYY
   */
  private static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    } catch (error) {
      return dateString
    }
  }

  /**
   * Format amount with 2 decimal places
   */
  private static formatAmount(amount: number): string {
    if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
      return '0'
    }
    return Number(amount).toLocaleString('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
  }
}
