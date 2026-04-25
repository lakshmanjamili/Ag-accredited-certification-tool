'use client'

import { useTransition } from 'react'
import { Loader2, Mail, Shield, ShieldOff, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { changeRoleAction, resendInviteAction, deactivateUserAction } from './actions'
import { toast } from 'sonner'

export function RoleControl({
  userId,
  email,
  currentRole,
  disabled,
}: {
  userId: string
  email: string
  currentRole: 'customer' | 'admin'
  disabled?: boolean
}) {
  const [pending, startTransition] = useTransition()

  const flip = () => {
    const newRole = currentRole === 'admin' ? 'customer' : 'admin'
    if (
      !confirm(
        `Change ${email} from ${currentRole} to ${newRole}?${
          newRole === 'admin' ? ' They will get access to the CPA workspace.' : ''
        }`,
      )
    )
      return
    const fd = new FormData()
    fd.set('userId', userId)
    fd.set('role', newRole)
    startTransition(async () => {
      const res = await changeRoleAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success(`${email} is now ${newRole}`)
    })
  }

  const resend = () => {
    const fd = new FormData()
    fd.set('email', email)
    startTransition(async () => {
      const res = await resendInviteAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success(`Magic link email sent to ${email}`)
    })
  }

  const deactivate = () => {
    if (!confirm(`Deactivate ${email}? They won't be able to sign in.`)) return
    const fd = new FormData()
    fd.set('userId', userId)
    startTransition(async () => {
      const res = await deactivateUserAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success(`${email} deactivated`)
    })
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="sm" onClick={resend} disabled={pending || disabled}>
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="h-3.5 w-3.5" strokeWidth={1.8} />
        )}
        Resend
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={flip}
        disabled={pending || disabled}
        className={currentRole === 'admin' ? 'border-[var(--gold)]/40' : ''}
      >
        {currentRole === 'admin' ? (
          <>
            <UserIcon className="h-3.5 w-3.5" strokeWidth={1.8} />
            Demote
          </>
        ) : (
          <>
            <Shield className="h-3.5 w-3.5" strokeWidth={1.8} />
            Promote
          </>
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={deactivate}
        disabled={pending || disabled}
        className="text-[var(--danger)] hover:bg-[var(--danger-50)]"
      >
        <ShieldOff className="h-3.5 w-3.5" strokeWidth={1.8} />
      </Button>
    </div>
  )
}
