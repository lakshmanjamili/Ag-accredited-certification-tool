'use client'

import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { claimAction } from '@/app/admin/actions'
import { toast } from 'sonner'

export function ClaimButton({ submissionId }: { submissionId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="accent"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const fd = new FormData()
          fd.set('submissionId', submissionId)
          try {
            await claimAction(fd)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Claim failed')
          }
        })
      }
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Claim'}
    </Button>
  )
}
