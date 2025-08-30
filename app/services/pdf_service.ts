import puppeteer from 'puppeteer'
import { DateTime } from 'luxon'

export interface InvoiceData {
  invoiceNumber: string
  invoiceDate: string
  dueDate?: string
  customerName: string
  customerAddress: string
  customerEmail?: string
  items: InvoiceItem[]
  subtotal: number
  tax: number
  total: number
  notes?: string
}

export interface IncidentalInvoiceData {
  invoiceNumber: string
  referenceNumber: string
  invoiceDate: string
  hotelName: string
  hotelAddress: string
  guestName: string
  guestEmail?: string
  billingName?: string
  billingAddress?: string
  billingCity?: string
  billingState?: string
  billingZip?: string
  billingCountry?: string
  charges: IncidentalCharge[]
  totalAmount: number
  taxAmount: number
  netAmount: number
  paymentType: string
  status: string
  notes?: string
}

export interface IncidentalCharge {
  description: string
  category?: string
  quantity: number
  unitPrice: number
  amount: number
  taxAmount?: number
  notes?: string
}

export interface InvoiceItem {
  description: string
  quantity: number
  unitPrice: number
  total: number
}

export interface PdfOptions {
  format?: 'A4' | 'Letter' | 'Legal'
  orientation?: 'portrait' | 'landscape'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
}

export default class PdfService {
  /**
   * Generate PDF from HTML content
   */
  static async generatePdfFromHtml(
    html: string,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    try {
      const page = await browser.newPage()
      await page.setContent(html, { waitUntil: 'networkidle0' })

      const pdfBuffer = await page.pdf({
        format: options.format || 'A4',
        landscape: options.orientation === 'landscape',
        margin: options.margin || {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        },
        printBackground: true
      })

      return Buffer.from(pdfBuffer)
    } finally {
      await browser.close()
    }
  }

  /**
   * Generate incidental invoice PDF
   */
  static async generateIncidentalInvoicePdf(
    invoiceData: IncidentalInvoiceData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const html = this.generateIncidentalInvoiceHtml(invoiceData)
    return this.generatePdfFromHtml(html, options)
  }

  /**
   * Generate invoice PDF
   */
  static async generateInvoicePdf(
    invoiceData: InvoiceData,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const html = this.generateInvoiceHtml(invoiceData)
    return this.generatePdfFromHtml(html, options)
  }

  /**
   * Generate receipt PDF
   */
  static async generateReceiptPdf(
    receiptData: any,
    options: PdfOptions = {}
  ): Promise<Buffer> {
    const html = this.generateReceiptHtml(receiptData)
    return this.generatePdfFromHtml(html, options)
  }

