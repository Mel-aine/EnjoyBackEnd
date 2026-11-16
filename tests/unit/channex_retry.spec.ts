import { test } from '@japa/runner'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import env from '#start/env'
import { ChannexService } from '#services/channex_service'

/** Fake Channex: answers with the statuses given, one per call (last one repeats). */
async function fakeChannex(statuses: number[]) {
  const calls: string[] = []
  const bodies: any[] = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', () => {
      calls.push(`${req.method} ${req.url}`)
      bodies.push(raw ? JSON.parse(raw) : null)
      const status = statuses[Math.min(calls.length - 1, statuses.length - 1)]
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(status < 400 ? { data: [] } : { message: 'boom' }))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as AddressInfo).port
  return { calls, bodies, url: `http://127.0.0.1:${port}/api/v1`, close: () => server.close() }
}

const availability = {
  values: [
    {
      room_type_id: 'rt',
      property_id: 'p',
      date_from: '2027-01-01',
      date_to: '2027-01-01',
      availability: 1,
    },
  ],
}

test.group('Channex | retries of ARI pushes', (group) => {
  const previousUrl = env.get('CHANNEX_BASE_URL')
  const previousKey = env.get('CHANNEX_API_KEY')
  const previousDelays = ChannexService.retryDelaysMs
  group.each.setup(() => {
    ChannexService.retryDelaysMs = [5, 5, 5]
    env.set('CHANNEX_API_KEY', 'test-key')
  })
  group.each.teardown(() => {
    ChannexService.retryDelaysMs = previousDelays
    env.set('CHANNEX_BASE_URL', previousUrl as any)
    env.set('CHANNEX_API_KEY', previousKey as any)
  })

  test('availability: retried after a 503, then succeeds', async ({ assert }) => {
    const fake = await fakeChannex([503, 200])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      await new ChannexService().updateAvailability('p', availability)
      assert.deepEqual(fake.calls, ['POST /api/v1/availability', 'POST /api/v1/availability'])
    } finally {
      fake.close()
    }
  })

  test('restrictions: retried after a 429', async ({ assert }) => {
    const fake = await fakeChannex([429, 429, 200])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      await new ChannexService().updateRestrictions('p', { values: [] })
      assert.lengthOf(fake.calls, 3)
    } finally {
      fake.close()
    }
  })

  test('a 422 is not retried and is thrown as before', async ({ assert }) => {
    const fake = await fakeChannex([422])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      await assert.rejects(() => new ChannexService().updateAvailability('p', availability))
      assert.lengthOf(fake.calls, 1)
    } finally {
      fake.close()
    }
  })

  test('gives up after 3 retries (4 calls) and throws', async ({ assert }) => {
    const fake = await fakeChannex([500])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      await assert.rejects(() => new ChannexService().updateAvailability('p', availability))
      assert.lengthOf(fake.calls, 4)
    } finally {
      fake.close()
    }
  })

  test('network error is retried', async ({ assert }) => {
    env.set('CHANNEX_BASE_URL', 'http://127.0.0.1:1/api/v1')
    const started = Date.now()
    await assert.rejects(() => new ChannexService().updateAvailability('p', availability))
    assert.isBelow(Date.now() - started, 5000)
  })

  test('a retried older push never lands after a newer one', async ({ assert }) => {
    const fake = await fakeChannex([503, 200, 200])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      const push = (value: number) =>
        new ChannexService().updateAvailability('p', {
          values: [{ ...availability.values[0], availability: value }],
        })
      await Promise.all([push(1), push(2)])
      // Old value (1) fails, is retried, and only then the new one (2) is sent.
      assert.deepEqual(
        fake.bodies.map((b) => b.values[0].availability),
        [1, 1, 2]
      )
    } finally {
      fake.close()
    }
  })

  test('non-idempotent calls (create property) are never retried', async ({ assert }) => {
    const fake = await fakeChannex([503])
    try {
      env.set('CHANNEX_BASE_URL', fake.url)
      await assert.rejects(() => new ChannexService().createProperty({ title: 'x' } as any))
      assert.lengthOf(fake.calls, 1)
    } finally {
      fake.close()
    }
  })
})
