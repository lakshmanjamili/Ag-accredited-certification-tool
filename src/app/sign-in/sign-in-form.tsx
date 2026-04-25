'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { signInAction, sendMagicLinkAction } from './actions'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const [state, action, isPending] = useActionState(signInAction, null)
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLinkAction, null)
  const magicSent = magicState && magicState.error === null

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-6">
        <input type="hidden" name="next" value={nextPath ?? ''} />
        <Field
          id="email"
          name="email"
          label="Email Address"
          type="email"
          required
          autoComplete="email"
          placeholder="name@company.com"
        />
        <div>
          <div className="flex items-center justify-between">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="/forgot-password"
              className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant hover:text-primary"
            >
              Forgot?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>

        {state?.error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
          {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
        </Button>
      </form>

      <div className="flex items-center">
        <div className="h-px flex-grow bg-outline-variant/20" />
        <span className="px-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
          or
        </span>
        <div className="h-px flex-grow bg-outline-variant/20" />
      </div>

      {magicSent ? (
        <div className="rounded-xl bg-surface-low p-4 text-center text-sm">
          Magic link sent. Check your inbox.
        </div>
      ) : (
        <form action={magicAction} className="space-y-3">
          <FieldLabel htmlFor="magic-email">Or get a one-time magic link</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="magic-email"
              name="email"
              type="email"
              required
              placeholder="name@company.com"
              className="flex-1"
            />
            <Button type="submit" variant="outline" disabled={magicPending}>
              {magicPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
            </Button>
          </div>
          {magicState?.error && <p className="text-xs text-destructive">{magicState.error}</p>}
        </form>
      )}
    </div>
  )
}

function Field({
  id,
  name,
  label,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} name={name} {...rest} />
    </div>
  )
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant"
    >
      {children}
    </label>
  )
}
