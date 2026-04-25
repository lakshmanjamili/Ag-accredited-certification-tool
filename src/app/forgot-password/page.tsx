import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { ForgotPasswordForm } from './forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-[color-mix(in_oklab,var(--primary)_6%,white)] via-background to-background">
      <header className="mx-auto w-full max-w-6xl px-6 py-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--secondary)] text-sm font-bold text-white">
            Ag
          </div>
          <span className="text-lg font-semibold tracking-tight">{BRAND.name}</span>
        </Link>
      </header>

      <div className="mx-auto flex w-full max-w-md flex-1 items-center px-6 pb-16">
        <div className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send you a reset link.
          </p>

          <div className="mt-8">
            <ForgotPasswordForm />
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Remembered it?{' '}
            <Link href="/sign-in" className="font-medium text-[var(--primary)] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
