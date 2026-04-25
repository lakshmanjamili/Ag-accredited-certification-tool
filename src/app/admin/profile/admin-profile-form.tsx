'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveAdminProfileAction } from './actions'
import { toast } from 'sonner'

type Initial = {
  cpaLicenseNo: string
  title: string
  firmName: string
  firmCity: string
  firmEmail: string
  jurisdiction: string
  phone: string
  typedSignatureBlock: string
  defaultValidityDays: number | null
}

export function AdminProfileForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState(initial)
  const [pending, startTransition] = useTransition()

  const update = <K extends keyof Initial>(key: K, value: Initial[K]) =>
    setState((s) => ({ ...s, [key]: value }))

  const onSubmit = () => {
    const fd = new FormData()
    for (const [k, v] of Object.entries(state)) {
      if (v != null) fd.set(k, String(v))
    }
    startTransition(async () => {
      const res = await saveAdminProfileAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success('Profile saved')
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      className="grid gap-5 sm:grid-cols-2"
    >
      <Field label="CPA license #" value={state.cpaLicenseNo} onChange={(v) => update('cpaLicenseNo', v)} />
      <Field label="Title" value={state.title} onChange={(v) => update('title', v)} />
      <Field label="Firm" value={state.firmName} onChange={(v) => update('firmName', v)} />
      <Field label="Firm city" value={state.firmCity} onChange={(v) => update('firmCity', v)} />
      <Field label="Firm email" value={state.firmEmail} onChange={(v) => update('firmEmail', v)} />
      <Field label="Jurisdiction" value={state.jurisdiction} onChange={(v) => update('jurisdiction', v)} />
      <Field label="Phone" value={state.phone} onChange={(v) => update('phone', v)} />
      <Field
        label="Default validity (days)"
        value={state.defaultValidityDays != null ? String(state.defaultValidityDays) : ''}
        onChange={(v) => update('defaultValidityDays', v ? Number(v) : null)}
        type="number"
      />
      <div className="sm:col-span-2">
        <Label>Typed signature block</Label>
        <textarea
          value={state.typedSignatureBlock}
          onChange={(e) => update('typedSignatureBlock', e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-background p-3 font-mono text-sm focus-visible:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]/30"
        />
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" variant="accent" size="lg" className="w-full sm:w-auto" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save profile'}
        </Button>
      </div>
    </form>
  )
}

function Field({
  label,
  value,
  onChange,
  type,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type ?? 'text'} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}
