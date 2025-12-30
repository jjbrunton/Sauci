import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Sauci - Ignite Your Connection',
  description: 'Discover what you both desire. Sauci is the couples intimacy app that helps partners explore their connection through fun, meaningful questions.',
  keywords: ['couples app', 'intimacy', 'relationship', 'connection', 'dating', 'love'],
  authors: [{ name: 'Sauci' }],
  openGraph: {
    title: 'Sauci - Ignite Your Connection',
    description: 'Discover what you both desire. The couples intimacy app for deeper connections.',
    url: 'https://sauci.app',
    siteName: 'Sauci',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sauci - Ignite Your Connection',
    description: 'Discover what you both desire. The couples intimacy app for deeper connections.',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/apple-touch-icon.png',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
