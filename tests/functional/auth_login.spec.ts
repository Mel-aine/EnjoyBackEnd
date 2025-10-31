import { test } from '@japa/runner'
import Database from '@adonisjs/lucid/services/db'
import User from '#models/user'

test.group('Auth Login', (group) => {
  group.setup(async () => {
    await Database.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await Database.rollbackGlobalTransaction()
  })

  test('logs in with valid credentials and returns token', async ({ client, assert }) => {
    const email = 'functional.user@example.com'
    const password = 'Password123!'

    await User.create({
      email,
      password,
      firstName: 'Functional',
      lastName: 'Tester',
      status: 'active',
    })

    const response = await client.post('/api/auth').json({ email, password })

    assert.equal(response.status(), 200)

    const body = response.body()
    assert.equal(body.status, 'success')
    assert.exists(body.data?.user_token, 'user_token should exist')

    const token = body.data?.user_token?.value || body.data?.user_token?.token
    assert.exists(token, 'token value should exist')
  })
})