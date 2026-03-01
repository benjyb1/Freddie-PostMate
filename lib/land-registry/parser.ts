import { parse } from 'csv-parse'
import type { PropertyTransaction } from '@/types/land-registry'

// Land Registry Price Paid CSV column indices (0-based)
// {GUID},{Price},{TransferDate},{Postcode},{PropertyType},{NewBuild},{Duration},
// {PAON},{SAON},{Street},{Locality},{Town},{District},{County},{Category},{RecordStatus}
const COL = {
  TRANSACTION_ID: 0,
  PRICE: 1,
  DATE: 2,
  POSTCODE: 3,
  PROPERTY_TYPE: 4,
  NEW_BUILD: 5,
  DURATION: 6,
  PAON: 7,
  SAON: 8,
  STREET: 9,
  LOCALITY: 10,
  TOWN: 11,
  DISTRICT: 12,
  COUNTY: 13,
  CATEGORY: 14,
  RECORD_STATUS: 15,
}

function nullIfEmpty(value: string): string | null {
  return value.trim() === '' ? null : value.trim()
}

/** Build a human-readable address line from PAON, SAON, Street, Locality, Town */
export function buildAddressLine(
  paon: string | null,
  saon: string | null,
  street: string | null,
  locality: string | null,
  town: string | null
): string {
  return [saon, paon, street, locality, town]
    .filter(Boolean)
    .join(', ')
}

/**
 * Parse the Land Registry CSV ReadableStream into PropertyTransaction objects.
 *
 * Filters:
 *  - Category A only (standard market sales)
 *  - Record status A (add) and C (change) are yielded
 *  - Record status D (delete) is yielded so the importer can handle deletions
 *
 * Uses csv-parse in streaming mode to avoid buffering the full file.
 */
export async function* parseLandRegistryCsvStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<PropertyTransaction> {
  // Convert Web ReadableStream to Node.js Readable for csv-parse
  const { Readable } = await import('stream')
  const nodeStream = Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0])

  const parser = nodeStream.pipe(
    parse({
      relax_quotes: true,
      skip_empty_lines: true,
    })
  )

  for await (const row of parser) {
    // Filter category B transactions
    const category = (row[COL.CATEGORY] ?? '').trim().toUpperCase()
    if (category !== 'A') continue

    const recordStatus = (row[COL.RECORD_STATUS] ?? 'A').trim().toUpperCase() as
      | 'A'
      | 'C'
      | 'D'

    const propertyType = (row[COL.PROPERTY_TYPE] ?? '').trim().toUpperCase()
    if (!['D', 'S', 'T', 'F', 'O'].includes(propertyType)) continue

    const postcode = nullIfEmpty(row[COL.POSTCODE])
    if (!postcode) continue // skip rows without a postcode

    // Convert price from string pounds to integer pence
    const priceStr = (row[COL.PRICE] ?? '').trim()
    const price = Math.round(parseFloat(priceStr) * 100)
    if (isNaN(price) || price <= 0) continue

    yield {
      transactionId: row[COL.TRANSACTION_ID].trim(),
      price,
      dateOfTransfer: row[COL.DATE].trim(),
      postcode,
      propertyType: propertyType as PropertyTransaction['propertyType'],
      isNewBuild: row[COL.NEW_BUILD].trim().toUpperCase() === 'Y',
      tenure: row[COL.DURATION].trim().toUpperCase() === 'F' ? 'F' : 'L',
      paon: nullIfEmpty(row[COL.PAON]),
      saon: nullIfEmpty(row[COL.SAON]),
      street: nullIfEmpty(row[COL.STREET]),
      locality: nullIfEmpty(row[COL.LOCALITY]),
      town: nullIfEmpty(row[COL.TOWN]),
      district: nullIfEmpty(row[COL.DISTRICT]),
      county: nullIfEmpty(row[COL.COUNTY]),
      recordStatus,
    }
  }
}
