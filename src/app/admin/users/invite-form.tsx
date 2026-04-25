'use client'

import { useState, useTransition } from 'react'
import { Loader2, Send, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { inviteUserAction } from './actions'
import { toast } from 'sonner'

export function InviteForm() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'customer' | 'admin'>('customer')
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!email || !fullName) {
      toast.error('Email and name required')
      return
    }
    const fd = new FormData()
    fd.set('email', email)
    fd.set('fullName', fullName)
    fd.set('role', role)
    startTransition(async () => {
      const res = await inviteUserAction(fd)
      if (res.error) {
        toast.error(res.error)
        return
      }
      if (res.existed) {
        toast.success(`${email} already existed — role updated to ${role}.`)
      } else {
        toast.success(`Invite email sent to ${email}.`)
      }
      setEmail('')
      setFullName('')
      setRole('customer')
    })
  }

  return (
    <div className="rounded-[10px] border border-slate-200 bg-paper p-5 elev">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-[var(--gold-50)] text-[#8E6F10]">
          <UserPlus className="h-4 w-4" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="font-serif text-lg text-ink" style={{ fontWeight: 600 }}>
            Invite a user
          </h2>
          <p className="text-[12px] text-slate-500">
            Supabase sends a branded invite email. They set a password on first sign-in.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="smallcaps text-[10px] tracking-[.18em] text-slate-500">Full name</label>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Jane Smith"
            className="mt-1"
          />
        </div>
        <div>
          <label className="smallcaps text-[10px] tracking-[.18em] text-slate-500">Email</label>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            placeholder="jane@firm.com"
            className="mt-1"
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="smallcaps text-[10px] tracking-[.18em] text-slate-500">Role</label>
        <div className="mt-1 flex gap-2">
          <RolePill
            active={role === 'customer'}
            onClick={() => setRole('customer')}
            title="Investor"
            desc="Uploads documents, receives letters"
          />
          <RolePill
            active={role === 'admin'}
            onClick={() => setRole('admin')}
            title="CPA / Admin"
            desc="Reviews queue, approves, signs"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-[11px] text-slate-500">
          {role === 'admin'
            ? 'Admin will see the CPA workspace, queue, and sign certificates.'
            : 'Investor will see the verification wizard and their certificates.'}
        </div>
        <Button variant="gold" size="sm" onClick={submit} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Send className="h-4 w-4" strokeWidth={1.8} />
              Send invite
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function RolePill({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean
  onClick: () => void
  title: string
  desc: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-start gap-0.5 rounded-[8px] border px-3 py-2.5 text-left transition-all ${
        active
          ? 'border-[var(--gold)] bg-[var(--gold-50)]/50 ring-2 ring-[var(--gold)]/20'
          : 'border-slate-200 bg-paper hover:bg-slate-50'
      }`}
    >
      <span className="text-[13px] font-semibold text-ink">{title}</span>
      <span className="text-[11px] text-slate-500">{desc}</span>
    </button>
  )
}
