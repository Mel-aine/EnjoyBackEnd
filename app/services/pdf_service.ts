import htmlPdf from 'html-pdf-node'
import { DateTime } from 'luxon'

export interface InvoiceData {
  invoiceNumber: string
  guestName: string
  guestAddress?: string
  hotelName: string
  hotelAddress?: string
  issueDate: string
  dueDate: string
  items: InvoiceItem[]
  subtotal: number
  tax?: number
  taxRate?: number
  total: number
  currency?: string
  notes?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
  date?: string
}

export interface PdfOptions {
  format?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
}

export class PdfService {
  /**
   * Generate PDF from HTML content
   */
  static async generatePdfFromHtml(
    html: string,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const defaultOptions = {
      format: 'A4',
      orientation: 'portrait',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      },
      ...options
    }

    const pdfOptions = {
      format: defaultOptions.format,
      landscape: defaultOptions.orientation === 'landscape',
      margin: defaultOptions.margin,
      printBackground: true,
      preferCSSPageSize: true
    }

    try {
      const file = { content: html }
      const pdfBuffer = await htmlPdf.generatePdf(file, pdfOptions)
      return pdfBuffer
    } catch (error) {
      console.error('PDF generation failed:', error)
      throw new Error(`Failed to generate PDF: ${error.message}`)
    }
  }

  /**
   * Generate invoice PDF
   */
  static async generateInvoicePdf(
    invoiceData: InvoiceData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const html = this.generateInvoiceHtml(invoiceData)
    return await this.generatePdfFromHtml(html, options)
  }

  /**
   * Generate HTML template for invoice
   */
  private static generateInvoiceHtml(data: InvoiceData): string {
    const currency = data.currency || '$'
    const taxAmount = data.tax || (data.subtotal * (data.taxRate || 0) / 100)
    
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invoice ${data.invoiceNumber}</title>
        <style>
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body {
                font-family: 'Arial', sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
                background: white;
            }
            
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 30px;
                border-bottom: 2px solid #2c5aa0;
                padding-bottom: 20px;
            }
            
            .hotel-info {
                flex: 1;
            }
            
            .hotel-name {
                font-size: 24px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 5px;
            }
            
            .hotel-address {
                color: #666;
                font-size: 11px;
            }
            
            .invoice-title {
                text-align: right;
                flex: 1;
            }
            
            .invoice-number {
                font-size: 28px;
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 5px;
            }
            
            .invoice-dates {
                font-size: 11px;
                color: #666;
            }
            
            .billing-info {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            
            .bill-to {
                flex: 1;
            }
            
            .section-title {
                font-weight: bold;
                color: #2c5aa0;
                margin-bottom: 10px;
                font-size: 14px;
            }
            
            .guest-info {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 5px;
                border-left: 4px solid #2c5aa0;
            }
            
            .items-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            
            .items-table th {
                background: #2c5aa0;
                color: white;
                padding: 12px 8px;
                text-align: left;
                font-weight: bold;
                font-size: 11px;
                text-transform: uppercase;
            }
            
            .items-table td {
                padding: 10px 8px;
                border-bottom: 1px solid #eee;
                font-size: 11px;
            }
            
            .items-table tr:nth-child(even) {
                background: #f8f9fa;
            }
            
            .items-table tr:hover {
                background: #e3f2fd;
            }
            
            .text-right {
                text-align: right;
            }
            
            .text-center {
                text-align: center;
            }
            
            .totals {
                float: right;
                width: 300px;
                margin-bottom: 30px;
            }
            
            .totals-table {
                width: 100%;
                border-collapse: collapse;
            }
            
            .totals-table td {
                padding: 8px 12px;
                border-bottom: 1px solid #eee;
                font-size: 12px;
            }
            
            .totals-table .label {
                font-weight: bold;
                text-align: right;
                color: #666;
            }
            
            .totals-table .amount {
                text-align: right;
                font-weight: bold;
            }
            
            .total-row {
                background: #2c5aa0;
                color: white;
            }
            
            .total-row td {
                font-size: 14px;
                font-weight: bold;
                border-bottom: none;
            }
            
            .notes {
                clear: both;
                margin-top: 30px;
                padding: 15px;
                background: #f8f9fa;
                border-radius: 5px;
                border-left: 4px solid #28a745;
            }
            
            .notes-title {
                font-weight: bold;
                color: #28a745;
                margin-bottom: 8px;
            }
            
            .footer {
                margin-top: 40px;
                text-align: center;
                font-size: 10px;
                color: #666;
                border-top: 1px solid #eee;
                padding-top: 20px;
            }
            
            @media print {
                .invoice-container {
                    max-width: none;
                    margin: 0;
                    padding: 0;
                }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <!-- Header -->
            <div class="header">
                <div class="hotel-info">
                    <div class="hotel-name">${data.hotelName}</div>
                    ${data.hotelAddress ? `<div class="hotel-address">${data.hotelAddress}</div>` : ''}
                </div>
                <div class="invoice-title">
                    <div class="invoice-number">INVOICE</div>
                    <div class="invoice-number">#${data.invoiceNumber}</div>
                    <div class="invoice-dates">
                        <div>Issue Date: ${data.issueDate}</div>
                        <div>Due Date: ${data.dueDate}</div>
                    </div>
                </div>
            </div>
            
            <!-- Billing Information -->
            <div class="billing-info">
                <div class="bill-to">
                    <div class="section-title">Bill To:</div>
                    <div class="guest-info">
                        <div style="font-weight: bold; margin-bottom: 5px;">${data.guestName}</div>
                        ${data.guestAddress ? `<div>${data.guestAddress}</div>` : ''}
                    </div>
                </div>
            </div>
            
            <!-- Items Table -->
            <table class="items-table">
                <thead>
                    <tr>
                        <th>Description</th>
                        <th class="text-center">Date</th>
                        <th class="text-center">Qty</th>
                        <th class="text-right">Unit Price</th>
                        <th class="text-right">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.items.map(item => `
                        <tr>
                            <td>${item.description}</td>
                            <td class="text-center">${item.date || '-'}</td>
                            <td class="text-center">${item.quantity}</td>
                            <td class="text-right">${currency}${item.unitPrice.toFixed(2)}</td>
                            <td class="text-right">${currency}${item.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <!-- Totals -->
            <div class="totals">
                <table class="totals-table">
                    <tr>
                        <td class="label">Subtotal:</td>
                        <td class="amount">${currency}${data.subtotal.toFixed(2)}</td>
                    </tr>
                    ${taxAmount > 0 ? `
                        <tr>
                            <td class="label">Tax ${data.taxRate ? `(${data.taxRate}%)` : ''}:</td>
                            <td class="amount">${currency}${taxAmount.toFixed(2)}</td>
                        </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td class="label">TOTAL:</td>
                        <td class="amount">${currency}${data.total.toFixed(2)}</td>
                    </tr>
                </table>
            </div>
            
            <!-- Notes -->
            ${data.notes ? `
                <div class="notes">
                    <div class="notes-title">Notes:</div>
                    <div>${data.notes}</div>
                </div>
            ` : ''}
            
            <!-- Footer -->
            <div class="footer">
                <div>Thank you for your business!</div>
                <div>Generated on ${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}</div>
            </div>
        </div>
    </body>
    </html>
    `
  }

  /**
   * Generate a simple receipt PDF
   */
  static async generateReceiptPdf(
    receiptData: {
      receiptNumber: string
      guestName: string
      hotelName: string
      date: string
      items: InvoiceItem[]
      total: number
      paymentMethod?: string
      currency?: string
    },
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const currency = receiptData.currency || '$'
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Receipt ${receiptData.receiptNumber}</title>
        <style>
            body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
            .receipt-header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
            .hotel-name { font-size: 18px; font-weight: bold; }
            .receipt-number { font-size: 14px; margin: 10px 0; }
            .receipt-info { margin: 15px 0; }
            .items { width: 100%; border-collapse: collapse; margin: 15px 0; }
            .items th, .items td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
            .items th { background-color: #f2f2f2; }
            .total { text-align: right; font-weight: bold; font-size: 14px; margin-top: 10px; }
            .footer { text-align: center; margin-top: 20px; font-size: 10px; }
        </style>
    </head>
    <body>
        <div class="receipt-header">
            <div class="hotel-name">${receiptData.hotelName}</div>
            <div class="receipt-number">Receipt #${receiptData.receiptNumber}</div>
            <div>Date: ${receiptData.date}</div>
        </div>
        
        <div class="receipt-info">
            <strong>Guest:</strong> ${receiptData.guestName}<br>
            ${receiptData.paymentMethod ? `<strong>Payment Method:</strong> ${receiptData.paymentMethod}<br>` : ''}
        </div>
        
        <table class="items">
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                ${receiptData.items.map(item => `
                    <tr>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>${currency}${item.unitPrice.toFixed(2)}</td>
                        <td>${currency}${item.total.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="total">
            <strong>Total: ${currency}${receiptData.total.toFixed(2)}</strong>
        </div>
        
        <div class="footer">
            Thank you for your business!<br>
            Generated on ${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}
        </div>
    </body>
    </html>
    `
    
    return await this.generatePdfFromHtml(html, options)
  }
}