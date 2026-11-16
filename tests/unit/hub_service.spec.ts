import { test } from '@japa/runner'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import env from '#start/env'
import HubService, { HubError, isHubEnabled, isHotelOnHub } from '#services/hub_service'
import {
  hubOnReservationChange,
  hubOnReservationRoomChange,
  hubOnRoomBlockChange,
} from '#services/hub_hooks'

type Seen = { method: string; url: string; apiKey: string | undefined; body: any }

/** Fake hub: `handler` decides the status and body of each call. */
async function fakeHub(handler: (seen: Seen, index: number) => { status: number; body?: any }) {
  const seen: Seen[] = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      const entry: Seen = {
        method: req.method!,
        url: req.url!,
        apiKey: req.headers['x-api-key'] as string | undefined,
        body: raw ? JSON.parse(raw) : null,
      }
      seen.push(entry)
      const out = handler(entry, seen.length - 1)
      res.writeHead(out.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(out.body ?? {}))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return { seen, url: `http://127.0.0.1:${port}/v1`, close: () => server.close() }
}

test.group('Hub OTA | client', (group) => {
  const previous = {
    enabled: env.get('HUB_ENABLED'),
    url: env.get('HUB_BASE_URL'),
  }
  group.each.teardown(() => {
    env.set('HUB_ENABLED', previous.enabled as any)
    env.set('HUB_BASE_URL', previous.url as any)
  })

  test('disabled by default: no client for any hotel', ({ assert }) => {
    env.set('HUB_ENABLED', undefined as any)
    assert.isFalse(isHubEnabled())
    assert.isFalse(isHotelOnHub({ hubApiKey: 'k' }))
    assert.isNull(HubService.forHotel({ hubApiKey: 'k' }))
  })

  test('enabled: client only for hotels with an API key', ({ assert }) => {
    env.set('HUB_ENABLED', true as any)
    env.set('HUB_BASE_URL', 'http://127.0.0.1:1/v1')
    assert.isNull(HubService.forHotel({ hubApiKey: null }))
    assert.isNull(HubService.forHotel(null))
    assert.instanceOf(HubService.forHotel({ hubApiKey: 'k' }), HubService)
  })

  test('putAvailability sends the key, splits in chunks and merges oversold', async ({
    assert,
  }) => {
    const hub = await fakeHub((s) => ({
      status: 200,
      body: {
        status: 'accepted',
        updated: s.body.items.length,
        oversold: [{ room_type_id: 1, date: s.body.items[0].date, total: 0, held: 0, sold: 1 }],
      },
    }))
    try {
      env.set('HUB_BASE_URL', hub.url)
      const items = Array.from({ length: 900 }, (_, i) => ({
        room_type_id: 1,
        date: `2027-01-${String((i % 28) + 1).padStart(2, '0')}`,
        total: 2,
      }))
      const res = await new HubService('pms_key').putAvailability(items)
      assert.equal(hub.seen.length, 3) // 400 + 400 + 100
      assert.deepEqual(
        hub.seen.map((s) => s.body.items.length),
        [400, 400, 100]
      )
      assert.isTrue(hub.seen.every((s) => s.method === 'PUT' && s.url === '/v1/availability'))
      assert.isTrue(hub.seen.every((s) => s.apiKey === 'pms_key'))
      assert.equal(res.updated, 900)
      assert.lengthOf(res.oversold, 3)
    } finally {
      hub.close()
    }
  })

  test('retries a 5xx, then succeeds', async ({ assert }) => {
    const hub = await fakeHub((_, i) =>
      i === 0
        ? { status: 503, body: { error: { code: 'unavailable' } } }
        : { status: 200, body: { updated: 1 } }
    )
    try {
      env.set('HUB_BASE_URL', hub.url)
      const res = await new HubService('k').putAvailability([
        { room_type_id: 1, date: '2027-01-01', total: 1 },
      ])
      assert.equal(hub.seen.length, 2)
      assert.equal(res.updated, 1)
    } finally {
      hub.close()
    }
  })

  test('does not retry a 4xx and exposes the hub error code', async ({ assert }) => {
    const hub = await fakeHub(() => ({ status: 409, body: { error: { code: 'stale_revision' } } }))
    try {
      env.set('HUB_BASE_URL', hub.url)
      try {
        await new HubService('k').ackBooking(12, 3)
        assert.fail('should have thrown')
      } catch (err) {
        assert.instanceOf(err, HubError)
        assert.equal((err as HubError).status, 409)
        assert.equal((err as HubError).code, 'stale_revision')
      }
      assert.equal(hub.seen.length, 1)
      assert.equal(hub.seen[0].url, '/v1/bookings/revisions/12/ack')
      assert.deepEqual(hub.seen[0].body, { revision_seq: 3 })
    } finally {
      hub.close()
    }
  })

  test('unreachable hub gives a network_error HubError', async ({ assert }) => {
    env.set('HUB_BASE_URL', 'http://127.0.0.1:1/v1')
    try {
      await new HubService('k').getWebhook()
      assert.fail('should have thrown')
    } catch (err) {
      assert.instanceOf(err, HubError)
      assert.equal((err as HubError).code, 'network_error')
    }
  }).timeout(10000)
})

test.group('Hub OTA | model hooks never break the caller', (group) => {
  const previous = env.get('HUB_ENABLED')
  group.each.teardown(() => env.set('HUB_ENABLED', previous as any))

  const weird = [
    undefined,
    null,
    {},
    { hotelId: 'x', $original: null, checkInDate: 'not a date' },
    { hotelId: 1, hubBookingId: 5, status: 'cancelled', $trx: { isCompleted: false } },
  ]

  test('disabled: hooks return without doing anything', ({ assert }) => {
    env.set('HUB_ENABLED', undefined as any)
    for (const model of weird) {
      assert.doesNotThrow(() => hubOnReservationRoomChange(model))
      assert.doesNotThrow(() => hubOnReservationChange(model))
      assert.doesNotThrow(() => hubOnRoomBlockChange(model))
    }
  })

  test('enabled: hooks still never throw on odd input', ({ assert }) => {
    env.set('HUB_ENABLED', true as any)
    for (const model of weird) {
      assert.doesNotThrow(() => hubOnReservationRoomChange(model))
      assert.doesNotThrow(() => hubOnReservationChange(model))
      assert.doesNotThrow(() => hubOnRoomBlockChange(model))
    }
  })
})
