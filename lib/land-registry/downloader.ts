const DEFAULT_URL =
  process.env.LAND_REGISTRY_CSV_URL ??
  'http://prod.publicdata.landregistry.gov.uk.s3-website-eu-west-1.amazonaws.com/pp-monthly-update.txt'

export function getLandRegistryUrl(): string {
  return DEFAULT_URL
}

/**
 * Fetch the Land Registry CSV and return the raw ReadableStream<Uint8Array>.
 * Does NOT buffer the entire response — streams directly to the caller.
 * Throws if the HTTP response is not 2xx.
 */
export async function fetchLandRegistryCsvStream(): Promise<ReadableStream<Uint8Array>> {
  const url = getLandRegistryUrl()
  const response = await fetch(url, {
    // Prevent Next.js from caching this fetch
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(
      `Land Registry CSV download failed: HTTP ${response.status} from ${url}`
    )
  }

  if (!response.body) {
    throw new Error('Land Registry CSV response has no body')
  }

  return response.body
}
