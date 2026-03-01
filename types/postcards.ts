export interface PostcardJob {
  id: string
  userId: string
  leadId: string | null
  leadMonth: string
  postgridLetterId: string | null
  postgridStatus: string | null
  recipientAddressLine: string
  recipientPostcode: string
  stripePaymentIntentId: string | null
  wasIncludedInSubscription: boolean
  chargeAmountPence: number | null
  status: 'pending' | 'dispatched' | 'failed' | 'cancelled'
  dispatchedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PostcardCostSummary {
  selectedCount: number
  includedCount: number
  overageCount: number
  overageCostPence: number
  totalCostPence: number
}
