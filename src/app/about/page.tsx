import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowRight,
  Award,
  Brain,
  Briefcase,
  Building2,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Mail,
  MapPin,
  Monitor,
  Phone,
  Shield,
  Star,
  Stethoscope,
  Target,
  TrendingUp,
  UtensilsCrossed,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Wordmark } from '@/components/ui/wordmark'

export const metadata: Metadata = {
  title: 'About · AG FinTax',
  description:
    'Meet AG FinTax — the CPA firm behind SEC-compliant accredited investor verification. Founded by Anil Grandhi, CPA.',
}

const services = [
  {
    title: 'Tax Planning',
    icon: Target,
    desc: 'Year-round proactive planning for small businesses and high-net-worth individuals.',
  },
  {
    title: 'Virtual CFO Services',
    icon: Briefcase,
    desc: 'Fractional CFO leadership with expert financial intelligence.',
  },
  {
    title: 'R&D Tax Credits',
    icon: Brain,
    desc: 'Identify and claim Section 41 credits for innovation-driven businesses.',
  },
  {
    title: 'Estate Planning',
    icon: Shield,
    desc: 'Protect generational wealth with strategic trust and entity structures.',
  },
  {
    title: 'Cross-border US-India',
    icon: Globe,
    desc: 'Compliance, PFIC reporting, and DTAA optimization across jurisdictions.',
  },
  {
    title: 'Dynamic Bookkeeping',
    icon: TrendingUp,
    desc: 'Technology-enhanced monthly bookkeeping and real-time reporting.',
  },
]

const industries = [
  { name: 'IT & ITES Firms', icon: Monitor },
  { name: 'Hospitality', icon: UtensilsCrossed },
  { name: 'Real Estate', icon: Home },
  { name: 'Healthcare', icon: Stethoscope },
]

const pillars = [
  {
    title: 'Client-First Philosophy',
    icon: Heart,
    desc: 'Every strategy is tailored to your unique financial situation — no cookie-cutter tax prep.',
  },
  {
    title: 'Technology + Human Expertise',
    icon: Brain,
    desc: "Anil's decades of CPA expertise paired with proprietary tax engines that scan thousands of IRC codes per second.",
  },
  {
    title: 'Education & Empowerment',
    icon: GraduationCap,
    desc: 'Webinars, resources, and one-on-one consultations so every client understands the strategies we implement.',
  },
]

const stats = [
  { value: '15K+', label: 'Clients served' },
  { value: '$2.4B', label: 'Capital managed' },
  { value: '50', label: 'States covered' },
  { value: '20+', label: 'Years experience' },
]

