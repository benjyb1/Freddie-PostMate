/**
 * Returns the actual run date for a given target day of the month.
 * If the target day falls on a Saturday or Sunday, defers to the following Monday.
 */
export function getScheduledRunDate(
  targetDayOfMonth: number,
  referenceDate: Date = new Date()
): Date {
  const year = referenceDate.getUTCFullYear()
  const month = referenceDate.getUTCMonth()

  const target = new Date(Date.UTC(year, month, targetDayOfMonth))
  const dayOfWeek = target.getUTCDay() // 0=Sun, 6=Sat

  if (dayOfWeek === 6) {
    // Saturday → Monday
    target.setUTCDate(targetDayOfMonth + 2)
  } else if (dayOfWeek === 0) {
    // Sunday → Monday
    target.setUTCDate(targetDayOfMonth + 1)
  }

  return target
}

/**
 * Returns true if today (UTC) is the day the cron should actually run,
 * accounting for weekend deferral.
 */
export function isScheduledRunDay(
  targetDayOfMonth: number,
  now: Date = new Date()
): boolean {
  const scheduledDate = getScheduledRunDate(targetDayOfMonth, now)

  const todayStr = now.toISOString().slice(0, 10)
  const scheduledStr = scheduledDate.toISOString().slice(0, 10)

  return todayStr === scheduledStr
}

/** Format a Date to YYYY-MM (used as import_month / lead_month keys) */
export function toMonthKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7)
}
