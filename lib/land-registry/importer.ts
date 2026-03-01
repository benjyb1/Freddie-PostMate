import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLandRegistryCsvStream } from './downloader'
import { parseLandRegistryCsvStream, buildAddressLine } from './parser'
import type { PropertyTransaction } from '@/types/land-registry'

const BATCH_SIZE = 500

interface ImportResult {
  rowsDownloaded: number
  rowsInserted: number
  rowsSkipped: number
  rowsDeleted: number
}

interface DbRow {
  transaction_id: string
  price: number
  date_of_transfer: string
  postcode: string
  property_type: string
  is_new_build: boolean
  tenure: string
  paon: string | null
  saon: string | null
  street: string | null
  locality: string | null
  town: string | null
  district: string | null
  county: string | null
  address_line: string
  import_month: string
}

function toDbRow(tx: PropertyTransaction, importMonth: string): DbRow {
  return {
    transaction_id: tx.transactionId,
    price: tx.price,
    date_of_transfer: tx.dateOfTransfer,
    postcode: tx.postcode,
    property_type: tx.propertyType,
    is_new_build: tx.isNewBuild,
    tenure: tx.tenure,
    paon: tx.paon,
    saon: tx.saon,
    street: tx.street,
    locality: tx.locality,
    town: tx.town,
    district: tx.district,
    county: tx.county,
    address_line: buildAddressLine(tx.paon, tx.saon, tx.street, tx.locality, tx.town),
    import_month: importMonth,
  }
}

/**
 * Batch-upsert an array of transactions into the property_transactions table.
 * Returns counts of inserted and skipped rows.
 */
async function upsertBatch(
  supabase: ReturnType<typeof createAdminClient>,
  rows: DbRow[]
): Promise<{ inserted: number; skipped: number }> {
  const { error, count } = await supabase
    .from('property_transactions')
    .upsert(rows, {
      onConflict: 'transaction_id,import_month',
      count: 'exact',
    })

  if (error) {
    console.error('Batch upsert error:', error.message)
    return { inserted: 0, skipped: rows.length }
  }

  return { inserted: count ?? rows.length, skipped: 0 }
}

/**
 * Full import pipeline:
 * 1. Stream CSV from HMLR
 * 2. Parse and filter (category A only)
 * 3. Batch upsert into property_transactions
 * 4. Handle deletions
 */
export async function runImport(importMonth: string): Promise<ImportResult> {
  const supabase = createAdminClient()

  const stream = await fetchLandRegistryCsvStream()
  const parser = parseLandRegistryCsvStream(stream)

  let rowsDownloaded = 0
  let rowsInserted = 0
  let rowsSkipped = 0
  let rowsDeleted = 0

  const insertBatch: DbRow[] = []
  const deleteIds: string[] = []

  for await (const tx of parser) {
    rowsDownloaded++

    if (tx.recordStatus === 'D') {
      deleteIds.push(tx.transactionId)
      if (deleteIds.length >= BATCH_SIZE) {
        await supabase
          .from('property_transactions')
          .delete()
          .in('transaction_id', deleteIds)
        rowsDeleted += deleteIds.length
        deleteIds.length = 0
      }
      continue
    }

    insertBatch.push(toDbRow(tx, importMonth))

    if (insertBatch.length >= BATCH_SIZE) {
      const { inserted, skipped } = await upsertBatch(supabase, [...insertBatch])
      rowsInserted += inserted
      rowsSkipped += skipped
      insertBatch.length = 0
    }
  }

  // Flush remaining inserts
  if (insertBatch.length > 0) {
    const { inserted, skipped } = await upsertBatch(supabase, insertBatch)
    rowsInserted += inserted
    rowsSkipped += skipped
  }

  // Flush remaining deletes
  if (deleteIds.length > 0) {
    await supabase
      .from('property_transactions')
      .delete()
      .in('transaction_id', deleteIds)
    rowsDeleted += deleteIds.length
  }

  return { rowsDownloaded, rowsInserted, rowsSkipped, rowsDeleted }
}
