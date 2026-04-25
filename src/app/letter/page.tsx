import Link from 'next/link'
import { desc, eq, inArray } from 'drizzle-orm'
import { Download, FileCheck, ShieldCheck } from 'lucide-react'
import { requireUser } from '@/lib/auth'
import { AppHeader } from '@/components/shared/app-header'
import { db } from '@/db/client'
import { certificate, submission } from '@/db/schema'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDateLong } from '@/lib/utils'

export default async function LetterListPage() {
  const user = await requireUser()

  // Customers see their own certificates; admins see all.
  const mine = await db
    .select({
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      path: certificate.path,
      issuedAt: certificate.issuedAt,
      validThrough: certificate.validThrough,
      revoked: certificate.revoked,
      submissionId: certificate.submissionId,
    })
    .from(certificate)
    .leftJoin(submission, eq(submission.id, certificate.submissionId))
    .where(
      user.role === 'admin'
        ? inArray(certificate.revoked, [true, false])
        : eq(submission.customerId, user.id),
    )
    .orderBy(desc(certificate.issuedAt))

  return (
    <>
      <AppHeader userLabel={user.email} role={user.role === 'admin' ? 'admin' : 'customer'} />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-3xl font-semibold tracking-tight">Your certificates</h1>
        <p className="mt-2 text-muted-foreground">
          Issued accredited-investor verification letters, ready to share with issuers.
        </p>

        {mine.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-muted/40 p-12 text-center">
            <FileCheck className="mx-auto h-10 w-10 text-muted-foreground/60" />
            <h3 className="mt-4 font-semibold">No certificates yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Once a CPA signs off, your certificate lands here.
            </p>
          </div>
        ) : (
          <div className="mt-10 grid gap-4">
            {mine.map((c) => (
              <Card key={c.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                  <div>
                    <CardTitle className="font-mono text-sm">{c.certificateNumber}</CardTitle>
                    <CardDescription className="capitalize">
                      {c.path.replace('_', ' ')} path · Issued {formatDateLong(c.issuedAt)}
                    </CardDescription>
                  </div>
                  <StatusBadge revoked={c.revoked} validThrough={c.validThrough} />
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm text-muted-foreground">
                    Valid through {formatDateLong(c.validThrough)}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="ghost" size="sm">
                      <Link href={`/letter/${c.id}`}>
                        <FileCheck className="h-4 w-4" />
                        Preview
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/verify-public/${c.certificateNumber}`} target="_blank">
                        <ShieldCheck className="h-4 w-4" />
                        Share link
                      </Link>
                    </Button>
                    <Button asChild variant="gold" size="sm" disabled={c.revoked}>
                      <Link href={`/api/certificates/${c.id}/download`}>
                        <Download className="h-4 w-4" />
                        Download PDF
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  )
}

function StatusBadge({ revoked, validThrough }: { revoked: boolean; validThrough: Date }) {
  if (revoked) return <Badge variant="destructive">Revoked</Badge>
  if (validThrough.getTime() < Date.now()) return <Badge variant="warning">Expired</Badge>
  return <Badge variant="success">Valid</Badge>
}
