import emitter from '@adonisjs/core/services/emitter'
import NightAuditRequested from '#events/night_audit_requested'
import ReservationCheckedOut from '#events/reservation_checked_out'

emitter.on(NightAuditRequested, [() => import('#listeners/process_night_audit')])
emitter.on(ReservationCheckedOut, [() => import('#listeners/schedule_feedback_survey')])
