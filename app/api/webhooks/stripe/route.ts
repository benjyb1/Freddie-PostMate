import { NextResponse } from 'next/server'
import {
  constructStripeEvent,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
} from '@/lib/stripe/webhooks'
import type Stripe from 'stripe'

// Disable body parsing — we need the raw body for Stripe signature verification
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = await constructStripeEvent(rawBody, signature)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    console.error('Stripe webhook signature error:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        // Silently ignore unhandled event types
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Webhook handler error'
    console.error(`Webhook handler error for ${event.type}:`, msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
