'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, Heart } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { isValidInviteCode, normalizeInviteCode } from '../../../lib/inviteCode'
import { APP_STORE_URL, PLAY_STORE_URL, buildInviteSchemeUrl } from '../../../lib/appLinks'

export function JoinClient({ code }: { code: string }) {
  const posthog = usePostHog()
  const [copied, setCopied] = useState(false)
  const hasAttemptedOpen = useRef(false)

  const isValid = isValidInviteCode(code)
  const normalizedCode = useMemo(() => (isValid ? normalizeInviteCode(code) : ''), [isValid, code])

  // Track the page view once. Fires regardless of code validity so we can
  // see broken/expired links in the funnel too.
  useEffect(() => {
    posthog?.capture('join_page_viewed', { code_valid: isValid })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attempt to open the app via the custom scheme once. If the app is
  // installed and registered for the scheme, this hands off to it; if not,
  // nothing visible happens and the fallback UI below remains in view.
  useEffect(() => {
    if (!isValid || hasAttemptedOpen.current) return
    hasAttemptedOpen.current = true
    window.location.href = buildInviteSchemeUrl(normalizedCode)
  }, [isValid, normalizedCode])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizedCode)
      setCopied(true)
      posthog?.capture('join_page_code_copied')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy invite code:', err)
    }
  }

  const handleStoreClick = (store: 'app_store' | 'play_store') => {
    posthog?.capture('join_page_store_button_clicked', { store })
  }

  if (!isValid) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background-light to-background flex items-center justify-center p-6">
        <div className="glass-light p-8 sm:p-12 max-w-md w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Invite link not recognized</h1>
          <p className="text-white/60 mb-8">
            This invite link looks incomplete or has expired. Ask your partner to send a new one from the Sauci app.
          </p>
          <Link href="/" className="btn-primary inline-block">
            Back to Home
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-background">
      {/* Header */}
      <header className="py-6 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-md mx-auto px-6 py-12 sm:py-20 text-center">
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-8">
          <Heart className="w-10 h-10 text-primary" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-3">You&apos;ve been invited to Sauci</h1>
        <p className="text-white/60 mb-10">
          Open the app to pair up instantly. If it doesn&apos;t open automatically, copy your code below and
          enter it after you install Sauci.
        </p>

        <div className="glass-light p-6 sm:p-8 mb-8">
          <p className="text-white/60 text-sm mb-3">Your invite code</p>
          <p
            className="text-4xl sm:text-5xl font-bold tracking-[0.3em] text-primary mb-6"
            data-testid="invite-code-display"
          >
            {normalizedCode}
          </p>
          <button
            type="button"
            onClick={handleCopy}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                Copied
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                Copy code
              </>
            )}
          </button>
        </div>

        <p className="text-white/40 text-sm mb-6">Don&apos;t have Sauci yet? Get the app first:</p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleStoreClick('app_store')}
            className="btn-primary w-full sm:w-auto"
          >
            Download on the App Store
          </a>
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleStoreClick('play_store')}
            className="btn-secondary w-full sm:w-auto"
          >
            Get it on Google Play
          </a>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-white/5 mt-auto">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xl font-bold gradient-text">Sauci</span>
          <div className="flex gap-6 text-sm text-white/40">
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
