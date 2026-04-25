import { cn } from '@/lib/utils'

/**
 * AG FinTax wordmark — matches the actual brand logo: bold sans-serif
 * "AG" in brand orange stacked above "FinTax" in ink navy.
 *
 * variant:
 *   - "stacked" (default on marketing hero/footer) — two lines, "AG" above "FinTax"
 *   - "inline"  (default on app shells) — single-line "AG FinTax"
 */
export function Wordmark({
  size = 'md',
  variant = 'inline',
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'inline' | 'stacked'
  className?: string
}) {
  const inlineSize =
    size === 'xl'
      ? 'text-[34px]'
      : size === 'lg'
        ? 'text-[26px]'
        : size === 'sm'
          ? 'text-[16px]'
          : 'text-[21px]'

  const stackedTop =
    size === 'xl'
      ? 'text-[46px] leading-[0.95]'
      : size === 'lg'
        ? 'text-[36px] leading-[0.95]'
        : size === 'sm'
          ? 'text-[20px] leading-[0.95]'
          : 'text-[28px] leading-[0.95]'

  const stackedBot =
    size === 'xl'
      ? 'text-[46px] leading-[0.95]'
      : size === 'lg'
        ? 'text-[36px] leading-[0.95]'
        : size === 'sm'
          ? 'text-[20px] leading-[0.95]'
          : 'text-[28px] leading-[0.95]'

  if (variant === 'stacked') {
    return (
      <span
        className={cn(
          'inline-flex flex-col font-sans font-extrabold tracking-tight',
          className,
        )}
        style={{ letterSpacing: '-0.02em', lineHeight: 0.95 }}
        aria-label="AG FinTax"
      >
        <span className={cn(stackedTop)} style={{ color: 'var(--brand-orange)' }}>
          AG
        </span>
        <span className={cn(stackedBot, 'text-ink')}>FinTax</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-[3px] font-sans font-extrabold tracking-tight',
        inlineSize,
        className,
      )}
      style={{ letterSpacing: '-0.02em' }}
      aria-label="AG FinTax"
    >
      <span style={{ color: 'var(--brand-orange)' }}>AG</span>
      <span className="text-ink">FinTax</span>
    </span>
  )
}
