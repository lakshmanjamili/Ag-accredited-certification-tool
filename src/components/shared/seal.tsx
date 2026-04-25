/**
 * Embossed gold CPA seal — used on the verification letter letterhead.
 * Circular text "ACCREDITED · VERIFIED · AGFINTAX" runs around the rim.
 */
export function Seal({ size = 64 }: { size?: number }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div className="seal-ring absolute inset-0 rounded-full" />
      <div
        className="absolute inset-[6px] flex items-center justify-center rounded-full"
        style={{ background: '#FAF1D3', border: '1px solid rgba(0,0,0,.08)' }}
      >
        <div className="text-center leading-none">
          <div
            className="font-serif text-ink"
            style={{ fontSize: size * 0.2, fontWeight: 700 }}
          >
            CPA
          </div>
          <div
            className="smallcaps mt-1"
            style={{ fontSize: size * 0.08, color: '#8E6F10', letterSpacing: '.2em' }}
          >
            Verified
          </div>
        </div>
      </div>
      <svg className="absolute inset-0" viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <path
            id={`sealCirc-${size}`}
            d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0"
          />
        </defs>
        <text
          fontSize="8"
          fill="#6B5512"
          letterSpacing="2"
          fontFamily="Fraunces, serif"
          fontWeight="600"
        >
          <textPath xlinkHref={`#sealCirc-${size}`} startOffset="0">
            ACCREDITED · VERIFIED · AGFINTAX ·{' '}
          </textPath>
        </text>
      </svg>
    </div>
  )
}
