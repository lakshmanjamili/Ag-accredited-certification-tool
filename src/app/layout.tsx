import type { Metadata } from 'next'
import { Fraunces, Homemade_Apple } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  weight: 'variable',
  style: ['normal', 'italic'],
})

const homemadeApple = Homemade_Apple({
  subsets: ['latin'],
  variable: '--font-homemade-apple',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'AgFinTax — Accredited Investor Certification',
  description:
    'SEC-compliant accredited investor verification in minutes, not hours or days. CPA-reviewed, QR-verifiable certificates.',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${homemadeApple.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* General Sans via Fontshare — set as the body font in globals.css */}
        <link rel="preconnect" href="https://api.fontshare.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-cream font-sans text-slate-900 antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton theme="light" />
      </body>
    </html>
  )
}
