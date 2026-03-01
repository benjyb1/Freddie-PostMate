import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface SubscriptionBannerProps {
  status: string
}

export function SubscriptionBanner({ status }: SubscriptionBannerProps) {
  if (status === 'active' || status === 'trialing') return null

  const messages: Record<string, string> = {
    past_due: 'Your payment is overdue. Update your payment method to restore full access.',
    canceled: 'Your subscription has been cancelled. Resubscribe to access leads and postcards.',
    unpaid: 'Your account has unpaid invoices. Please update your billing details.',
    paused: 'Your subscription is paused.',
  }

  const message = messages[status] ?? 'There is an issue with your subscription.'

  return (
    <div className="flex items-center gap-3 border-b bg-amber-50 px-6 py-3 text-sm text-amber-800">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>{message}</span>
      <Link href="/billing" className="ml-auto shrink-0 font-medium underline">
        Manage billing →
      </Link>
    </div>
  )
}
