import emitter from '@adonisjs/core/services/emitter'
import NightAuditRequested from '#events/night_audit_requested'

emitter.on(NightAuditRequested, [() => import('#listeners/process_night_audit')])
