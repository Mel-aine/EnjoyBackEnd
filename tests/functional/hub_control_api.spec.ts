import { test } from '@japa/runner'
import env from '#start/env'
import { resetHubControlRateLimit } from '#middleware/hub_control_middleware'

const KEY = 'control-test-key'

test.group('Hub control API', (group) => {
  group.each.setup(() => {
    resetHubControlRateLimit()
    const previous = env.get('HUB_CONTROL_KEY')
    ;(env as any).set('HUB_CONTROL_KEY', KEY)
    return () => (env as any).set('HUB_CONTROL_KEY', previous ?? '')
  })

  test('rejects a request without the shared key', async ({ client }) => {
    const res = await client.get('/api/hub-control/hotels')
    res.assertStatus(401)
    res.assertBodyContains({ error: { code: 'unauthorized' } })
  })

  test('rejects a wrong key', async ({ client }) => {
    const res = await client
      .get('/api/hub-control/hotels')
      .header('authorization', 'Bearer not-the-key')
    res.assertStatus(401)
  })

  test('lists hotels with the shared key', async ({ client, assert }) => {
    const res = await client
      .get('/api/hub-control/hotels')
      .header('authorization', `Bearer ${KEY}`)
    res.assertStatus(200)
    assert.isArray(res.body().data)
  })

  test('answers 503 when no key is configured', async ({ client }) => {
    ;(env as any).set('HUB_CONTROL_KEY', '')
    const res = await client
      .get('/api/hub-control/hotels')
      .header('authorization', `Bearer ${KEY}`)
    res.assertStatus(503)
    res.assertBodyContains({ error: { code: 'not_configured' } })
  })
})
