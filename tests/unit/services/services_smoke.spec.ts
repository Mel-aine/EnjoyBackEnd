import { test } from '@japa/runner'

// Smoke tests to ensure all service modules load and expose expected exports

test.group('Services | Smoke', () => {
  test('AuditTrailService loads', async ({ assert }) => {
    const mod = await import('#services/audit_trail_service')
    assert.exists(mod.default)
    assert.typeOf(mod.default.getAuditTrail, 'function')
  })

  test('BookingSourceService loads', async ({ assert }) => {
    const mod = await import('#services/booking_source_service')
    assert.exists(mod.default)
  })

  test('ChannexService loads', async ({ assert }) => {
    const mod = await import('#services/channex_service')
    assert.exists(mod.ChannexService)
    assert.typeOf(mod.ChannexService, 'function')
  })

  test('CheckoutService loads', async ({ assert }) => {
    const mod = await import('#services/checkout_service')
    assert.exists(mod.default)
  })

  test('CityLedgerService loads', async ({ assert }) => {
    const mod = await import('#services/city_ledger_service')
    assert.exists(mod.default)
  })

  test('CompanyAccountService loads', async ({ assert }) => {
    const mod = await import('#services/company_account_service')
    assert.exists(mod.default)
  })

  test('CompanyFolioService loads', async ({ assert }) => {
    const mod = await import('#services/company_folio_service')
    assert.exists(mod.default)
  })

  test('CrudService loads', async ({ assert }) => {
    const mod = await import('#services/crud_service')
    assert.exists(mod.default)
    assert.typeOf(mod.default, 'function')
  })

  test('Dashboard services load', async ({ assert }) => {
    const mod1 = await import('#services/dashboard_service')
    assert.exists(mod1.default)
    const mod2 = await import('#services/dasboard_servicepd')
    assert.exists(mod2.default)
  })

  test('Email services load', async ({ assert }) => {
    const acc = await import('#services/email_account_service')
    const tpl = await import('#services/email_template_service')
    assert.exists(acc.default)
    assert.exists(tpl.default)
  })

  test('Folio services load', async ({ assert }) => {
    const folioSvc = await import('#services/folio_service')
    assert.exists(folioSvc.default)
    const folioPrint = await import('#services/folio_print_service')
    assert.exists(folioPrint.default)
    const folioInquiry = await import('#services/folio_inquiry_service')
    assert.exists(folioInquiry.default)
  })

  test('GuestSummaryService loads', async ({ assert }) => {
    const mod = await import('#services/guest_summary_service')
    assert.exists(mod.default)
  })

  test('HotelAnalyticsService loads', async ({ assert }) => {
    const mod = await import('#services/hotel_analytics_service')
    assert.exists(mod.default)
  })

  test('HouseKeeperService loads', async ({ assert }) => {
    const mod = await import('#services/house_keeper_service')
    assert.exists(mod.default)
  })

  test('HtmlReportsService loads', async ({ assert }) => {
    const mod = await import('#services/htmlReports_service')
    assert.exists(mod.HtmlReportGenerator)
  })

  test('IncidentalInvoiceService loads', async ({ assert }) => {
    const mod = await import('#services/incidental_invoice_service')
    assert.exists(mod.default)
  })

  test('LoggerService loads', async ({ assert }) => {
    const mod = await import('#services/logger_service')
    assert.exists(mod.default)
    assert.typeOf(mod.default.extractChanges, 'function')
  })

  test('LostFoundService loads', async ({ assert }) => {
    const mod = await import('#services/lost_found_service')
    assert.exists(mod.default)
  })

  test('NightAuditService loads', async ({ assert }) => {
    const mod = await import('#services/night_audit_service')
    assert.exists(mod.default)
  })

  test('PDF services load', async ({ assert }) => {
    const pdfGen = await import('#services/pdf_generation_service')
    assert.exists(pdfGen.default)
    const pdfSvc = await import('#services/pdf_service')
    assert.exists(pdfSvc.default)
  })

  test('PermissionService loads', async ({ assert }) => {
    const mod = await import('#services/permission_service')
    assert.exists(mod.default)
  })

  test('PricingService loads', async ({ assert }) => {
    const mod = await import('#services/pricingService')
    assert.exists(mod.default)
  })

  test('ReceiptService loads', async ({ assert }) => {
    const mod = await import('#services/receipt_service')
    assert.exists(mod.default)
  })

  test('ReportsService loads and exposes mappings', async ({ assert }) => {
    const mod = await import('#services/reports_service')
    assert.exists(mod.default)
    assert.typeOf(mod.default.getAvailableReports, 'function')
  })

  test('Reservation services load', async ({ assert }) => {
    const resSvc = await import('#services/reservation_service')
    assert.exists(resSvc.default)
    const resCreateSvc = await import('#services/reservation_creation_service')
    assert.exists(resCreateSvc.default)
    const resRoomSvc = await import('#services/reservation_room_service')
    assert.exists(resRoomSvc.default)
    const resFolioSvc = await import('#services/reservation_folio_service')
    assert.exists(resFolioSvc.default)
  })

  test('VIPStatusService loads', async ({ assert }) => {
    const mod = await import('#services/vip_status_service')
    assert.exists(mod.default)
  })
})