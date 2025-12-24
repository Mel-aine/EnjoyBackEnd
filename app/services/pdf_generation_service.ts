import htmlPdf from 'html-pdf-node'
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
          left: '10mm'
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options
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
          left: defaultOptions.margin.left
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)
      
      return pdfBuffer
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${error.message}`)
    }
  }

  /**
   * Generate PDF from HTML content
   */
  static async generatePdfFromHtml(
    htmlContent: string,
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
          left: '10mm'
        },
        displayHeaderFooter: true,
        printBackground: true,
        ...options
      }

      // PDF generation options for html-pdf-node (puppeteer-style)
      const pdfOptions = {
        format: defaultOptions.format,
        orientation: defaultOptions.orientation,
        margin: {
          top: defaultOptions.margin.top,
          right: defaultOptions.margin.right,
          bottom: defaultOptions.margin.bottom,
          left: defaultOptions.margin.left
        },
        displayHeaderFooter: defaultOptions.displayHeaderFooter,
        headerTemplate: options.headerTemplate,
        footerTemplate: options.footerTemplate,
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)
      
      return pdfBuffer
    } catch (error) {
      throw new Error(`Failed to generate PDF from HTML: ${error.message}`)
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
          left: '10mm'
        },
        displayHeaderFooter: false,
        printBackground: true,
        ...options
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
          left: defaultOptions.margin.left
        },
        type: 'pdf',
        quality: '75',
        renderDelay: 500,
        zoomFactor: 1
      }

      const file = { content: htmlContent }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)

      return pdfBuffer
    } catch (error) {
      throw new Error(`Failed to generate booking PDF: ${error.message}`)
    }
  }

  /**
   * Generate HTML template from folio print data
   */
  private static generateHtmlTemplate(data: FolioPrintData): string {
    const {
      hotel,
      reservation,
      folio,
      transactions,
      totals,
      currency,
    } = data

    // Convert amount to words (simplified version)
    const amountInWords = this.numberToWords(totals.grandTotal)

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
                            <span class="label">Folio No./Res No.</span> ${folio.folioNumber} / ${folio.reservationNumber || 'N/A'}<br>
                            <span class="label">Guest Name</span> : ${reservation.guest?.displayName || 'N/A'}<br>
                            <span class="label">Company Name</span> : ${reservation.guest?.companyName || 'None'}
                        </td>
                        <td style="width: 25%;">
                            <span class="label">Invoice No.</span> : ${folio.folioNumber || 'N/A'}
                        </td>
                        <td style="width: 25%;">
                            <span class="label">Date:</span> ${new Date().toLocaleString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'})}
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
                    <td>${reservation.tarriff || '0'}</td>
                </tr>
                <tr>
                    <th>Time Of Arrival</th>
                    <td>${this.formatTimeShort(reservation.checkInDate)}</td>
                    <th>Time of Departure</th>
                    <td>${this.formatTimeShort(reservation.checkOutDate)}</td>
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
                    ${transactions?.map((transaction, index) => `
                    <tr>
                        <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                        <td>${transaction.transactionNumber || ''}</td>
                        <td>${transaction.description}</td>
                        <td class="text-right">${(transaction.amount || 0) > 0 ? this.formatAmount(transaction.amount) : '0'}</td>
                        <td class="text-right">${(transaction.amount || 0) < 0 ? this.formatAmount(Math.abs(transaction.amount)) : '0'}</td>
                        <td class="text-right">${this.formatAmount(transaction.netAmount)}</td>
                    </tr>
                    `).join('') || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'}
                </tbody>
            </table>
    
            <!-- Totals Section -->
            <div class="totals-section">
                <table>
                    <tr>
                        <td style="width: 85%; text-align: right;" class="label">Grand Total</td>
                        <td style="width: 5%; text-align: right;">${totals.totalCharges?.toLocaleString() || '0'}</td>
                        <td style="width: 5%; text-align: right;">-${totals.totalPayments?.toLocaleString() || '0'}</td>
                        <td style="width: 5%;"></td>
                    </tr>
                    <tr>
                        <td style="text-align: right;" class="label">Tax</td>
                        <td style="text-align: right;">${totals.totalTax?.toLocaleString() || '0'}</td>
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
                        <td style="width: 30%;">${totals.grandTotal.toLocaleString()}XAF</td>
                        <td style="width: 30%;">${amountInWords}</td>
                        <td style="width: 10%;" class="label">Total Paid</td>
                        <td style="width: 10%; text-align: right;">${totals.totalPayments.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td colspan="3"></td>
                        <td class="label">Balance</td>
                        <td style="text-align: right;">${totals.balance.toLocaleString()}</td>
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
                        <td style="width: 33%;"><span class="label">Checked In By :</span> ${reservation.checkedInBy  || 'N/A'}</td>
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
    const {
      hotel,
      reservation,
      totals,
      currency,
      billingAddress
    } = data

    return `
