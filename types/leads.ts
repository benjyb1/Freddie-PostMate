export interface Lead {
  id: string
  userId: string
  transactionId: string
  addressLine: string
  postcode: string
  price: number // pence
  propertyType: 'D' | 'S' | 'T' | 'F' | 'O'
  isNewBuild: boolean
  tenure: 'F' | 'L'
  dateOfTransfer: string
  distanceMiles: number
  selectedForDispatch: boolean
  leadMonth: string // YYYY-MM
  postcardJobId: string | null
  createdAt: string
}

export interface LeadWithSelection extends Lead {
  selected: boolean
}
