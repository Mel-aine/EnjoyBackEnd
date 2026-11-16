import { test } from '@japa/runner'
import crypto from 'node:crypto'
import env from '#start/env'
import HubWebhooksController, { verifyHubSignature } from '#controllers/hub_webhooks_controller'

/** Same computation as connect-hub `signPayload` (webhook_service.ts). */
function sign(secret: string, timestamp: number, body: string) {
  const digest = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
  return `t=${timestamp},v1=${digest}`
}

test.group('Hub OTA | webhook controller', (group) => {
  const previous = env.get('HUB_ENABLED')
  group.each.teardown(() => env.set('HUB_ENABLED', previous as any))

  test('hub disabled: 404 without touching the database', async ({ assert }) => {
    env.set('HUB_ENABLED', undefined as any)
    let status = 0
    const ctx: any = {
      params: { hotelId: '1' },
      request: { raw: () => '{}', header: () => undefined, input: () => undefined },
      response: {
        notFound: () => (status = 404),
        unauthorized: () => (status = 401),
        accepted: () => (status = 202),
      },
    }
    await new HubWebhooksController().handle(ctx)
    assert.equal(status, 404)
  })
})

test.group('Hub OTA | webhook signature', () => {
  const secret = 'whsec_test'
  const body = JSON.stringify({ id: 'evt_1', type: 'booking.revision', data: { booking_id: 7 } })
  const now = 1_800_000_000

  test('accepts a valid signature', ({ assert }) => {
    assert.isTrue(verifyHubSignature(secret, sign(secret, now, body), body, now))
  })

  test('rejects another secret, a changed body, a missing header', ({ assert }) => {
    assert.isFalse(verifyHubSignature(secret, sign('other', now, body), body, now))
    assert.isFalse(verifyHubSignature(secret, sign(secret, now, body), body + ' ', now))
    assert.isFalse(verifyHubSignature(secret, undefined, body, now))
    assert.isFalse(verifyHubSignature('', sign(secret, now, body), body, now))
  })

  test('rejects an old or future timestamp (replay)', ({ assert }) => {
    assert.isFalse(verifyHubSignature(secret, sign(secret, now - 301, body), body, now))
    assert.isFalse(verifyHubSignature(secret, sign(secret, now + 301, body), body, now))
    assert.isTrue(verifyHubSignature(secret, sign(secret, now - 299, body), body, now))
  })

  test('rejects malformed headers without throwing', ({ assert }) => {
    for (const header of ['garbage', 't=abc,v1=zz', 'v1=00', `t=${now}`, `t=${now},v1=xyz`]) {
      assert.isFalse(verifyHubSignature(secret, header, body, now))
    }
  })
})
