import { test } from '@japa/runner'
import { ChannexService } from '#services/channex_service'
import axios from 'axios'
import env from '#start/env'

class FakeAxiosClient {
  config: any
  interceptors = {
    request: {
      handlers: [] as any[],
      use: (onFulfilled: any, onRejected?: any) => {
        this.interceptors.request.handlers.push({ onFulfilled, onRejected })
        return 0
      },
    },
    response: {
      handlers: [] as any[],
      use: (onFulfilled: any, onRejected?: any) => {
        this.interceptors.response.handlers.push({ onFulfilled, onRejected })
        return 0
      },
    },
  }
  lastGetCall: { endpoint?: string; opts?: any } = {}
  constructor(config: any) {
    this.config = config
  }
  async get(endpoint: string, opts?: any) {
    this.lastGetCall = { endpoint, opts }
    return { data: { ok: true, endpoint, params: opts?.params, items: [1, 2] } }
  }
  async post(endpoint: string, data?: any) { return { data: { ok: true, endpoint, data } } }
  async put(endpoint: string, data?: any) { return { data: { ok: true, endpoint, data } } }
  async patch(endpoint: string, data?: any) { return { data: { ok: true, endpoint, data } } }
  async delete(endpoint: string) { return { data: { ok: true, endpoint } } }
}

test.group('ChannexService', () => {
  test('constructor configures axios with baseURL and headers', ({ assert }) => {
    const originalCreate = axios.create
    const originalEnvGet = (env as any).get
    let capturedConfig: any = null
    let fakeClient: FakeAxiosClient | null = null
    try {
      ;(env as any).get = (key: string) => {
        if (key === 'CHANNEX_API_KEY') return 'TEST_API_KEY'
        if (key === 'CHANNEX_BASE_URL') return 'http://fake-base'
        return undefined
      }
      ;(axios as any).create = (config: any) => {
        capturedConfig = config
        fakeClient = new FakeAxiosClient(config)
        return fakeClient
      }

      const svc = new ChannexService()
      assert.exists(svc)
      assert.equal(capturedConfig.baseURL, 'http://fake-base')
      assert.equal(capturedConfig.headers['user-api-key'], 'TEST_API_KEY')
      assert.lengthOf((fakeClient as any).interceptors.request.handlers, 1)
      assert.lengthOf((fakeClient as any).interceptors.response.handlers, 1)
    } finally {
      ;(axios as any).create = originalCreate
      ;(env as any).get = originalEnvGet
    }
  })

  test('listProperties performs GET and returns response data', async ({ assert }) => {
    const originalCreate = axios.create
    const originalEnvGet = (env as any).get
    let fakeClient: FakeAxiosClient | null = null
    try {
      ;(env as any).get = (key: string) => {
        if (key === 'CHANNEX_API_KEY') return 'KEY'
        if (key === 'CHANNEX_BASE_URL') return 'http://base'
        return undefined
      }
      ;(axios as any).create = (config: any) => {
        fakeClient = new FakeAxiosClient(config)
        return fakeClient
      }

      const svc = new ChannexService()
      const data = await svc.listProperties({ page: 1, per_page: 10 })
      assert.deepEqual(data, { ok: true, endpoint: '/properties', params: { page: 1, per_page: 10 }, items: [1, 2] })
      assert.deepEqual((fakeClient as any).lastGetCall.endpoint, '/properties')
      assert.deepEqual((fakeClient as any).lastGetCall.opts?.params, { page: 1, per_page: 10 })
    } finally {
      ;(axios as any).create = originalCreate
      ;(env as any).get = originalEnvGet
    }
  })
})