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
      const htmlContent = this.generateHtmlTemplate(folioPrintData)

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
        displayHeaderFooter: false,
        printBackground: true,
        ...options
      }

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

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Folio Invoice - ${folio.folioNumber}</title>
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
            margin: 20px;
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
            border-bottom: 2px solid #000;
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
            border-bottom: 2px solid #000;
        }
        
        .details-table {
            width: 100%;
            font-size: 10px;
        }
        
        .details-table td {
            padding: 2px 5px;
            vertical-align: top;
        }
        
        .guest-details, .stay-details {
            border-bottom: 2px solid #000;
        }
        
        .data-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        
        .data-table th, .data-table td {
            border-right: 2px solid #000;
            padding: 4px 6px;
            text-align: left;
        }
        
        .data-table th:last-child, .data-table td:last-child {
            border-right: none;
        }
        
        .data-table th {
            border-bottom: 2px solid #000;
            font-weight: bold;
        }
        
        .charges-table {
            border-bottom: 2px solid #000;
        }
        
        .charges-table .amount {
            text-align: right;
        }
        
        .totals-section {
            padding: 8px;
            border-bottom: 2px solid #000;
            text-align: center;
            font-size: 10px;
        }
        
        .totals-section .total-line {
            margin-bottom: 5px;
        }
        
        .amount-words {
            border-bottom: 2px solid #000;
        }
        
        .amount-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }
        
        .amount-table td {
            border-right: 2px solid #000;
            border-bottom: 2px solid #000;
            padding: 6px;
            vertical-align: top;
        }
        
        .amount-table td:last-child {
            border-right: none;
        }
        
        .bill-to {
            padding: 8px;
            font-size: 10px;
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
                <p>Mon#${hotel.registrationNumber || 'N/A'}</p>
                <p>Rc ${hotel.rcNumber || 'N/A'}</p>
            </div>
            <div class="hotel-info">
                <h1>${hotel.name}</h1>
                <div class="hotel-details">
                    <p>${hotel.address}</p>
                    <p>Phone: ${hotel.phone}, Email: ${hotel.email}</p>
                    <p>URL: ${hotel.website || 'N/A'}</p>
                </div>
                <div class="tax-invoice">Tax Invoice</div>
            </div>
        </div>

        <!-- Invoice Details -->
        <div class="invoice-details">
            <table class="details-table">
                <tr>
                    <td style="width: 33%;">
                        <div><span class="font-bold">Folio No./Rcv No.</span> ${folio.folioNumber} / ${folio.folioNumber || 'N/A'}</div>
                        <div><span class="font-bold">Guest Name</span> ${reservation.guest?.displayName || 'N/A'}</div>
                        <div><span class="font-bold">Company Name</span> ${reservation.guest?.companyName || 'N/A'}</div>
                    </td>
                    <td style="width: 33%; text-align: center;">
                        <div><span class="font-bold">Invoice No.</span> ${folio.folioNumber || 'N/A'}</div>
                    </td>
                    <td style="width: 33%; text-align: right;">
                        <div><span class="font-bold">Date:</span> ${new Date().toLocaleString('en-GB')}</div>
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
                    <td>${reservation.adults+reservation.children || 1}</td>
                    <td>${reservation.adults || 1}+${reservation.children || 0}</td>
                    <td>${reservation.guest?.guestCode}</td>
                    <td>${reservation.rooms?.map(r => r.roomNumber).join(', ') || 'N/A'}</td>
                </tr>
            </table>
        </div>

        <!-- Stay Details -->
        <div class="stay-details">
            <table class="data-table">
                <tr>
                    <th>Date of Arrival</th>
                    <td>${reservation.checkInDate}</td>
                    <th>Date of Departure</th>
                    <td>${reservation.checkOutDate}</td>
                </tr>
                <tr>
                    <th>Time Of Arrival</th>
                    <td>${reservation.checkInDate || 'N/A'}</td>
                    <th>Time of Departure</th>
                    <td>${reservation.checkOutDate || 'N/A'}</td>
                </tr>
                <tr>
                    <th>Tariff</th>
                    <td>${totals.roomCharges?.toLocaleString()}</td>
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
                        <th>Ref No.</th>
                        <th>Particular</th>
                        <th class="text-right">Charges</th>
                        <th class="text-right">Payment</th>
                        <th class="text-right">Balance</th>
                    </tr>
                </thead>
                <tbody>
                    ${transactions?.map((transaction, index) => `
                    <tr>
                        <td>${transaction.transactionDate}</td>
                        <td>${transaction.reference || ''}</td>
                        <td class="font-bold">${transaction.description}</td>
                        <td class="text-right">${transaction.amount > 0 ? transaction.amount.toLocaleString() : '0'}</td>
                        <td class="text-right">${transaction.amount < 0 ? Math.abs(transaction.amount).toLocaleString() : '0'}</td>
                        <td class="text-right">${transaction.runningBalance?.toLocaleString() || ''}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Totals Section -->
        <div class="totals-section">
            <div class="total-line">
                <span class="font-bold">Grand Total</span>
                <span style="margin-left: 30px;">${totals.grandTotal?.toLocaleString()}</span>
                <span style="margin-left: 30px;">-${totals.totalPaid?.toLocaleString()}</span>
            </div>
            <div>
                <span class="font-bold">Tax</span>
                <span style="margin-left: 60px;">${totals.totalTax?.toLocaleString()}</span>
            </div>
        </div>

        <!-- Amount in Words -->
        <div class="amount-words">
            <table class="amount-table">
                <tr>
                    <td class="font-bold" style="width: 25%;">This Folio is in ${currency.code}</td>
                    <td style="width: 35%;">${amountInWords}</td>
                    <td class="font-bold" style="width: 20%;">Total Paid</td>
                    <td class="text-right" style="width: 20%;">${totals.totalPaid.toLocaleString()}</td>
                </tr>
                <tr>
                    <td></td>
                    <td></td>
                    <td class="font-bold">Balance</td>
                    <td class="text-right">${totals.balance.toLocaleString()}</td>
                </tr>
            </table>
        </div>

        <!-- Bill To Section -->
        <div class="bill-to">
            <div style="margin-bottom: 8px;">
                <span class="font-bold">Bill To</span>
                <span style="margin-left: 40px;">${reservation.guest?.displayName || 'N/A'}</span>
            </div>
            <div>
                <span class="font-bold">Address</span>
                <span style="margin-left: 35px;">${reservation.guest?.address || reservation.guest?.country || 'N/A'}</span>
            </div>
            <div class="signature">
                <span>( Guest Signature )</span>
            </div>
        </div>

        <!-- Remark Section -->
        <div style="padding: 8px; font-size: 10px;">
            <span class="font-bold">Remark</span>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>Thank you for your stay with us. Please visit us again.</p>
        </div>

        <!-- Folio Notice -->
        <div style="padding: 8px; font-size: 10px;">
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
    </div>
</body>
</html>
    `
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
            margin-bottom: 16px;
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
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
        }
        
        th, td {
            padding: 4px 8px;
            border: 1px solid #cbd5e0;
            text-align: left;
        }
        
        th {
            background-color: #edf2f7;
        }
        
        .border-2 {
            border-width: 2px;
        }
        
        .border-black {
            border-color: #000;
        }
        
        .border-t {
            border-top: 1px solid #000;
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
        <div class="border-classic">
            <div class="flex justify-between">
                <div>
                    <h1 class="text-lg font-bold mb-2">CONFIRM BOOKING</h1>
                    <div class="mb-2">
                        <strong>BOOKING REFERENCE NO</strong><br>
                        <span class="text-xl font-bold">: ${reservation.confirmationCode}</span>
                    </div>
                    <div class="text-sm">
                        Kindly print this confirmation and have it<br>
                        ready upon check-in at the Hotel
                    </div>
                </div>
                <div class="text-right">
                    <h2 class="text-lg font-bold">${hotel.name}</h2>
                    <div class="text-sm mt-2">
                        ${hotel.address}<br>
                        ${hotel.city}, ${hotel.country}<br>
                        <u>${hotel.email}</u><br>
                        Phone : ${hotel.phone}
                    </div>
                </div>
            </div>
        </div>

        <!-- Guest Information -->
        <div class="mb-4">
            <p class="text-sm">Dear ${reservation.guestName},</p>
            <p class="text-sm mt-2">
                Thank you for choosing ${hotel.name} for your stay. We are pleased to inform you that your
                reservation request is CONFIRMED and your reservation details are as follows.
            </p>
        </div>

        <!-- Booking Details -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Booking Details</h3>
            <div class="text-sm grid grid-cols-2 gap-2">
                <div>Booking Date : ${this.formatDate(data.printInfo.printedDate.toString())}</div>
                <div>Check In Date : ${this.formatDate(reservation.checkInDate.toString())}</div>
                <div>Check Out Date : ${this.formatDate(reservation.checkOutDate.toString())}</div>
                <div>Nights : ${reservation.numberOfNights}</div>
                <div>Arrival Time : ${reservation.actualArrivalDatetime}</div>
                <div>Special Request : </div>
            </div>
        </div>

        <!-- Your Details -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Your Details</h3>
            <div class="text-sm">
                ${reservation.guestName}<br>
                Email ID : ${billingAddress?.email || reservation.guest?.email || 'N/A'}<br>
                Phone : ${billingAddress?.phone || reservation.guest?.phonePrimary || 'N/A'}
            </div>
        </div>

        <!-- Room Details -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Room Details</h3>
            <table>
                <thead>
                    <tr class="bg-gray-200">
                        <th>Room Type</th>
                        <th>Guest(s)</th>
                        <th>No of rooms</th>
                        <th>Package if any</th>
                        <th>Promotion if any</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${reservation.roomType}</td>
                        <td>${reservation.adults} Adults, ${reservation.children} Children</td>
                        <td>1</td>
                        <td>Standard Rate</td>
                        <td>${this.formatAmount(reservation.roomCharge)} ${currency.code}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Rates Details -->
        <div class="mb-4">
            <h3 class="font-bold mb-2">Rates Details</h3>
            <table>
                <thead>
                    <tr class="bg-gray-200">
                        <th>Details</th>
                        <th class="text-right">Rates (${currency.code})</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Room Charges</td>
                        <td class="text-right">${this.formatAmount(totals.totalCharges)}</td>
                    </tr>
                    <tr>
                        <td>Room Charges Tax</td>
                        <td class="text-right">${this.formatAmount(totals.totalTax)}</td>
                    </tr>
                    <tr>
                        <td>Service Charges</td>
                        <td class="text-right">${this.formatAmount(totals.totalServiceCharges)}</td>
                    </tr>
                    <tr>
                        <td>Extra Charges Including Discounts and Tax</td>
                        <td class="text-right">-${this.formatAmount(totals.totalDiscounts)}</td>
                    </tr>
                    <tr>
                        <td>Round off</td>
                        <td class="text-right">-${this.formatAmount(totals.totalDiscounts)}</td>
                    </tr>
                    <tr class="font-bold">
                        <td>Grand Total</td>
                        <td class="text-right">${this.formatAmount(totals.grandTotal)}</td>
                    </tr>
                    <tr>
                        <td>Total Paid</td>
                        <td class="text-right">${this.formatAmount(totals.totalPaid)}</td>
                    </tr>
                    <tr class="font-bold">
                        <td>Amount due at time of check in</td>
                        <td class="text-right">${this.formatAmount(totals.balance)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <!-- Booking Amount Box -->
        <div class="flex justify-between items-start mb-4">
            <div class="border-2 border-black p-3">
                <div class="text-center font-bold">
                    BOOKING AMOUNT<br>
                    ${currency.code} ${this.formatAmount(totals.grandTotal)} ${currency.code}
                </div>
            </div>
            <div class="text-right text-sm">
                <strong>Booked & Payable By</strong><br>
                ${reservation.guestName}
            </div>
        </div>

        <!-- Conditions & Policies -->
        <div class="mb-4">
            <h3 class="font-bold mb-2 bg-gray-200 p-3">Conditions & Policies</h3>
            
            <div class="text-sm mt-4">
                <h4 class="font-bold mb-2">Cancellation Policy</h4>
                <p class="mb-2">
                    Free cancellation up to 48 hours before check-in. After that, 1 night will be charged.
                </p>

                <div class="mt-2">
                    <h4 class="font-bold mb-2">Additional Terms</h4>
                    <ul class="list-disc pl-5">
                        <li>Early check-in and late check-out subject to availability</li>
                        <li>Credit card required at check-in for incidentals</li>
                        <li>Pets are not allowed</li>
                        <li>Check-in time: 2:00 PM, Check-out time: 12:00 PM</li>
                    </ul>
                </div>

                <div class="mt-4 font-bold text-center">
                    <em>This email has been sent from an automated system - please do not reply to it.</em>
                </div>

                <div class="mt-6 mb-4 pt-4 border-t">
                    <strong>**** FOR ANY FURTHER QUERY ****</strong><br>
                    Contact us by Email Id ${hotel.email}<br>
                    Phone NO : ${hotel.phone}<br>
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
        currency,
    } = data

    // Convert amount to words
    const amountInWords = this.numberToWords(totals.grandTotal)

    return `
    <!DOCTYPE html>
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
            }

            body {
                font-family: serif;
                font-size: 14px;
                background-color: #f5f5f5;
                padding: 20px;
            }

            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background-color: white;
                border: 2px solid black;
            }

            .header {
                text-align: center;
                padding: 16px;
                border-bottom: 2px solid black;
            }

            .header-content {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
            }

            .header-left {
                flex: 1;
            }

            .header-center {
                flex: 2;
            }

            .header-right {
                flex: 1;
                text-align: right;
                font-size: 12px;
            }

            .hotel-name {
                font-size: 18px;
                font-weight: bold;
                margin-bottom: 8px;
            }

            .hotel-info {
                font-size: 12px;
                line-height: 1.4;
            }

            .tax-invoice-title {
                text-align: center;
                padding: 16px 0;
                font-size: 14px;
                font-weight: bold;
            }

            .invoice-details {
                padding: 8px;
                border-bottom: 2px solid black;
            }

            .invoice-details-table {
                width: 100%;
                font-size: 11px;
            }

            .invoice-details-table td {
                padding: 4px;
                vertical-align: top;
            }

            .label {
                font-weight: 600;
            }

            .guest-details-table, .stay-details-table, .charges-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
            }

            .guest-details-table {
                border-bottom: 2px solid black;
            }

            .guest-details-table th, .guest-details-table td {
                border-right: 2px solid black;
                padding: 8px;
                text-align: left;
            }

            .guest-details-table th:last-child, .guest-details-table td:last-child {
                border-right: none;
            }

            .guest-details-table th {
                border-bottom: 2px solid black;
                font-weight: 600;
            }

            .stay-details-table {
                border-bottom: 2px solid black;
            }

            .stay-details-table th, .stay-details-table td {
                border-right: 2px solid black;
                padding: 8px;
            }

            .stay-details-table td:last-child, .stay-details-table th:last-child {
                border-right: none;
            }

            .stay-details-table tr {
                border-bottom: 2px solid black;
            }

            .charges-table {
                border-bottom: 2px solid black;
            }

            .charges-table th, .charges-table td {
                padding: 8px;
            }

            .charges-table th {
                border-right: 2px solid black;
                border-bottom: 2px solid black;
                font-weight: 600;
            }

            .charges-table th:last-child {
                border-right: none;
            }

            .charges-table .text-right {
                text-align: right;
            }

            .totals-section {
                padding: 8px;
                border-bottom: 2px solid black;
                text-align: center;
                font-size: 11px;
            }

            .totals-section .label {
                font-weight: 600;
            }

            .bill-to-section {
                padding: 8px;
                font-size: 11px;
            }

            .guest-signature {
                text-align: right;
                margin-top: 16px;
            }

            .remark-section {
                padding: 8px;
                font-size: 11px;
            }

            .footer {
                text-align: center;
                padding: 16px;
                font-size: 11px;
            }

            .folio-notice {
                text-align: left;
                font-size: 11px;
                padding: 8px 16px;
                line-height: 1.2;
            }

            .verification-info {
                padding: 4px 16px;
                font-size: 11px;
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 16px;
            }

            /* Responsive styles */
            @media (max-width: 768px) {
                body {
                    padding: 10px;
                }

                .hotel-name {
                    font-size: 16px;
                }

                .header-content {
                    flex-direction: column;
                    text-align: center;
                }

                .header-right {
                    text-align: center;
                    margin-bottom: 16px;
                }

                .invoice-details-table {
                    font-size: 10px;
                }

                .invoice-details-table td {
                    display: block;
                    width: 100%;
                    margin-bottom: 8px;
                }

                .guest-details-table, .stay-details-table, .charges-table {
                    font-size: 10px;
                }

                .verification-info {
                    grid-template-columns: 1fr;
                    gap: 8px;
                }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="header-content">
                    <div class="header-left"></div>
                    <div class="header-center">
                        <h1 class="hotel-name">${hotel.name}</h1>
                        <div class="hotel-info">
                            <p>${hotel.address}</p>
                            <p>Phone: ${hotel.phone}, Email: ${hotel.email}</p>
                            <p>URL: ${hotel.website || 'N/A'}</p>
                        </div>
                        <div class="tax-invoice-title">Tax Invoice</div>
                    </div>
                    <div class="header-right">
                        <p>Mon#${hotel.registrationNumber || 'N/A'}</p>
                        <p>Rc ${hotel.rcNumber || 'N/A'}</p>
                    </div>
                </div>
            </div>

            <!-- Invoice Details -->
            <div class="invoice-details">
                <table class="invoice-details-table">
                    <tr>
                        <td style="width: 33%;">
                            <div><span class="label">Folio No./Rcv No.</span> <span style="margin-left: 32px;">${folio.folioNumber} / ${folio.folioNumber || 'N/A'}</span></div>
                            <div><span class="label">Guest Name</span> <span style="margin-left: 32px;">${reservation.guest?.displayName || 'N/A'}</span></div>
                            <div><span class="label">Company Name</span> <span style="margin-left: 24px;">${reservation.guest?.companyName || 'N/A'}</span></div>
                        </td>
                        <td style="width: 33%; text-align: center;">
                            <div><span class="label">Invoice No.</span> <span style="margin-left: 8px;">${folio.folioNumber || 'N/A'}</span></div>
                        </td>
                        <td style="width: 33%; text-align: right;">
                            <div><span class="label">Date:</span> <span style="margin-left: 8px;">${new Date().toLocaleString('en-GB')}</span></div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Guest Details Table -->
            <table class="guest-details-table">
                <thead>
                    <tr>
                        <th>Nationality</th>
                        <th>No of Pax</th>
                        <th>Adult Child</th>
                        <th>G.R. Card No</th>
                        <th>Room No</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${reservation.guest?.nationality || ''}</td>
                        <td>${reservation.adults + reservation.children || 1}</td>
                        <td>${reservation.adults || 1}Adult & ${reservation.children || 0}Child</td>
                        <td>${reservation.guest?.guestCode || 'N/A'}</td>
                        <td>${reservation.rooms?.map(r => r.roomNumber).join(', ') || 'N/A'}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Stay Details Table -->
            <table class="stay-details-table">
                <tr>
                    <th>Date of Arrival</th>
                    <td>${new Date(reservation.checkInDate).toLocaleDateString('fr-FR')}</td>
                    <th>Date of Departure</th>
                    <td>${new Date(reservation.checkOutDate).toLocaleDateString('fr-FR')}</td>
                </tr>
                <tr>
                    <th>Time Of Arrival</th>
                    <td>${this.formatTimeShort(reservation.checkInDate)}</td>
                    <th>Time of Departure</th>
                    <td>${this.formatTimeShort(reservation.checkOutDate)}</td>
                </tr>
                <tr>
                    <th>Tariff</th>
                    <td>${totals.roomCharges?.toLocaleString() || '0'}</td>
                    <th>Rate Type</th>
                    <td>${reservation.rateType || 'N/A'}</td>
                </tr>
            </table>

            <!-- Charges Table -->
            <table class="charges-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Ref No.</th>
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
                        <td><strong>${transaction.description}</strong></td>
<td class="text-right">${(transaction.amount || 0) > 0 ? this.formatAmount(transaction.amount) : '0'}</td>
<td class="text-right">${(transaction.amount || 0) < 0 ? this.formatAmount(Math.abs(transaction.amount)) : '0'}</td>
                        <td class="text-right">${this.formatAmount(transaction.netAmount)}</td>
                    </tr>
                    `).join('') || '<tr><td colspan="6" class="text-center">No transactions found</td></tr>'}
                </tbody>
            </table>

            <!-- Totals Section -->
            <div class="totals-section">
                <div style="margin-bottom: 4px;">
                    <span class="label">Grand Total</span>
                    <span style="margin-left: 32px;">${totals.grandTotal?.toLocaleString() || '0'}</span>
                    <span style="margin-left: 32px;">-${totals.totalPaid?.toLocaleString() || '0'}</span>
                </div>
                <div>
                    <span class="label">Tax</span>
                    <span style="margin-left: 64px;">${totals.totalTax?.toLocaleString() || '0'}</span>
                </div>
            </div>

            <!-- Amount in words section -->
            <div class="p-0 overflow-x-auto">
                <table class="w-full text-xxs md:text-xs border-black border-collapse">
                    <tr>
                        <td class="border-r-2 border-b-2 border-black font-semibold w-1/3 align-top p-1 md:p-2">
                            This Folio is in ${currency.code}
                        </td>
                        <td class="border-r-2 border-b-2 border-black w-1/3 align-top p-1 md:p-2">
                            ${amountInWords}
                        </td>
                        <td class="border-b-2 border-black w-1/3 align-top p-1 md:p-2 font-semibold">Total Paid</td>
                        <td class="border-b-2 border-black w-1/6 align-top p-1 md:p-2 text-right">${totals.totalPaid.toLocaleString()}</td>
                    </tr>
                    <tr>
                        <td class="border-black p-1 md:p-2"></td>
                        <td class="border-r-2 border-black p-1 md:p-2"></td>
                        <td class="border-b-2 border-black font-semibold p-1 md:p-2">Balance</td>
                        <td class="border-b-2 border-black p-1 md:p-2 text-right">${totals.balance.toLocaleString()}</td>
                    </tr>
                </table>
            </div>

            <!-- Bill To Section -->
            <div class="bill-to-section">
                <div style="margin-bottom: 8px;">
                    <span class="label">Bill To</span>
                    <span style="margin-left: 48px;">${reservation.guest?.displayName || 'N/A'}</span>
                </div>
                <div>
                    <span class="label">Address</span>
                    <span style="margin-left: 40px;">${reservation.guest?.address || reservation.guest?.country || 'N/A'}</span>
                </div>
                <div class="guest-signature">
                    <span>( Guest Signature )</span>
                </div>
            </div>

            <!-- Remark Section -->
            <div class="remark-section">
                <span class="label">Remark</span>
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
                <div><span class="label">Reserved By:</span> ${reservation.reservedBy || 'N/A'}</div>
                <div><span class="label">Checked In By:</span> ${reservation.checkedInBy || 'N/A'}</div>
                <div><span class="label">Checked Out By:</span> ${reservation.checkedOutBy || 'N/A'}</div>
            </div>
        </div>
    </body>
    </html>
        `
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
    return amount.toLocaleString('en-US', {
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