const offices = [
  {
    state: 'Texas',
    address: '8195 S Custer Rd, Suite 200C, Frisco, TX 75035',
    phone: '(469) 942-9888',
  },
  {
    state: 'Washington',
    address: '22722 29th Dr SE, Suite 100, Bothell, WA 98021',
    phone: '(425) 395-4318',
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-cream">
      {/* Top nav */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Wordmark size="md" />
          </Link>
          <nav className="hidden items-center gap-7 text-[13px] font-medium text-slate-600 md:flex">
            <Link href="/#how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="/#who-its-for" className="hover:text-ink">
              For investors
            </Link>
            <Link href="/about" className="text-ink">
              About
            </Link>
            <Link href="/#pricing" className="hover:text-ink">
              Pricing
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button asChild variant="gold" size="sm">
              <Link href="/sign-up">Get started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 sm:px-8 lg:pt-32">
        <div
          className="pointer-events-none absolute right-0 top-10 h-[400px] w-[400px] rounded-full blur-[120px]"
          style={{ background: 'var(--brand-orange-soft)', opacity: 0.2 }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="smallcaps inline-flex items-center gap-2 text-[11px] tracking-[.18em] text-slate-500">
            <Award className="h-3.5 w-3.5" strokeWidth={2} />
            About AG FinTax
          </div>
          <h1
            className="mt-4 font-serif text-[52px] leading-[1.05] tracking-[-0.01em] text-ink sm:text-[64px]"
            style={{ fontWeight: 500 }}
          >
            Financial &amp; tax services for the{' '}
            <span style={{ color: 'var(--brand-orange)' }}>dynamic business owner</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-[15.5px] leading-[1.75] text-slate-600">
            AG FinTax is a full-service tax advisory and financial planning firm,
            supercharged with Anil Grandhi&apos;s proprietary planning methodology
            to deliver unmatched results for dynamic business owners, investors,
            and high-net-worth individuals.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-[10px] border border-slate-200 bg-paper p-5 text-center elev"
              >
                <div
                  className="font-serif text-[30px] text-ink"
                  style={{ fontWeight: 600 }}
                >
                  {s.value}
                </div>
                <div className="smallcaps mt-1 text-[10px] tracking-[.16em] text-slate-500">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Founder */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-8">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="relative overflow-hidden rounded-[18px] border border-slate-200 bg-paper elev">
              <Image
                src="/images/anil-grandhi.avif"
                alt="Anil Grandhi, CPA — founder of AG FinTax"
                width={600}
                height={700}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
            <div className="mt-5 inline-flex items-center gap-3 rounded-full bg-paper px-4 py-2 elev">
              <Star
                className="h-4 w-4"
                strokeWidth={2}
                style={{ color: 'var(--brand-orange)', fill: 'var(--brand-orange)' }}
              />
              <span className="text-[13px] font-semibold text-ink">4.7 / 5</span>
              <span className="text-[12px] text-slate-500">· 85+ Google reviews</span>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="smallcaps text-[11px] tracking-[.18em] text-slate-500">
              Founder &amp; CEO
            </div>
            <h2
              className="mt-2 font-serif text-[44px] leading-[1.05] text-ink"
              style={{ fontWeight: 500 }}
            >
              Anil Grandhi
            </h2>
            <p
              className="mt-1 text-[14px] font-semibold"
              style={{ color: 'var(--brand-orange)' }}
            >
              CPA · Tax Strategist · Financial Architect
            </p>
            <div className="mt-6 space-y-4 text-[14.5px] leading-[1.75] text-slate-700">
              <p>
                Anil brings decades of expertise in tax strategy, financial
                planning, and business advisory. His deep understanding of the
                U.S. tax code, combined with specialized knowledge in cross-border
                India–US taxation, makes him one of the most sought-after tax
                professionals for dynamic business owners and high-net-worth
                individuals.
              </p>
              <p>
                Under Anil&apos;s leadership, AG FinTax has grown to serve 15,000+
                clients across all 50 states, managing over $2.4 billion in
                capital. His forward-thinking approach led to the development of
                this proprietary platform — merging decades of CPA expertise with
                cutting-edge technology to deliver tax savings that were
                previously impossible to identify manually.
              </p>
              <p>
                Clients consistently report savings of $20,000–$100,000+ annually
                through innovative strategies including entity optimization, cost
                segregation, R&amp;D credits, and proactive year-round planning.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-slate-200 bg-paper py-24">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="smallcaps text-[11px] tracking-[.18em] text-slate-500">
              Our mission
            </div>
            <h2
              className="mt-2 font-serif text-[40px] leading-[1.1] text-ink"
              style={{ fontWeight: 500 }}
            >
              Democratizing{' '}
              <span style={{ color: 'var(--brand-orange)' }}>elite tax intelligence</span>.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.7] text-slate-600">
              AG FinTax was founded on a simple belief: every business owner
              deserves access to the same sophisticated tax strategies used by
              Fortune 500 companies.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="rounded-[12px] border border-slate-200 bg-cream p-8 elev"
              >
                <div
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-[10px]"
                  style={{ background: 'var(--gold-50)' }}
                >
                  <p.icon
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    style={{ color: 'var(--brand-orange)' }}
                  />
                </div>
                <h3 className="font-serif text-[20px] text-ink" style={{ fontWeight: 600 }}>
                  {p.title}
                </h3>
                <p className="mt-3 text-[13.5px] leading-[1.7] text-slate-600">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-8">
        <div className="smallcaps text-[11px] tracking-[.18em] text-slate-500">
          What we do
        </div>
        <h2
          className="mt-2 font-serif text-[40px] leading-[1.1] text-ink"
          style={{ fontWeight: 500 }}
        >
          Comprehensive services.
        </h2>
        <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <div
              key={s.title}
              className="group rounded-[12px] border border-slate-200 bg-paper p-6 elev transition-all hover:-translate-y-0.5"
            >
              <div
                className="mb-4 flex h-10 w-10 items-center justify-center rounded-[8px]"
                style={{ background: 'var(--cream)' }}
              >
                <s.icon
                  className="h-5 w-5"
                  strokeWidth={1.8}
                  style={{ color: 'var(--brand-orange)' }}
                />
              </div>
              <h3 className="font-serif text-[18px] text-ink" style={{ fontWeight: 600 }}>
                {s.title}
              </h3>
              <p className="mt-2 text-[13px] leading-[1.7] text-slate-600">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Industries */}
      <section className="border-y border-slate-200 bg-paper py-16">
        <div className="mx-auto max-w-6xl px-6 sm:px-8">
          <p className="smallcaps text-center text-[11px] tracking-[.18em] text-slate-500">
            Industries we serve
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            {industries.map((i) => (
              <div
                key={i.name}
                className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-cream px-5 py-2.5"
              >
                <i.icon
                  className="h-4 w-4"
                  strokeWidth={1.8}
                  style={{ color: 'var(--brand-orange)' }}
                />
                <span className="text-[13px] font-semibold text-ink">{i.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Offices */}
      <section className="mx-auto max-w-6xl px-6 py-24 sm:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="smallcaps text-[11px] tracking-[.18em] text-slate-500">
            Get in touch
          </div>
          <h2
            className="mt-2 font-serif text-[40px] leading-[1.1] text-ink"
            style={{ fontWeight: 500 }}
          >
            Two offices, <span style={{ color: 'var(--brand-orange)' }}>fifty states</span>.
          </h2>
          <p className="mt-4 text-[14.5px] text-slate-600">
            Virtual services available nationwide.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-1 gap-6 md:grid-cols-2">
          {offices.map((o) => (
            <div
              key={o.state}
              className="rounded-[12px] border border-slate-200 bg-paper p-7 elev"
            >
              <div className="mb-5 flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-[8px]"
                  style={{ background: 'var(--cream)' }}
                >
                  <Building2
                    className="h-5 w-5"
                    strokeWidth={1.8}
                    style={{ color: 'var(--brand-orange)' }}
                  />
                </div>
                <h3 className="font-serif text-[22px] text-ink" style={{ fontWeight: 600 }}>
                  {o.state} office
                </h3>
              </div>
              <dl className="space-y-3 text-[13.5px] text-slate-700">
                <div className="flex items-start gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />
                  <span>{o.address}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />
                  <a href={`tel:${o.phone.replace(/[^\d+]/g, '')}`} className="hover:text-ink">
                    {o.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 shrink-0 text-slate-400" strokeWidth={1.8} />
                  <a href="mailto:hello@agfintax.com" className="hover:text-ink">
                    hello@agfintax.com
                  </a>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <div className="mt-14 text-center">
          <Button asChild variant="gold" size="lg">
            <Link href="/sign-up">
              Start your accreditation — free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-white/80">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-14 md:grid-cols-3 sm:px-8">
          <div>
            <Wordmark size="lg" variant="stacked" />
            <p className="mt-4 max-w-xs text-[13px] leading-[1.7] text-white/60">
              SEC-compliant accredited investor verification in minutes. CPA-reviewed,
              QR-verifiable certificates.
            </p>
          </div>
          <div>
            <h4 className="smallcaps mb-3 text-[10.5px] tracking-[.18em] text-white/50">
              Company
            </h4>
            <ul className="space-y-2 text-[13px]">
              <li>
                <Link href="/about" className="text-white/70 hover:text-white">
                  About
                </Link>
              </li>
              <li>
                <Link href="/#pricing" className="text-white/70 hover:text-white">
                  Pricing
                </Link>
              </li>
              <li>
                <a href="mailto:hello@agfintax.com" className="text-white/70 hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="smallcaps mb-3 text-[10.5px] tracking-[.18em] text-white/50">
              Reach out
            </h4>
            <p className="text-[13px] text-white/70">
              hello@agfintax.com
              <br />
              (469) 942-9888 · Texas
              <br />
              (425) 395-4318 · Washington
            </p>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 py-5 text-[12px] text-white/50 sm:flex-row sm:px-8">
            <span>&copy; {new Date().getFullYear()} AG FinTax Advisors, LLC</span>
            <span>
              Platform built by{' '}
              <a
                href="https://loukriai.com"
                className="text-white/70 hover:text-white"
                target="_blank"
                rel="noreferrer"
              >
                LoukriAI.com
              </a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
