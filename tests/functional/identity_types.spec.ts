import { test } from '@japa/runner'
import Database from '@adonisjs/lucid/services/db'
import User from '#models/user'

async function loginAndGetToken(client: any, email: string, password: string) {
  await User.create({ email, password, firstName: 'ID', lastName: 'Tester', status: 'active' })
  const res = await client.post('/api/auth').json({ email, password })
  const body = res.body()
  return body.data?.user_token?.value || body.data?.user_token?.token
}

test.group('Identity Types', (group) => {
  group.setup(async () => {
    await Database.beginGlobalTransaction()
  })

  group.teardown(async () => {
    await Database.rollbackGlobalTransaction()
  })

  test('GET /api/identity_types requires auth', async ({ client, assert }) => {
    const response = await client.get('/api/identity_types')
    assert.equal(response.status(), 401)
  })

  test('GET /api/identity_types without hotelId returns 400', async ({ client, assert }) => {
    const token = await loginAndGetToken(client, 'id.types@example.com', 'Password123!')
    const response = await client.get('/api/identity_types').header('Authorization', `Bearer ${token}`)
    assert.equal(response.status(), 400)
    const body = response.body()
    assert.equal(body.message, 'hotelId is required')
  })

  test('POST /api/identity_types creates identity type', async ({ client, assert }) => {
    const token = await loginAndGetToken(client, 'id.create@example.com', 'Password123!')

    const [hotelRow] = await Database.table('hotels')
      .insert({ hotel_name: 'Test Hotel', hotel_code: `TST-${Date.now()}` })
      .returning('id')

    const response = await client
      .post('/api/identity_types')
      .header('Authorization', `Bearer ${token}`)
      .json({ hotelId: hotelRow.id ?? hotelRow, name: 'Passport', shortCode: 'PASS' })

    assert.equal(response.status(), 201)
    const body = response.body()
    assert.equal(body.success, true)
    assert.equal(body.message, 'Identity type created successfully')
    assert.equal(body.data.name, 'Passport')
    assert.equal(body.data.shortCode, 'PASS')
    assert.equal(body.data.hotelId, hotelRow.id ?? hotelRow)
  })
})