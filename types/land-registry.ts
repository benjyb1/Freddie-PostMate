export interface PropertyTransaction {
  transactionId: string
  price: number // pence
  dateOfTransfer: string // ISO date string YYYY-MM-DD
  postcode: string
  propertyType: 'D' | 'S' | 'T' | 'F' | 'O'
  isNewBuild: boolean
  tenure: 'F' | 'L'
  paon: string | null
  saon: string | null
  street: string | null
  locality: string | null
  town: string | null
  district: string | null
  county: string | null
  recordStatus: 'A' | 'C' | 'D'
}

export type PropertyType = 'D' | 'S' | 'T' | 'F' | 'O'

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  D: 'Detached',
  S: 'Semi-detached',
  T: 'Terraced',
  F: 'Flat/Maisonette',
  O: 'Other',
}
