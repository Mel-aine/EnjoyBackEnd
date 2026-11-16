import { test } from '@japa/runner'
import env from '#start/env'
import ChannexBookingCron, { isChannexBookingCronEnabled } from '#services/channex_booking_cron'

test.group('Channex booking cron', (group) => {
  const previous = env.get('CHANNEX_BOOKING_SYNC_CRON')
  group.each.teardown(() => env.set('CHANNEX_BOOKING_SYNC_CRON', previous as any))

  test('off by default: runAll does nothing and touches no database', async ({ assert }) => {
    env.set('CHANNEX_BOOKING_SYNC_CRON', undefined as any)
    assert.isFalse(isChannexBookingCronEnabled())
    assert.deepEqual(await ChannexBookingCron.runAll(), [])
  })

  test('on only when explicitly true', ({ assert }) => {
    env.set('CHANNEX_BOOKING_SYNC_CRON', true as any)
    assert.isTrue(isChannexBookingCronEnabled())
  })
})
