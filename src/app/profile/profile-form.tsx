'use client'

import { useState, useTransition } from 'react'
import { Loader2, User, Phone, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfileAction } from './actions'
import { toast } from 'sonner'

export function ProfileForm({
  initial,
}: {
  initial: { fullName: string; phone: string; email: string }
}) {
  const [fullName, setFullName] = useState(initial.fullName)
  const [phone, setPhone] = useState(initial.phone)
  const [pending, startTransition] = useTransition()

  const dirty = fullName !== initial.fullName || phone !== initial.phone

  const save = () => {
    if (fullName.trim().length < 2) {
      toast.error('Please enter your full legal name')
      return
    }
    const fd = new FormData()
    fd.set('fullName', fullName.trim())
    fd.set('phone', phone.trim())
    startTransition(async () => {
      const res = await updateProfileAction(fd)
      if (res.error) toast.error(res.error)
      else toast.success('Profile updated')
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="email" className="text-[10px] uppercase tracking-widest">
          Email
        </Label>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-low px-3 py-3 text-sm text-on-surface-variant">
          <span className="font-mono">{initial.email}</span>
          <span className="ml-auto text-[10px] uppercase tracking-widest">
            Managed by Supabase
          </span>
        </div>
      </div>

      <div>
        <Label htmlFor="fullName" className="text-[10px] uppercase tracking-widest">
          Full legal name
        </Label>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-lowest px-3 focus-within:ring-2 focus-within:ring-primary/20">
          <User className="h-4 w-4 text-on-surface-variant/60" strokeWidth={1.8} />
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Johnathan Q. Executive"
            className="border-0 bg-transparent px-0"
          />
        </div>
        <p className="mt-1 text-xs text-on-surface-variant">
          This is what will appear on your verification certificate.
        </p>
      </div>

      <div>
        <Label htmlFor="phone" className="text-[10px] uppercase tracking-widest">
          Phone <span className="text-on-surface-variant/60">(optional)</span>
        </Label>
        <div className="mt-1 flex items-center gap-2 rounded-xl bg-surface-lowest px-3 focus-within:ring-2 focus-within:ring-primary/20">
          <Phone className="h-4 w-4 text-on-surface-variant/60" strokeWidth={1.8} />
          <Input
            id="phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+1 (555) 555-0180"
            type="tel"
            className="border-0 bg-transparent px-0"
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || pending} size="lg">
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Save className="h-4 w-4" strokeWidth={1.8} />
              Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
