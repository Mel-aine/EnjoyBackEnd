import { test } from '@japa/runner'
import env from '#start/env'
import HubRateSync, { expandChannexValues, hubValuesFromChannex } from '#services/hub_rate_sync'

test.group('Hub OTA | Channex values → hub rates', () => {
  test('converts bulk ARI values (decimal string, 0/1 flags)', ({ assert }) => {
    assert.deepEqual(
      hubValuesFromChannex({
        rate: '35000.00',
        min_stay_arrival: 2,
        min_stay_through: 2,
        max_stay: 7,
        closed_to_arrival: 1,
        closed_to_departure: 0,
        stop_sell: 0,
      }),
      {
        rate: 35000,
        stop_sell: false,
        closed_to_arrival: true,
        closed_to_departure: false,
        min_stay_arrival: 2,
        min_stay_through: 2,
        max_stay: 7,
      }
    )
  })

  test('keeps only the fields that were sent; min_stay fills both kinds', ({ assert }) => {
    assert.deepEqual(hubValuesFromChannex({ stop_sell: true }), { stop_sell: true })
    assert.deepEqual(hubValuesFromChannex({ min_stay: 3 }), {
      min_stay_arrival: 3,
      min_stay_through: 3,
    })
    assert.deepEqual(hubValuesFromChannex({ rate: 'abc', property_id: 'x' }), {})
  })

  test('expands date ranges, applies the days filter, maps plan ids', ({ assert }) => {
    const map = new Map([['chx-1', 77]])
    // 2027-03-01 is a Monday.
    const { items, unmapped } = expandChannexValues(
      [
        {
          rate_plan_id: 'chx-1',
          date_from: '2027-03-01',
          date_to: '2027-03-07',
          days: ['sa', 'su'],
          rate: '50000',
        },
        { rate_plan_id: 'chx-1', date: '2027-03-10', stop_sell: true },
        { rate_plan_id: 'chx-unknown', date: '2027-03-10', stop_sell: true },
      ],
      map
    )
    assert.deepEqual(items, [
      { rate_plan_id: 77, date: '2027-03-06', rate: 50000 },
      { rate_plan_id: 77, date: '2027-03-07', rate: 50000 },
      { rate_plan_id: 77, date: '2027-03-10', stop_sell: true },
    ])
    assert.deepEqual(unmapped, ['chx-unknown'])
  })

  test('caps very long ranges', ({ assert }) => {
    const { items } = expandChannexValues(
      [{ rate_plan_id: 'a', date_from: '2027-01-01', date_to: '2035-01-01', stop_sell: true }],
      new Map([['a', 1]])
    )
    assert.equal(items.length, 730)
  })

  test('mirror is a no-op that never throws while the hub is disabled', ({ assert }) => {
    const previous = env.get('HUB_ENABLED')
    env.set('HUB_ENABLED', undefined as any)
    try {
      assert.doesNotThrow(() =>
        HubRateSync.mirrorChannexRestrictions('prop', [{ rate_plan_id: 'a' }])
      )
      assert.doesNotThrow(() => HubRateSync.mirrorChannexRestrictions(null, null as any))
    } finally {
      env.set('HUB_ENABLED', previous as any)
    }
  })
})
