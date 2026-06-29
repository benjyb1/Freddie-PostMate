import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculatePostcardCost, billPendingOverage } from '@/lib/stripe/billing'
import { sendPostcard, buildRecipient } from '@/lib/postcards/stannp'
import { currentMonthKey } from '@/lib/utils/date'
import { POSTCARD_OVERAGE_PENCE } from '@/types/profile'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { jobId } = await request.json() as { jobId: string }
  if (!jobId) return NextResponse.json({ error: 'jobId required' }, { status: 400 })

  // Fetch the original job
  const { data: job, error: jobError } = await supabase
    .from('postcard_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single()

  if (jobError || !job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, stripe_subscription_id, postcards_used_this_period, postcard_design_url, postcard_design_back_url, full_name, subscription_status')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  if (!['active', 'trialing'].includes(profile.subscription_status as string)) {
    return NextResponse.json({ error: 'Active subscription required' }, { status: 403 })
  }

  const frontUrl = profile.postcard_design_url as string | null
  const backUrl = profile.postcard_design_back_url as string | null
  if (!frontUrl || !backUrl) {
    return NextResponse.json(
      { error: 'Add a front and back postcard design before re-sending.' },
      { status: 400 }
    )
  }

  const used = profile.postcards_used_this_period as number
  const { included } = calculatePostcardCost(1, used)
  const isIncluded = included > 0

  if (!isIncluded && !profile.stripe_customer_id) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 403 })
  }

  const adminSupabase = createAdminClient()

  // Deterministic idempotency key for this (user, job, month). Stannp has no
  // idempotency-key header, so we claim the send at OUR layer first: insert a
  // pending row carrying this key, which is protected by a UNIQUE partial index.
  // A concurrent double-click loses the insert race and never reaches Stannp, so
  // it can't print a second card.
  const idempotencyKey = createHash('sha256')
    .update(`resend:${user.id}:${jobId}:${currentMonthKey()}`)
    .digest('hex')
    .slice(0, 40)

  const { data: pending, error: insertErr } = await adminSupabase.from('postcard_jobs').insert({
    user_id: user.id,
    lead_id: job.lead_id,
    lead_month: job.lead_month,
    recipient_address_line: job.recipient_address_line,
    recipient_postcode: job.recipient_postcode,
    was_included_in_subscription: true,
    charge_amount_pence: 0,
    status: 'pending',
    dispatch_idempotency_key: idempotencyKey,
  }).select('id').single()

  if (insertErr || !pending) {
    // Unique-key violation (23505) means an identical resend already claimed this
    // slot — treat it as a dedupe rather than billing or printing twice.
    if (insertErr?.code === '23505') {
      return NextResponse.json({ success: true, deduped: true })
    }
    return NextResponse.json({ error: insertErr?.message ?? 'Could not create postcard job' }, { status: 500 })
  }
  const newJobId = pending.id as string

  // We own the slot — print and post.
  let postcardId = ''
  let status = ''
  try {
    const recipient = buildRecipient(
      job.recipient_address_line as string,
      job.recipient_postcode as string,
    )
    ;({ id: postcardId, status } = await sendPostcard({
      to: recipient,
      frontUrl,
      backUrl,
      tag: idempotencyKey,
    }))
  } catch (err) {
    // Release the pending row so the card becomes eligible to retry rather than
    // being stuck "pending".
    await adminSupabase.from('postcard_jobs').update({ status: 'failed' }).eq('id', newJobId)
    const msg = err instanceof Error ? err.message : 'Dispatch failed'
    return NextResponse.json({ error: msg }, { status: 502 })
  }

  // Card is away — record the Stannp id/status and the real charge.
  await adminSupabase.from('postcard_jobs').update({
    postgrid_letter_id: postcardId,
    postgrid_status: status,
    was_included_in_subscription: isIncluded,
    charge_amount_pence: isIncluded ? 0 : POSTCARD_OVERAGE_PENCE,
    status: 'dispatched',
    dispatched_at: new Date().toISOString(),
  }).eq('id', newJobId)

  // Bill any unbilled overage (this card plus anything left pending earlier).
  // Idempotent and self-healing — nothing to reconcile by hand.
  let overageBilled = 0
  if (profile.stripe_customer_id) {
    try {
      overageBilled = await billPendingOverage(user.id, profile.stripe_customer_id as string)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Resend overage billing sweep failed for user ${user.id} (will retry on next activity):`, msg)
    }
  }

  // Atomic counter increment, with read-modify-write fallback.
  const { error: incErr } = await adminSupabase.rpc('increment_postcards_used', {
    p_user_id: user.id,
    p_amount: 1,
  })
  if (incErr) {
    const { data: fresh } = await adminSupabase
      .from('profiles')
      .select('postcards_used_this_period')
      .eq('id', user.id)
      .single()
    await adminSupabase
      .from('profiles')
      .update({
        postcards_used_this_period: ((fresh?.postcards_used_this_period as number) ?? used) + 1,
      })
      .eq('id', user.id)
  }

  return NextResponse.json({ success: true, overageBilled })
}
