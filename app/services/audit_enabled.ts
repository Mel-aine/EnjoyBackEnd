/** Opt-in only, after the prepared migrations have been applied by an operator. */
export function auditEnabled(): boolean {
  return process.env.AUDIT_TRAIL_ENABLED === 'true'
}
