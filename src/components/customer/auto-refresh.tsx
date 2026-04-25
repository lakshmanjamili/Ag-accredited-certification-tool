'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Polls `router.refresh()` on an interval when extraction is in flight.
 * Stops polling automatically once the list shows no pending docs or
 * the submission leaves editable states.
 */
export function AutoRefresh({
  active,
  intervalMs = 6000,
}: {
  active: boolean
  intervalMs?: number
}) {
  const router = useRouter()

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => router.refresh(), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs, router])

  return null
}
