import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Clock,
  Lock,
  Play,
  Scale,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/ui/wordmark'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-cream">
      <MarketingNav />
      <MarketingHero />
      <TrustStrip />
      <HowItWorks />
      <AudienceSplit />
      <Pricing />
      <MarketingFooter />
    </div>
  )
}

function MarketingNav() {
  return (
    <div
      className="sticky top-0 z-40 border-b backdrop-blur"
      style={{ borderColor: 'rgba(226,232,240,.8)', background: 'rgba(247,243,236,.85)' }}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8">
        <Wordmark />
        <nav className="hidden items-center gap-8 text-[13.5px] text-slate-600 md:flex">
          <a className="hover:text-ink" href="#how">
            How it works
          </a>
          <a className="hover:text-ink" href="#investors">
            For Investors
          </a>
          <a className="hover:text-ink" href="#issuers">
            For Issuers
          </a>
          <a className="hover:text-ink" href="#pricing">
            Pricing
          </a>
          <Link className="hover:text-ink" href="/about">
            About
          </Link>
          <Link className="hover:text-ink" href="/verify-public">
            Verify a letter
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild variant="gold" size="sm">
            <Link href="/sign-up">
              Start verification
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function MarketingHero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(1100px 500px at 80% -10%, rgba(11,31,58,.06), transparent 60%)',
        }}
      />
      <div className="mx-auto grid max-w-7xl grid-cols-12 items-center gap-12 px-8 pb-16 pt-20">
        <div className="col-span-12 lg:col-span-7">
          <div className="fadeup" style={{ animationDelay: '.05s' }}>
            <span
              className="smallcaps inline-flex items-center gap-2 rounded-full border bg-paper px-3 py-1 text-[11px] font-semibold text-slate-600"
              style={{ borderColor: 'var(--slate-200)' }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Reg D · Rule 506(b) / 506(c) ready
            </span>
          </div>
          <h1
            className="fadeup mt-6 font-serif text-[56px] leading-[1.02] tracking-[-0.02em] text-ink sm:text-[64px]"
            style={{ animationDelay: '.18s', fontWeight: 500 }}
          >
            SEC-compliant
            <br />
            accredited investor
            <br />
            verification —
            <br />
            <span className="italic" style={{ color: 'var(--ink-700)' }}>
              in minutes, not hours or days.
            </span>
          </h1>
          <p
            className="fadeup mt-6 max-w-xl text-[17px] leading-[1.6] text-slate-600"
            style={{ animationDelay: '.32s' }}
          >
            Upload tax returns, brokerage statements, or a professional license through
            an encrypted pipeline. Key line items are extracted automatically, a licensed
            CPA reviews and signs, and a tamper-evident verification letter is issued that
            issuers accept on day one.
          </p>
          <div
            className="fadeup mt-8 flex flex-wrap items-center gap-3"
            style={{ animationDelay: '.46s' }}
          >
            <Button asChild variant="gold" size="lg">
              <Link href="/sign-up">
                Start free · beta access
                <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/sign-in?role=admin">
                <Play className="h-4 w-4" strokeWidth={1.8} />
                See the CPA workspace
              </Link>
            </Button>
          </div>
          <div
            className="fadeup mt-6 flex items-center gap-4 text-[12.5px] text-slate-500"
            style={{ animationDelay: '.6s' }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" strokeWidth={1.8} />
              Typical turnaround: minutes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
              Letter valid 90 days
            </span>
          </div>
        </div>

        <div className="fadeup col-span-12 lg:col-span-5" style={{ animationDelay: '.5s' }}>
          <HeroLetterPreview />
        </div>
      </div>
    </section>
  )
}

