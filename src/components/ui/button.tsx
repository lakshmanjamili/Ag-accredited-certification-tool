import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Buttons follow the Claude Design handoff: 6px radius, ink primary,
 * gold accent, generous focus ring.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--gold)]/35",
  {
    variants: {
      variant: {
        default:
          'bg-[var(--ink)] text-white hover:brightness-110 shadow-[var(--elev)]',
        accent:
          'bg-[var(--gold)] text-[#1a1a1a] hover:brightness-105 shadow-[var(--elev)]',
        gold:
          'bg-[var(--gold)] text-[#1a1a1a] hover:brightness-105 shadow-[var(--elev)]',
        outline:
          'border border-[var(--slate-300)] bg-paper text-slate-900 hover:bg-slate-50',
        secondary:
          'bg-slate-100 text-slate-900 hover:bg-slate-200',
        ghost: 'text-slate-700 hover:bg-slate-100 hover:text-ink',
        success:
          'bg-[var(--success)] text-white hover:brightness-105',
        warn:
          'border border-[var(--warn)] text-[var(--warn)] hover:bg-[var(--warn-50)] bg-transparent',
        destructive:
          'bg-[var(--danger)] text-white hover:brightness-105',
        link: 'text-ink underline-offset-4 hover:underline',
        serif:
          'bg-[var(--ink)] text-white font-serif hover:brightness-110',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        default: 'h-10 px-4 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-[15px]',
        xl: 'h-14 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
