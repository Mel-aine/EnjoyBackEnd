import { test } from '@japa/runner'
import { isActiveOccupancyStatus } from '#app/utils/occupancy_statuses'

test.group('Occupancy status helper', () => {
  test('treats confirmed and legacy checked-in values as active occupancy statuses', async ({ assert }) => {
    assert.isTrue(isActiveOccupancyStatus('confirmed'))
    assert.isTrue(isActiveOccupancyStatus('checked_in'))
    assert.isTrue(isActiveOccupancyStatus('checked-in'))
    assert.isTrue(isActiveOccupancyStatus('checked_out'))
    assert.isTrue(isActiveOccupancyStatus('checked-out'))
    assert.isTrue(isActiveOccupancyStatus('completed'))
    assert.isFalse(isActiveOccupancyStatus('reserved'))
  })
})
