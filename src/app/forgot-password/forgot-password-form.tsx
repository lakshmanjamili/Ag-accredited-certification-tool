'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { requestPasswordResetAction } from './actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'

export function ForgotPasswordForm() {
  const [state, action, isPending] = useActionState(requestPasswordResetAction, null)

  if (state && state.error === null) {
    return (
      <div className="rounded-xl border border-[var(--primary)]/20 bg-[var(--primary)]/5 p-5">
        <h3 className="font-semibold">Check your email</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          If an account exists for that email, we&apos;ve sent a reset link.
        </p>
      </div>
    )
  }

  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
      </div>
      {state?.error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="accent" size="lg" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
      </Button>
    </form>
  )
}
