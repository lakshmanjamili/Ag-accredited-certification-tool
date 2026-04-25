import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function SignOutButton({ className }: { className?: string }) {
  return (
    <form action="/sign-out" method="post" className={className}>
      <Button type="submit" variant="ghost" size="sm" className="gap-2">
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </form>
  )
}
