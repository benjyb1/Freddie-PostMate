import Stripe from 'stripe'
import { getStripe } from './client'
import { createAdminClient } from '@/lib/supabase/admin'

export async function constructStripeEvent(
  rawBody: string,
  signature: string
): Promise<Stripe.Event> {
  const stripe = getStripe()
  return stripe.webhooks.constructEvent(
    rawBody,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!
  )
}

/**
 * Map Stripe subscription status strings to our profile status.
 * Stripe and our DB use the same values, so this is a passthrough,
 * but kept explicit for safety.
 */
function mapStatus(stripeStatus: Stripe.Subscription.Status): string {
  return stripeStatus
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createAdminClient()
  const userId = subscription.metadata?.userId
  if (!userId) {
    console.warn('Subscription has no userId metadata:', subscription.id)
    return
  }

  // In Stripe v20, current_period_end/start moved to items.data[0]
  const firstItem = subscription.items?.data?.[0]
  const periodEnd = firstItem?.current_period_end
  const periodStart = firstItem?.current_period_start

  await supabase
    .from('profiles')
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: mapStatus(subscription.status),
      subscription_period_end: periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null,
      current_period_start: periodStart
        ? new Date(periodStart * 1000).toISOString()
        : null,
    })
    .eq('id', userId)
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createAdminClient()
  const userId = subscription.metadata?.userId
  if (!userId) return

  await supabase
    .from('profiles')
    .update({ subscription_status: 'canceled' })
    .eq('id', userId)
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  // Reset postcard allowance on subscription renewal
  if (invoice.billing_reason !== 'subscription_cycle') return

  const supabase = createAdminClient()
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!customerId) return

  await supabase
    .from('profiles')
    .update({ postcards_used_this_period: 0 })
    .eq('stripe_customer_id', customerId)
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  const supabase = createAdminClient()
  const customerId =
    typeof invoice.customer === 'string'
      ? invoice.customer
      : invoice.customer?.id

  if (!customerId) return

  await supabase
    .from('profiles')
    .update({ subscription_status: 'past_due' })
    .eq('stripe_customer_id', customerId)
}
