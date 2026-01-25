import type { Metadata } from 'next'
import './globals.css'
import { PostHogProvider } from './providers'
import { PostHogPageView } from './PostHogPageView'

export const metadata: Metadata = {
  title: 'Sauci - Grow Closer Together',
  description: 'Sauci helps couples communicate better and strengthen their relationship through thoughtful questions and meaningful conversations.',
  keywords: ['couples app', 'relationship', 'communication', 'connection', 'couples questions', 'relationship improvement'],
  authors: [{ name: 'Sauci' }],
  openGraph: {
    title: 'Sauci - Grow Closer Together',
    description: 'The couples app for better communication and stronger relationships.',
    url: 'https://sauci.app',
    siteName: 'Sauci',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sauci - Grow Closer Together',
    description: 'The couples app for better communication and stronger relationships.',
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
        <PostHogProvider>
          <PostHogPageView />
          {children}
        </PostHogProvider>
      </body>
    </html>
  )
}