<!DOCTYPE html>
<html lang="en">
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
                    <h1 class="text-lg font-bold mb-2">CONFIRM BOOKING</h1>
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
                <div>Special Request : ${reservation.specialRequests??''}</div>
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
                ${reservation.reservationRooms?.map(room => `
                <div class="grid-row">
                    <div class="grid-cell"><strong>${room.roomType?.roomTypeName} ${room.roomRates?.rateType?.rateTypeName ??''}</strong></div>
                    <div class="grid-cell">${room.adults || 1} Adults, ${room.children || 0} Children</div>
                    <div class="grid-cell">1</div>
                    <div class="grid-cell">none</div>
                    <div class="grid-cell">none</div>
                </div>`).join('') }
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
                <p><strong>Hotel Check in Time:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkInTime??'12:00'}</p>
                 <p><strong>Hotel Check out Time:</strong> ${hotel.checkinReservationSettings?.timeSettings?.checkOutTime??'12:00'}</p>
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
        left: '10mm'
      },
      displayHeaderFooter: false,
      printBackground: true,
      ...options
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
        left: defaultOptions.margin.left
      },
      displayHeaderFooter: defaultOptions.displayHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
      type: 'pdf',
      quality: '75',
      renderDelay: 500,
      zoomFactor: 1
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
    private static generateHotelHtmlTemplate(data: FolioPrintData): string {
    const {
        hotel,
        reservation,
        folio,
        transactions,
        totals,
        total,
        currency,
    } = data

    // Convert amount to words
    const amountInWords = this.numberToWords(totals.grandTotal)

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
        
        body {
            font-family: 'Times New Roman', serif;
            font-size: 12px;
            line-height: 1.4;
            color: #000;
            background: white;
            margin: 0;
            padding: 10px;
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
        
        .guest-details, .stay-details {
            border-bottom: 1px solid #000;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        
        .data-table th, .data-table td {
            border: 1px solid #000;
            padding: 4px 6px;
            text-align: left;
        }
        
        .data-table th {
            font-weight: bold;
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
        
        .signature {
            text-align: right;
            margin-top: 15px;
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
        
        .url {
            padding: 5px;
            font-size: 10px;
            text-align: center;
            color: #666;
            border-top: 1px solid #000;
        }
        
        .font-bold { font-weight: bold; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
    </style>
</head>
<body>
    <div class="container">
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
                        <div><span class="font-bold">Company Name</span> : ${reservation.guest?.companyName || 'None'}</div>
                    </td>
                    <td style="width: 25%;">
                        <div><span class="font-bold">Invoice No.</span> : ${folio.folioNumber || 'N/A'}</div>
                    </td>
                    <td style="width: 25%;">
                        <div><span class="font-bold">Date:</span> ${new Date().toLocaleString('en-GB', {day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'})}</div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Guest Details -->
        <div class="guest-details">
            <table class="data-table">
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
                    <td>${reservation.rooms?.map(r => r.roomNumber).join(', ') || 'N/A'}</td>
                </tr>
            </table>
        </div>

        <!-- Stay Details -->
        <div class="stay-details">
            <table class="data-table">
                <tr>
                    <th>Date of Arrival</th>
                    <td>${new Date(reservation.checkInDate).toLocaleDateString('fr-FR')}</td>
                    <th>Date of Departure</th>
                    <td>${new Date(reservation.checkOutDate).toLocaleDateString('fr-FR')}</td>
                    <th>Tariff</th>
                    <td>${totals.roomCharges?.toLocaleString() || '0'}</td>
                </tr>
                <tr>
                    <th>Time Of Arrival</th>
                    <td>${this.formatTimeShort(reservation.checkInDate)}</td>
                    <th>Time of Departure</th>
                    <td>${this.formatTimeShort(reservation.checkOutDate)}</td>
                    <th>Rate Type</th>
                    <td>${reservation.rateType || 'N/A'}</td>
                </tr>
            </table>
        </div>

        <!-- Charges Table -->
        <div class="charges-table">
            <table class="data-table">
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
                    ${transactions?.map((transaction, index) => `
                    <tr>
                        <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
                        <td>${transaction.transactionNumber || ''}</td>
                        <td>${transaction.description}</td>
                        <td class="text-right">${(transaction.amount || 0) > 0 ? this.formatAmount(transaction.amount) : '0'}</td>
                        <td class="text-right">${(transaction.amount || 0) < 0 ? this.formatAmount(Math.abs(transaction.amount)) : '0'}</td>
                        <td class="text-right">${this.formatAmount(transaction.netAmount)}</td>
                    </tr>
                    `).join('') || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'}
                </tbody>
            </table>
        </div>

        <!-- Totals Section -->
        <div class="totals-section">
            <div class="total-line">
                <span class="font-bold">Grand Total</span>
                <span style="margin-left: 30px;">${total.totalCharges?.toLocaleString() || '0'}</span>
                <span style="margin-left: 30px;">-${total.totalPayments?.toLocaleString() || '0'}</span>
            </div>
            <div>
                <span class="font-bold">Tax</span>
                <span style="margin-left: 60px;">${total.totalTaxes?.toLocaleString() || '0'}</span>
            </div>
        </div>

        <!-- Amount in Words -->
        <div class="amount-words">
            <table class="amount-table">
                <tr>
                    <td class="font-bold" style="width: 25%;">This Folio is in ${currency.code}</td>
                    <td style="width: 35%;">${amountInWords}</td>
                    <td class="font-bold" style="width: 20%;">Total Paid</td>
                    <td class="text-right" style="width: 20%;">${total.totalPayments.toLocaleString()}</td>
                </tr>
                <tr>
                    <td></td>
                    <td></td>
                    <td class="font-bold">Balance</td>
                    <td class="text-right">${total.outstandingBalance.toLocaleString()}</td>
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

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your stay with us. Please visit us again.</p>
        </div>

        <!-- Folio Notice -->
        <div class="folio-notice">
            <p>Folio NOTICE</p>
            <p>Folio NOTICE</p>
        </div>

        <!-- User Tracking Information -->
        <div class="user-tracking">
            <div>
                <span class="font-bold">Reserved By:</span> ${reservation.reservedBy || 'N/A'}
            </div>
            <div>
                <span class="font-bold">Checked In By:</span> ${reservation.checkedInBy || 'N/A'}
            </div>
            <div>
                <span class="font-bold">Checked Out By:</span> ${reservation.checkedOutBy || 'N/A'}
            </div>
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
   * Convert number to words (simplified implementation)
   */
  private static numberToWords(amount: number): string {  
    if (amount === 0) return 'Zero'
    
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
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
    
    while (amount > 0) {
      if (amount % 1000 !== 0) {
        result = convertHundreds(amount % 1000) + thousands[thousandIndex] + ' ' + result
      }
      amount = Math.floor(amount / 1000)
      thousandIndex++
    }
    
    return result.trim()
  }

  /**
   * Format date to DD/MM/YYYY
   */
  private static formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Format amount with 2 decimal places
   */
  private static formatAmount(amount: number): string {
    return amount?.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }
  /** 
   * Format time to HH'h'mm
   */
    private static formatTimeShort(dateValue: any): string {
    if (!dateValue) return 'N/A';
    
    try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) return 'N/A';
        
        return date.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
        }).replace(':', 'h'); // Optionnel: remplace ":" par "h" (14h30 au lieu de 14:30)
    } catch (error) {
        return 'N/A';
    }
}
}