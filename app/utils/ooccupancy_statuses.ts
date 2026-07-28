export function isActiveOccupancyStatus(status?: string | null): boolean {
  if (!status) return false

  const normalized = status.toLowerCase().trim()
  const activeStatuses = new Set([
    'checked_in',
    'checked-in',
    'checked_out',
    'checked-out',
    'completed',
    'confirmed',
  ])

  return activeStatuses.has(normalized)
}
