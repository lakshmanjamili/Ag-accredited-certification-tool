import Link from 'next/link'
import { AccountBalance, QuoteIcon } from '@/components/icons/ledger'
import { SignUpForm } from './sign-up-form'

export default function SignUpPage() {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-surface p-6">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.04]">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full border-[40px] border-secondary" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-150">
          <AccountBalance className="h-[600px] w-[600px]" />
        </div>
      </div>

      <div className="z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="font-serif text-3xl font-bold italic tracking-tight text-primary"
          >
            AgFinTax
          </Link>
        </div>

        <div className="mb-10 px-4 text-center">
          <blockquote className="relative">
            <QuoteIcon className="absolute -left-2 -top-4 h-7 w-7 text-secondary/30" />
            <p className="font-serif text-lg italic leading-relaxed text-on-surface-variant">
              Accreditation in minutes, not hours or days.
            </p>
            <cite className="mt-2 block text-xs font-semibold uppercase not-italic tracking-widest text-secondary">
              — The Digital Ledger
            </cite>
          </blockquote>
        </div>

        <div className="overflow-hidden rounded-2xl bg-surface-lowest shadow-ghost-lg">
          <div className="p-8">
            <div className="mb-8">
              <h2 className="font-serif text-2xl font-semibold text-primary">Create your account</h2>
              <p className="mt-1 text-sm text-on-surface-variant">
                Verify your accredited status in under 24 hours.
              </p>
            </div>

            <SignUpForm />

            <div className="mt-8 flex flex-col items-center gap-4 border-t border-outline-variant/10 pt-8">
              <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                <span>Already have an account?</span>
                <Link
                  href="/sign-in"
                  className="font-bold text-secondary underline-offset-4 hover:underline"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-12 text-center">
          <p className="text-[10px] font-medium uppercase tracking-wide text-on-surface-variant/60">
            © {new Date().getFullYear()} AgFinTax Ledger · Accredited Financial Institution
          </p>
        </footer>
      </div>
    </main>
  )
}
