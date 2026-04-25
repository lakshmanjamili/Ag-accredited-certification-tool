import { Seal } from '@/components/shared/seal'

/**
 * On-screen CPA verification letter. Matches the Claude Design handoff —
 * letter-paper, navy letterhead bar, gold seal, hand-signed signature,
 * gold left rule for the subject block.
 *
 * Not the downloadable PDF — that's still generated via pdf-lib.
 * This is the preview the customer sees on `/letter` and the public
 * verify page, and the admin sees on submission review.
 */

export type VerificationLetterData = {
  certificateNumber: string
  reference?: string
  investorName: string
  entityType?: string
  basisLabel: string
  issuedAt: Date
  validThrough: Date
  cpaName: string
  cpaLicense?: string | null
  cpaFirm?: string | null
  cpaFirmAddress?: string | null
  cpaEmail?: string | null
  cpaPhone?: string | null
  basisParagraph?: string
  signatureDataUrl?: string | null
}

export function VerificationLetter({
  data,
  compact = false,
}: {
  data: VerificationLetterData
  compact?: boolean
}) {
  const firstName = data.investorName.split(/\s+/)[0] ?? data.investorName

  return (
    <div
      className="letter-paper relative overflow-hidden rounded-[10px] border"
      style={{
        borderColor: 'var(--slate-200)',
        aspectRatio: compact ? undefined : '8.5 / 11',
      }}
    >
      <div className="h-[10px] bg-ink" />

      {/* Letterhead */}
      <div className="flex items-start justify-between px-8 pb-4 pt-8 sm:px-12">
        <div>
          <div
            className="inline-flex items-end font-serif text-[22px] text-ink"
            style={{ fontWeight: 600 }}
          >
            AgFinTax
            <span
              className="mb-[8px] ml-[3px] h-[6px] w-[6px] rounded-full"
              style={{ background: 'var(--gold)' }}
            />
          </div>
          <div className="smallcaps mt-1 text-[10px] tracking-[.2em] text-slate-500">
            Accredited Investor Verification
          </div>
          {(data.cpaFirm || data.cpaFirmAddress || data.cpaEmail || data.cpaPhone) && (
            <div className="mt-3 text-[11px] leading-[1.6] text-slate-500">
              {[data.cpaFirm, data.cpaFirmAddress].filter(Boolean).join(' · ')}
              {(data.cpaFirm || data.cpaFirmAddress) && (data.cpaEmail || data.cpaPhone) && (
                <br />
              )}
              {[data.cpaEmail, data.cpaPhone].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div className="text-right">
          <Seal size={84} />
          <div className="smallcaps mt-2 text-[9px] tracking-[.18em] text-slate-500">
            Letter No.
          </div>
          <div className="font-serif text-[13px] text-ink" style={{ fontWeight: 600 }}>
            {data.certificateNumber}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="px-8 pb-8 pt-2 sm:px-12">
        <div className="mb-6 text-[11px] text-slate-500">
          Issued {formatDate(data.issuedAt)}
        </div>

        <div
          className="font-serif text-[13.5px] leading-[1.85] text-ink"
          style={{ fontWeight: 400 }}
        >
          <div>To Whom It May Concern,</div>

          <p className="mt-4">
            I, {data.cpaName}
            {data.cpaLicense ? ` (license ${data.cpaLicense})` : ''}, a certified public
            accountant, have taken reasonable steps to verify the accredited investor status
            of the individual identified below in accordance with{' '}
            <span style={{ fontWeight: 600 }}>Rule 501(a) of Regulation D</span> promulgated
            under the Securities Act of 1933.
          </p>

          <div
            className="mt-5 border-l-2 pl-4"
            style={{ borderColor: 'var(--gold)' }}
          >
            <div className="smallcaps text-[10px] text-slate-500">Subject</div>
            <div className="font-serif text-[16px] text-ink" style={{ fontWeight: 600 }}>
              {data.investorName}
            </div>
            {data.entityType && (
              <div className="mt-0.5 text-[12px] text-slate-600">
                Entity type: {data.entityType}
              </div>
            )}
          </div>

          <p className="mt-5">
            Based on documentation reviewed — including federal tax returns for the two most
            recent years, current-year income evidence, and identity verification — I have
            determined that {firstName} qualifies as an &ldquo;accredited investor&rdquo;
            under the following basis:
          </p>

          <div
            className="mt-4 rounded-[6px] p-4"
            style={{ background: 'var(--bone)', border: '1px solid var(--slate-200)' }}
          >
            <div className="smallcaps text-[10px] text-slate-500">Basis of accreditation</div>
            <div
              className="mt-1 font-serif text-[15px] text-ink"
              style={{ fontWeight: 600 }}
            >
              {data.basisLabel}
            </div>
            <div className="mt-2 text-[12px] leading-[1.6] text-slate-600">
              {data.basisParagraph ??
                'Documentation reviewed supports the SEC threshold for this basis, with a reasonable expectation of continuing eligibility in the current calendar year.'}
            </div>
          </div>

          <p className="mt-5">
            This verification is issued for the purpose of participation in private
            securities offerings made in reliance on Rule 506(b) or 506(c) of Regulation D,
            and is valid through{' '}
            <span style={{ fontWeight: 600 }}>{formatDate(data.validThrough)}</span>.
          </p>

          <p className="mt-4 text-[12.5px] text-slate-600">
            This letter does not constitute legal, tax, or investment advice. Issuers
            relying on this verification remain responsible for their own compliance with
            applicable securities laws.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-10">
          <div>
            {data.signatureDataUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={data.signatureDataUrl}
                alt="CPA signature"
                className="h-12 w-auto"
              />
            ) : (
              <div className="font-hand text-[28px] leading-none text-ink">
                {data.cpaName.split(',')[0]}
              </div>
            )}
            <div className="sig-line mt-1 w-full" />
            <div className="mt-2 text-[12px] text-slate-700" style={{ fontWeight: 600 }}>
              {data.cpaName}
            </div>
            <div className="text-[11px] text-slate-500">
              {[data.cpaLicense && `License ${data.cpaLicense}`, data.cpaFirm]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
          <div className="text-right">
            <div className="smallcaps text-[10px] text-slate-500">Reference</div>
            <div className="mt-0.5 font-mono text-[12px] text-slate-700">
              {data.reference ?? data.certificateNumber}
            </div>
            <div className="smallcaps mt-3 text-[10px] text-slate-500">Valid through</div>
            <div className="font-serif text-[15px] text-ink" style={{ fontWeight: 600 }}>
              {formatDate(data.validThrough)}
            </div>
          </div>
        </div>
      </div>

      <div
        className="absolute bottom-0 left-0 right-0 border-t px-8 py-3 sm:px-12"
        style={{ borderColor: 'var(--slate-200)', background: 'var(--bone)' }}
      >
        <div className="smallcaps flex items-center justify-between text-[10px] tracking-[.18em] text-slate-500">
          <span>AgFinTax · Accredited Investor Verification</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  )
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d)
}