function HeroLetterPreview() {
  return (
    <div className="relative">
      <div
        className="letter-paper relative rounded-[10px] border p-7"
        style={{ borderColor: 'var(--slate-200)' }}
      >
        <div className="absolute left-0 right-0 top-0 h-[6px] rounded-t-[10px] bg-ink" />
        <div className="mt-3 flex items-start justify-between">
          <div>
            <div className="inline-flex items-end font-serif text-[18px] text-ink" style={{ fontWeight: 600 }}>
              AgFinTax
              <span className="ml-[2px] text-gold">.</span>
            </div>
            <div className="smallcaps mt-1 text-[10px] tracking-[.18em] text-slate-500">
              Accredited Investor Verification
            </div>
          </div>
          <Seal size={70} />
        </div>

        <div className="mt-6 space-y-2">
          <div className="stripes h-[8px] w-[70%] rounded" />
          <div className="stripes h-[8px] w-[90%] rounded" />
          <div className="stripes h-[8px] w-[82%] rounded" />
          <div className="stripes h-[8px] w-[50%] rounded" />
        </div>

        <div
          className="mt-5 rounded-[6px] border bg-bone p-3"
          style={{ borderColor: 'var(--slate-200)' }}
        >
          <div className="smallcaps text-[10px] text-slate-500">Basis</div>
          <div className="mt-0.5 font-serif text-[15px] text-ink" style={{ fontWeight: 600 }}>
            Income Test · Rule 501(a)(6)
          </div>
        </div>

        <div className="mt-5 flex items-end justify-between">
          <div>
            <div className="font-hand text-[22px] leading-none text-ink">Daniel Okafor</div>
            <div className="sig-line mt-1 w-48" />
            <div className="smallcaps mt-1 text-[10px] text-slate-500">
              Daniel Okafor, CPA · TX #082149
            </div>
          </div>
          <div className="text-right">
            <div className="smallcaps text-[10px] text-slate-500">Valid through</div>
            <div className="font-serif text-ink" style={{ fontWeight: 600 }}>
              Jul 16, 2026
            </div>
          </div>
        </div>
      </div>

      {/* Floating status chip */}
      <div
        className="absolute -left-3 -top-3 flex items-center gap-2 rounded-full border bg-paper py-1.5 pl-2 pr-3 elev"
        style={{ borderColor: 'var(--slate-200)' }}
      >
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: 'var(--success-50)' }}
        >
          <Check className="h-3 w-3 text-[var(--success)]" strokeWidth={2.5} />
        </span>
        <span className="text-[12px] font-semibold text-slate-700">Issued in 38 hours</span>
      </div>
    </div>
  )
}

function Seal({ size = 64 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="seal-ring absolute inset-0 rounded-full" />
      <div
        className="absolute inset-[6px] flex items-center justify-center rounded-full"
        style={{ background: '#FAF1D3', border: '1px solid rgba(0,0,0,.08)' }}
      >
        <div className="text-center leading-none">
          <div
            className="font-serif text-ink"
            style={{ fontSize: size * 0.2, fontWeight: 700 }}
          >
            CPA
          </div>
          <div
            className="smallcaps mt-1"
            style={{ fontSize: size * 0.08, color: '#8E6F10', letterSpacing: '.2em' }}
          >
            Verified
          </div>
        </div>
      </div>
      <svg className="absolute inset-0" viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <path
            id="sealCirc"
            d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"
          />
        </defs>
        <text
          fontSize="8"
          fill="#6B5512"
          letterSpacing="2"
          fontFamily="Fraunces, serif"
          fontWeight="600"
        >
          <textPath xlinkHref="#sealCirc" startOffset="0">
            ACCREDITED · VERIFIED · AGFINTAX ·{' '}
          </textPath>
        </text>
      </svg>
    </div>
  )
}

