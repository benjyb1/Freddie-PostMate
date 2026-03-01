/** Format pence to a human-readable GBP string, e.g. 25000000 → "£250,000" */
export function formatPricePence(pence: number): string {
  const pounds = pence / 100
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pounds)
}

/** Format an ISO date string as "15 Jan 2025" */
export function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Format YYYY-MM as "January 2025" */
export function formatMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })
}

/** Current month key YYYY-MM in UTC */
export function currentMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}
