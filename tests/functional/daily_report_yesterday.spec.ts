import { test } from '@japa/runner'
import TodayReportService from '#services/today_report_service'

test.group('Daily Report Yesterday Sections', () => {
  test('includes yesterday sections in TodayReportService data', async ({ assert }) => {
    const hotelId = 2
    const data = await TodayReportService.buildDataForTodayHtml(hotelId)
    assert.isArray(data.yesterdaySections)
    assert.ok(data.yesterdaySections.length >= 0)
    const keys = data.yesterdaySections.map((s) => s.key)
    assert.deepInclude(keys, 'due_out')
    assert.deepInclude(keys, 'confirmed_departure')
    assert.deepInclude(keys, 'booking_confirmed')
    assert.deepInclude(keys, 'arrival')
    assert.deepInclude(keys, 'extended')
    assert.deepInclude(keys, 'cancelled_booking')
  })
})
