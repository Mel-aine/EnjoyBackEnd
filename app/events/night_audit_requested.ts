import { BaseEvent } from '@adonisjs/core/events'

export default class NightAuditRequested extends BaseEvent {
  /**
   * Accept event data as constructor parameters
   */
  constructor(public jobId: number) {
    super()
  }
}