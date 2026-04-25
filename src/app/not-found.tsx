import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[color-mix(in_oklab,var(--primary)_5%,white)] to-background p-6">
      <div className="max-w-md text-center">
        <div className="font-mono text-sm uppercase tracking-widest text-[var(--secondary)]">
          Error 404
        </div>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-6">
          <Button asChild variant="accent" size="lg">
            <Link href="/">Return home</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
