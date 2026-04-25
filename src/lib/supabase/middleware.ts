import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const PUBLIC_PREFIXES = [
  '/',
  '/sign-in',
  '/sign-up',
  '/auth',
  '/privacy',
  '/terms',
  '/verify-public',
]

const CUSTOMER_PREFIXES = ['/dashboard', '/verify', '/letter', '/profile']
const ADMIN_PREFIXES = ['/admin', '/api/admin']

function matches(pathname: string, prefixes: string[]) {
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl
  const isPublic = matches(pathname, PUBLIC_PREFIXES)
  const needsCustomer = matches(pathname, CUSTOMER_PREFIXES)
  const needsAdmin = matches(pathname, ADMIN_PREFIXES)

  if (!user && (needsCustomer || needsAdmin)) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  if (user && needsAdmin) {
    const role = (user.app_metadata as { role?: string } | null)?.role
    if (role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // Suppress unused warning for isPublic until we add public-only redirects (e.g., logged-in user hitting /sign-in).
  void isPublic

  return response
}
