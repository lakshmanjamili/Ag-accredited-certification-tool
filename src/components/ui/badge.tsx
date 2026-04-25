import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * StatusPill-style badge: soft tinted bg + bold foreground + optional dot.
 * Matches the Claude Design handoff visually.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-slate-100 text-slate-700',
        accent: 'bg-[var(--gold-50)] text-[#8E6F10]',
        secondary: 'bg-slate-100 text-slate-700',
        success: 'bg-[var(--success-50)] text-[var(--success)]',
        warning: 'bg-[var(--warn-50)] text-[var(--warn)]',
        destructive: 'bg-[var(--danger-50)] text-[var(--danger)]',
        outline: 'border border-slate-200 bg-paper text-slate-600',
        submitted: 'bg-[#EFF6FF] text-[#1D4ED8]',
        ready: 'bg-[var(--gold-50)] text-[#8E6F10]',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

const dotByVariant: Record<string, string> = {
  default: '#94A3B8',
  secondary: '#94A3B8',
  accent: '#C9A227',
  success: '#15803D',
  warning: '#B45309',
  destructive: '#B91C1C',
  submitted: '#1D4ED8',
  ready: '#C9A227',
  outline: '#94A3B8',
}

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean
}

function Badge({ className, variant, dot = true, children, ...props }: BadgeProps) {
  const v = variant ?? 'default'
  return (
    <div className={cn(badgeVariants({ variant: v }), className)} {...props}>
      {dot && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: dotByVariant[v] }}
        />
      )}
      {children}
    </div>
  )
}

export { Badge, badgeVariants }
