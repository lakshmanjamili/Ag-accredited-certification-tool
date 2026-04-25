import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * "Professional Entry" field — bottom-border only, no box.
 * Resting: cream-tinted surface-variant + subtle bottom line.
 * Focus: white background + 2px primary bottom line.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'w-full border-0 border-b border-outline-variant/50 bg-surface-variant/20 px-1 py-3 text-base font-medium transition-all duration-200',
          'placeholder:text-on-surface-variant/40',
          'focus-visible:border-b-2 focus-visible:border-primary focus-visible:bg-surface-lowest focus-visible:outline-none focus-visible:ring-0',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
