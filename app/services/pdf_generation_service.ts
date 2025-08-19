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
                        <td class="text-right">${transaction.amount > 0 ? transaction.amount.toLocaleString() : ''}</td>
                        <td class="text-right">${transaction.amount < 0 ? Math.abs(transaction.amount).toLocaleString() : ''}</td>
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
}