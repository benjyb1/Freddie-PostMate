import Link from 'next/link'
import {
  MapPin,
  Mail,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  ArrowRight,
  Building2,
} from 'lucide-react'

// Fully static marketing page — no Supabase calls needed
// Logged-in users navigating to /dashboard are handled by middleware
export default function HomePage() {

  return (
    <div className="min-h-screen bg-white">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-700" />
            <span className="text-lg font-bold text-slate-900">PropertyLeads</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm text-blue-700 mb-6">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-600"></span>
          </span>
          Monthly leads, automated
        </div>
        <h1 className="mx-auto max-w-3xl text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
          Turn Land Registry data into{' '}
          <span className="text-blue-700">postcard campaigns</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-xl text-slate-500 leading-relaxed">
          PropertyLeads automatically finds recent high-value property sales near your
          office every month and sends beautifully printed postcards to those addresses
          — with zero manual work.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-blue-800 transition-all hover:shadow-blue-200"
          >
            Start free — £10/month
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-8 py-3.5 text-base font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-sm text-slate-400">No contracts. Cancel any time.</p>
      </section>

      {/* ── How it works ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-4">
            Three steps. Fully automatic.
          </h2>
          <p className="text-center text-slate-500 mb-14 max-w-xl mx-auto">
            Every month, we do the heavy lifting — you just choose which properties to
            target.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                icon: TrendingUp,
                step: '01',
                title: 'We find the sales',
                body: 'On the 21st of each month we download the latest HM Land Registry data and filter it to properties within your chosen radius.',
              },
              {
                icon: MapPin,
                step: '02',
                title: 'You pick your targets',
                body: 'Log in to review your leads table — sorted by proximity, price, or type. Tick the addresses you want to reach.',
              },
              {
                icon: Mail,
                step: '03',
                title: 'We send the postcards',
                body: 'Confirm and we dispatch via PostGrid. Royal Mail delivers your postcard to each address and you track status in real time.',
              },
            ].map(({ icon: Icon, step, title, body }) => (
              <div key={step} className="rounded-2xl bg-white p-8 shadow-sm border border-slate-100">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xs font-bold text-blue-500 tracking-widest">{step}</span>
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-blue-700" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-3xl font-bold text-slate-900 mb-14">
            Everything included
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Clock, title: 'Auto-scheduled', body: 'Runs on the 21st & 22nd of every month without any action from you.' },
              { icon: MapPin, title: 'Smart radius expansion', body: 'If fewer than 15 leads are found, we automatically expand your search radius up to 50 miles.' },
              { icon: Mail, title: 'Printed & posted', body: 'PostGrid handles professional printing and Royal Mail delivery to every selected address.' },
              { icon: TrendingUp, title: 'Real-time tracking', body: 'See each postcard move from printing → mailed → delivered in your portal.' },
              { icon: Shield, title: 'Land Registry data', body: 'Sourced directly from HM Land Registry — the official UK property transaction register.' },
              { icon: CheckCircle, title: 'Filter your way', body: 'Sort by price, distance, or property type. Only send to the leads that matter to you.' },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4 p-6 rounded-xl border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
                <div className="h-9 w-9 shrink-0 rounded-lg bg-blue-50 flex items-center justify-center mt-0.5">
                  <Icon className="h-4 w-4 text-blue-700" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 mb-1">{title}</p>
                  <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="bg-slate-50 py-20">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">Simple pricing</h2>
          <p className="text-slate-500 mb-10">One plan. Everything included.</p>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
            <div className="bg-blue-700 px-8 py-8 text-white">
              <p className="text-sm font-medium opacity-80 mb-1">Monthly subscription</p>
              <div className="flex items-end justify-center gap-1">
                <span className="text-5xl font-extrabold">£10</span>
                <span className="text-xl opacity-70 mb-1">/month</span>
              </div>
            </div>
            <div className="px-8 py-8 space-y-3">
              {[
                'Unlimited monthly lead generation',
                '10 postcards included per month',
                'Additional postcards £1 each',
                'Real-time postcard tracking',
                'Automatic radius expansion',
                'Email notifications when leads are ready',
                'No setup fee · Cancel any time',
              ].map((item) => (
                <div key={item} className="flex items-start gap-3 text-sm text-slate-700">
                  <CheckCircle className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
              <div className="pt-4">
                <Link
                  href="/signup"
                  className="block w-full rounded-xl bg-blue-700 py-3 text-center text-sm font-semibold text-white hover:bg-blue-800 transition-colors"
                >
                  Get started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 text-center">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="text-3xl font-bold text-slate-900 mb-4">
            Ready to grow your property pipeline?
          </h2>
          <p className="text-slate-500 mb-8">
            Join estate agents and solicitors already using PropertyLeads to reach
            motivated homeowners every month.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-700 px-8 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-blue-800 transition-all"
          >
            Start for £10/month
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t py-8">
        <div className="mx-auto max-w-6xl px-6 flex flex-col items-center justify-between gap-4 text-sm text-slate-400 sm:flex-row">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="font-medium text-slate-600">PropertyLeads</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-slate-600 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-slate-600 transition-colors">Sign up</Link>
          </div>
          <p>Data sourced from HM Land Registry · Printed by PostGrid</p>
        </div>
      </footer>
    </div>
  )
}