  /**
   * Generate HTML template for incidental invoice
   */
  private static generateIncidentalInvoiceHtml(data: IncidentalInvoiceData): string {
    const billingAddress = this.formatBillingAddress(data)
    const chargesHtml = data.charges.map(charge => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${charge.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${charge.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${charge.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${charge.amount.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(charge.taxAmount || 0).toFixed(2)}</td>
      </tr>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Incidental Invoice - ${data.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #007bff; padding-bottom: 20px; }
        .invoice-title { font-size: 28px; font-weight: bold; color: #007bff; margin-bottom: 10px; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .invoice-details, .billing-details { width: 48%; }
        .section-title { font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #007bff; }
        .charges-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .charges-table th { background-color: #007bff; color: white; padding: 12px; text-align: left; }
        .charges-table td { padding: 8px; border-bottom: 1px solid #eee; }
        .totals { float: right; width: 300px; margin-top: 20px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-row.final { font-weight: bold; font-size: 18px; border-top: 2px solid #007bff; padding-top: 10px; }
        .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
        .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; text-transform: uppercase; }
        .status.paid { background-color: #d4edda; color: #155724; }
        .status.pending { background-color: #fff3cd; color: #856404; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">INCIDENTAL INVOICE</div>
        <div>Hotel Voice Incidence System</div>
      </div>

      <div class="invoice-info">
        <div class="invoice-details">
          <div class="section-title">Invoice Details</div>
          <p><strong>Invoice Number:</strong> ${data.invoiceNumber}</p>
          <p><strong>Reference Number:</strong> ${data.referenceNumber}</p>
          <p><strong>Invoice Date:</strong> ${data.invoiceDate}</p>
          <p><strong>Status:</strong> <span class="status ${data.status.toLowerCase()}">${data.status}</span></p>
          <p><strong>Payment Method:</strong> ${data.paymentType}</p>
        </div>
        
        <div class="billing-details">
          <div class="section-title">Hotel Information</div>
          <p><strong>${data.hotelName}</strong></p>
          <p>${data.hotelAddress}</p>
          
          <div class="section-title" style="margin-top: 20px;">Guest Information</div>
          <p><strong>${data.guestName}</strong></p>
          ${data.guestEmail ? `<p>${data.guestEmail}</p>` : ''}
          
          ${billingAddress ? `
            <div class="section-title" style="margin-top: 20px;">Billing Address</div>
            ${billingAddress}
          ` : ''}
        </div>
      </div>

      <div class="section-title">Charges</div>
      <table class="charges-table">
        <thead>
          <tr>
            <th>Description</th>
            <th style="text-align: center;">Qty</th>
            <th style="text-align: right;">Unit Price</th>
            <th style="text-align: right;">Amount</th>
            <th style="text-align: right;">Tax</th>
          </tr>
        </thead>
        <tbody>
          ${chargesHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>$${(data.totalAmount - data.taxAmount).toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Tax:</span>
          <span>$${data.taxAmount.toFixed(2)}</span>
        </div>
        <div class="total-row final">
          <span>Total:</span>
          <span>$${data.netAmount.toFixed(2)}</span>
        </div>
      </div>

      <div style="clear: both;"></div>

      ${data.notes ? `
        <div style="margin-top: 30px;">
          <div class="section-title">Notes</div>
          <p>${data.notes}</p>
        </div>
      ` : ''}

      <div class="footer">
        <p>Thank you for your business!</p>
        <p>Generated on ${DateTime.now().toFormat('yyyy-MM-dd HH:mm:ss')}</p>
      </div>
    </body>
    </html>
    `
  }

  /**
   * Generate HTML template for regular invoice
   */
  private static generateInvoiceHtml(data: InvoiceData): string {
    const itemsHtml = data.items.map(item => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.total.toFixed(2)}</td>
      </tr>
    `).join('')

    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice - ${data.invoiceNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; }
        .invoice-title { font-size: 24px; font-weight: bold; color: #007bff; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .items-table th { background-color: #f8f9fa; padding: 12px; text-align: left; }
        .items-table td { padding: 8px; border-bottom: 1px solid #eee; }
        .totals { float: right; width: 200px; }
        .total-row { display: flex; justify-content: space-between; padding: 5px 0; }
        .total-row.final { font-weight: bold; border-top: 1px solid #333; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="invoice-title">INVOICE</div>
      </div>

      <div class="invoice-info">
        <div>
          <h3>Bill To:</h3>
          <p><strong>${data.customerName}</strong></p>
          <p>${data.customerAddress}</p>
          ${data.customerEmail ? `<p>${data.customerEmail}</p>` : ''}
        </div>
        <div>
          <p><strong>Invoice #:</strong> ${data.invoiceNumber}</p>
          <p><strong>Date:</strong> ${data.invoiceDate}</p>
          ${data.dueDate ? `<p><strong>Due Date:</strong> ${data.dueDate}</p>` : ''}
        </div>
      </div>

      <table class="items-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      <div class="totals">
        <div class="total-row">
          <span>Subtotal:</span>
          <span>$${data.subtotal.toFixed(2)}</span>
        </div>
        <div class="total-row">
          <span>Tax:</span>
          <span>$${data.tax.toFixed(2)}</span>
        </div>
        <div class="total-row final">
          <span>Total:</span>
          <span>$${data.total.toFixed(2)}</span>
        </div>
      </div>

      <div style="clear: both;"></div>

      ${data.notes ? `
        <div style="margin-top: 30px;">
          <h3>Notes:</h3>
          <p>${data.notes}</p>
        </div>
      ` : ''}
    </body>
    </html>
    `
  }

  /**
   * Generate HTML template for receipt
   */
  private static generateReceiptHtml(data: any): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
        .receipt { max-width: 400px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 20px; }
        .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
        .total { border-top: 1px solid #333; padding-top: 10px; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="receipt">
        <div class="header">
          <h2>RECEIPT</h2>
          <p>Receipt #: ${data.receiptNumber || 'N/A'}</p>
          <p>Date: ${data.date || new Date().toLocaleDateString()}</p>
        </div>
        
        <div class="item">
          <span>${data.description || 'Service'}</span>
          <span>$${(data.amount || 0).toFixed(2)}</span>
        </div>
        
        <div class="item total">
          <span>Total:</span>
          <span>$${(data.amount || 0).toFixed(2)}</span>
        </div>
        
        <div style="text-align: center; margin-top: 20px;">
          <p>Thank you!</p>
        </div>
      </div>
    </body>
    </html>
    `
  }

  /**
   * Format billing address for display
   */
  private static formatBillingAddress(data: IncidentalInvoiceData): string {
    if (!data.billingName && !data.billingAddress) {
      return ''
    }

    let address = ''
    if (data.billingName) {
      address += `<p><strong>${data.billingName}</strong></p>`
    }
    if (data.billingAddress) {
      address += `<p>${data.billingAddress}</p>`
    }
    
    const cityStateZip = [data.billingCity, data.billingState, data.billingZip]
      .filter(Boolean)
      .join(', ')
    
    if (cityStateZip) {
      address += `<p>${cityStateZip}</p>`
    }
    
    if (data.billingCountry) {
      address += `<p>${data.billingCountry}</p>`
    }

    return address
  }
}