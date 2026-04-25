'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { signUpAction } from './actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SignUpForm() {
  const [state, action, isPending] = useActionState(signUpAction, null)

  if (state && state.error === null && state.ok) {
    return (
      <div className="rounded-xl bg-secondary-container/20 p-5">
        <h3 className="font-serif text-lg font-semibold text-primary">Check your email</h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          We sent you a confirmation link. Click it to finish setting up your account.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-6">
      <Field label="Full Legal Name" id="fullName" name="fullName" required autoComplete="name" placeholder="Johnathan Q. Executive" />
      <Field label="Email Address" id="email" name="email" type="email" required autoComplete="email" placeholder="name@company.com" />
      <Field
        label="Password"
        id="password"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        placeholder="At least 8 characters"
      />

      {state?.error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create account'}
      </Button>

      <p className="text-center text-xs text-on-surface-variant/80">
        By creating an account you agree to our Terms of Service and Privacy Policy.
      </p>
    </form>
  )
}

function Field({
  label,
  id,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
      >
        {label}
      </label>
      <Input id={id} {...rest} />
    </div>
  )
}