function TrustStrip() {
  const items = [
    { icon: Scale, title: 'Reviewed by licensed CPAs', sub: '50-state licensed network' },
    {
      icon: ShieldCheck,
      title: 'SOC 2 Type II aligned',
      sub: 'Annual audits, continuous monitoring',
    },
    {
      icon: Lock,
      title: 'Bank-level encryption',
      sub: 'AES-256 at rest · TLS 1.3 in transit',
    },
  ]
  return (
    <div
      className="border-y bg-bone"
      style={{ borderColor: 'var(--slate-200)' }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-8 py-7 md:grid-cols-3">
        {items.map((i) => {
          const Icon = i.icon
          return (
            <div key={i.title} className="flex items-start gap-3">
              <span
                className="flex h-9 w-9 items-center justify-center rounded-[8px] border bg-paper text-ink"
                style={{ borderColor: 'var(--slate-200)' }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.8} />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-slate-900">{i.title}</div>
                <div className="text-[12.5px] text-slate-500">{i.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HowItWorks() {
  const steps = [
    {
      n: '01',
      title: 'Upload securely',
      desc: 'Tax returns, W-2s, brokerage statements, or a Series 7/65/82 license. End-to-end encrypted in transit and at rest — nothing leaves your secure vault.',
      avg: '< 2 min',
    },
    {
      n: '02',
      title: 'Automatic field extraction',
      desc: 'Key line items — AGI, wages, net assets, and statement dates — are pulled into a review pane. You confirm every value before anything is submitted.',
      avg: '~ 1 min',
    },
    {
      n: '03',
      title: 'CPA letter',
      desc: 'A licensed CPA evaluates against Rule 501(a), signs, and issues a verification letter issuers accept on day one. Delivered as a tamper-evident PDF.',
      avg: 'minutes',
    },
  ]
  return (
    <section id="how" className="mx-auto max-w-7xl px-8 py-24">
      <div className="max-w-2xl">
        <div className="smallcaps text-[11px] text-slate-500">The process</div>
        <h2
          className="mt-2 font-serif text-[40px] leading-[1.1] tracking-[-0.01em] text-ink"
          style={{ fontWeight: 500 }}
        >
          Three steps. One letter. Every issuer accepts it.
        </h2>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="lift rounded-[10px] border border-slate-200 bg-paper p-7 elev"
          >
            <div
              className="font-serif text-[56px] leading-none text-gold"
              style={{ fontWeight: 500 }}
            >
              {s.n}
            </div>
            <div className="mt-5 font-serif text-[22px] text-ink" style={{ fontWeight: 600 }}>
              {s.title}
            </div>
            <p className="mt-2 text-[14px] leading-[1.6] text-slate-600">{s.desc}</p>
            <div className="mt-6 h-[1px] bg-slate-200" />
            <div className="mt-4 flex items-center justify-between text-[12px] text-slate-500">
              <span>Avg time</span>
              <span className="font-medium text-slate-700">{s.avg}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function AudienceSplit() {
  return (
    <section
      id="investors"
      className="border-y bg-bone"
      style={{ borderColor: 'var(--slate-200)' }}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-8 py-24 lg:grid-cols-2">
        <AudienceCard
          tag="For individuals"
          title="Prove accreditation once. Reinvest anywhere."
          points={[
            'Income, Net Worth, or Professional License basis',
            'Letter valid for 90 days · re-verify in clicks',
            'Accepted by 2,400+ issuers & fund platforms',
          ]}
          cta="For Investors"
        />
        <AudienceCard
          tag="For issuers & funds"
          title="Onboard accredited LPs without chasing paper."
          points={[
            'Bulk verification for syndicates and SPVs',
            'Branded investor experience · co-signed letters',
            'API & webhook notifications on letter issue',
          ]}
          cta="For Issuers"
          variant="dark"
        />
      </div>
    </section>
  )
}

function AudienceCard({
  tag,
  title,
  points,
  cta,
  variant = 'light',
}: {
  tag: string
  title: string
  points: string[]
  cta: string
  variant?: 'light' | 'dark'
}) {
  const dark = variant === 'dark'
  return (
    <div
      className="lift rounded-[10px] border p-10"
      style={{
        background: dark ? 'var(--ink)' : 'white',
        borderColor: dark ? 'transparent' : 'var(--slate-200)',
        color: dark ? 'white' : 'inherit',
      }}
    >
      <div className={`smallcaps text-[11px] ${dark ? 'text-[#C9A227]' : 'text-slate-500'}`}>
        {tag}
      </div>
      <h3
        className={`mt-2 font-serif text-[32px] leading-[1.1] tracking-[-0.01em] ${
          dark ? '' : 'text-ink'
        }`}
        style={{ fontWeight: 500 }}
      >
        {title}
      </h3>
      <ul className="mt-6 space-y-3">
        {points.map((p) => (
          <li
            key={p}
            className="flex items-start gap-2.5 text-[14px]"
            style={{ color: dark ? 'rgba(255,255,255,.82)' : 'var(--slate-600)' }}
          >
            <span
              className="mt-[3px] flex h-4 w-4 items-center justify-center rounded-full"
              style={{ background: dark ? 'rgba(201,162,39,.2)' : 'var(--cream)' }}
            >
              <Check className="h-[11px] w-[11px] text-gold" strokeWidth={2.5} />
            </span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <button
          className={`inline-flex items-center gap-2 text-[13px] font-semibold transition-all hover:gap-3 ${
            dark ? 'text-gold' : 'text-ink'
          }`}
        >
          {cta}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  )
}

function Pricing() {
  return (
    <section id="pricing" className="mx-auto max-w-3xl px-8 py-24 text-center">
      <div className="smallcaps text-[11px] text-slate-500">Pricing</div>
      <h2
        className="mt-2 font-serif text-[40px] leading-[1.1] tracking-[-0.01em] text-ink"
        style={{ fontWeight: 500 }}
      >
        Free during beta. Invite-only access.
      </h2>
      <p className="mt-4 text-[14.5px] leading-[1.7] text-slate-600">
        Anyone with the link can verify right now — no card, no plan picking.
        Flat fees go live when we open generally; beta users keep grandfathered
        pricing.
      </p>
      <div className="mt-8 flex items-center justify-center">
        <Button asChild variant="gold" size="lg">
          <Link href="/sign-up">Start free · beta access</Link>
        </Button>
      </div>
    </section>
  )
}

function MarketingFooter() {
  const cols: { h: string; l: string[] }[] = [
    { h: 'Product', l: ['How it works', 'For Investors', 'For Issuers', 'Pricing', 'API'] },
    { h: 'Company', l: ['About', 'CPA Network', 'Careers', 'Press'] },
    { h: 'Legal', l: ['Terms', 'Privacy', 'Security', 'Compliance', 'Subprocessors'] },
  ]
  return (
    <footer className="bg-ink text-white/80">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-10 px-8 py-16 md:grid-cols-5">
        <div className="col-span-2">
          <div
            className="inline-flex items-end font-serif text-[22px] text-white"
            style={{ fontWeight: 600 }}
          >
            AgFinTax
            <span
              className="mb-[8px] ml-[3px] h-[5px] w-[5px] rounded-full"
              style={{ background: 'var(--gold)' }}
            />
          </div>
          <p className="mt-4 max-w-sm text-[13px] leading-[1.7] text-white/70">
            CPA-issued accredited investor verification for Regulation D offerings. Not a law
            firm; verification letters are issued by licensed certified public accountants.
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <div className="smallcaps text-[10px] tracking-[.2em] text-gold">{c.h}</div>
            <ul className="mt-3 space-y-2 text-[13px]">
              {c.l.map((x) => (
                <li key={x}>
                  <a className="hover:text-white">{x}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-8 py-6">
          <div className="smallcaps text-[10px] tracking-[.2em] text-white/50">
            © {new Date().getFullYear()} AgFinTax Holdings · Licensed CPA Services · Not Legal Advice
          </div>
          <div className="flex items-center gap-5 text-[12px] text-white/60">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3 w-3" strokeWidth={1.8} />
              SOC 2 Type II
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3 w-3" strokeWidth={1.8} />
              GDPR · CCPA
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
