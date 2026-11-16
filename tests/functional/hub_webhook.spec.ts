import { test } from '@japa/runner'
import env from '#start/env'

test.group('Hub OTA | webhook route', (group) => {
  const previous = env.get('HUB_ENABLED')
  group.each.teardown(() => env.set('HUB_ENABLED', previous as any))

  test('answers 404 while the hub is disabled (default)', async ({ client }) => {
    env.set('HUB_ENABLED', undefined as any)
    const response = await client
      .post('/api/webhooks/hub/1')
      .header('X-Hub-Signature', 't=1,v1=00')
      .json({ type: 'booking.revision', data: {} })
    response.assertStatus(404)
  })
})
