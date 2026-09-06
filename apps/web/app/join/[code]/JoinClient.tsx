'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Copy, Heart } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { isValidInviteCode, normalizeInviteCode } from '../../../lib/inviteCode'
import { APP_STORE_URL, PLAY_STORE_URL, buildInviteSchemeUrl } from '../../../lib/appLinks'

type Platform = 'ios' | 'android' | 'desktop' | 'other'

function getPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'

  const userAgent = navigator.userAgent

  if (/iPad|iPhone|iPod/i.test(userAgent)) return 'ios'
  if (/Android/i.test(userAgent)) return 'android'
  if (/Macintosh|Windows|Linux/i.test(userAgent)) return 'desktop'

  return 'other'
}

export function JoinClient({ code }: { code: string }) {
  const posthog = usePostHog()
  const [copied, setCopied] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [openAppFallbackVisible, setOpenAppFallbackVisible] = useState(false)
  const [platform, setPlatform] = useState<Platform>('other')
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasCopiedCode = useRef(false)

  const isValid = isValidInviteCode(code)
  const normalizedCode = useMemo(() => (isValid ? normalizeInviteCode(code) : ''), [isValid, code])

  useEffect(() => {
    const detectedPlatform = getPlatform()
    setPlatform(detectedPlatform)
    posthog?.capture('join_page_viewed', { code_valid: isValid, platform: detectedPlatform })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine)

    updateOnlineStatus()
    window.addEventListener('online', updateOnlineStatus)
    window.addEventListener('offline', updateOnlineStatus)

    return () => {
      window.removeEventListener('online', updateOnlineStatus)
      window.removeEventListener('offline', updateOnlineStatus)
    }
  }, [])

  useEffect(() => {
    if (!isOnline) posthog?.capture('join_page_offline_shown')
  }, [isOnline, posthog])

  useEffect(() => () => {
    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
  }, [])

  const handleCopy = async (trigger: 'code_block' | 'fallback_note') => {
    try {
      await navigator.clipboard.writeText(normalizedCode)
      hasCopiedCode.current = true
      setCopied(true)
      posthog?.capture('join_page_code_copied', { trigger })
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy invite code:', err)
    }
  }

  const handleStoreClick = (store: 'app_store' | 'play_store') => {
    if (!isOnline) return
    posthog?.capture('join_page_store_button_clicked', { store, code_copied_first: hasCopiedCode.current })
  }

  const handleOpenInApp = () => {
    setOpenAppFallbackVisible(false)
    posthog?.capture('join_page_open_app_clicked', { platform })
    window.location.href = buildInviteSchemeUrl(normalizedCode)

    if (fallbackTimer.current) clearTimeout(fallbackTimer.current)
    fallbackTimer.current = setTimeout(() => {
      if (document.visibilityState === 'visible') {
        setOpenAppFallbackVisible(true)
        posthog?.capture('join_page_open_app_fallback_shown', { platform })
      }
    }, 1500)
  }

  if (!isValid) {
    const malformedStoreUrl = platform === 'android' ? PLAY_STORE_URL : APP_STORE_URL

    return (
      <main className="min-h-screen bg-gradient-to-b from-background-light to-background flex items-center justify-center p-6">
        <div className="surface-solid p-8 sm:p-12 max-w-md w-full text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">Invite link not recognized</h1>
          <p className="text-white/70 mb-8">
            This invite link looks incomplete. Ask your partner to send a new one from the Sauci app.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href="/" className="btn-primary inline-block">
              Back to Home
            </Link>
            <a
              href={malformedStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary inline-block"
            >
              Get Sauci
            </a>
          </div>
        </div>
      </main>
    )
  }

  const copyAnnouncement = copied ? 'Invite code copied.' : ''
  const storeUnavailableTitle = isOnline ? undefined : 'Reconnect to open the app store.'
  const desktopCopy = platform === 'desktop'
    ? 'Sauci is a phone app. Copy your code, then open this link on your phone or install from the store there.'
    : 'They have already answered questions about you two. When you join, you will both see only the things you agree on. Neither of you sees the other’s individual answers.'

  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-background">
      <header className="py-6 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-12 sm:py-20 text-center">
        {!isOnline && (
          <p className="surface-solid mb-6 px-4 py-3 text-sm text-white/70" role="status">
            You&apos;re offline. Your code is below, and it still works.
          </p>
        )}
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-8 shadow-[0_8px_28px_rgba(233,69,96,0.28)]">
          <Heart className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold mb-3">You&apos;ve been invited to compare answers</h1>
        <p className="text-white/70 mb-10">{desktopCopy}</p>

        <section className="surface-solid p-6 sm:p-8 mb-6" aria-labelledby="invite-code-heading">
          <h2 id="invite-code-heading" className="text-white/70 text-sm font-medium mb-3">Your invite code</h2>
          <p
            className="text-4xl sm:text-5xl font-bold tracking-[0.3em] text-primary mb-6"
            data-testid="invite-code-display"
            aria-label={normalizedCode.split('').join(' ')}
          >
            {normalizedCode}
          </p>
          <p className="text-white/70 text-sm mb-5">Copy this before you install. You&apos;ll enter it in the app.</p>
          <button
            type="button"
            onClick={() => void handleCopy('code_block')}
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
          <span className="sr-only" role="status" aria-live="polite">{copyAnnouncement}</span>
        </section>

        <button type="button" onClick={handleOpenInApp} className="btn-primary w-full mb-2">
          Open in Sauci
        </button>
        <p className="text-white/60 text-sm mb-6">Already installed? This opens the app with your code.</p>

        {openAppFallbackVisible && (
          <p className="surface-solid mb-6 px-4 py-3 text-sm text-white/70" role="status" aria-live="polite">
            Nothing opened? You probably don&apos;t have Sauci yet.{' '}
            <button type="button" className="underline font-medium text-white" onClick={() => void handleCopy('fallback_note')}>
              Copy your code
            </button>
            , then install below.
          </p>
        )}

        <section aria-labelledby="install-heading">
          <h2 id="install-heading" className="text-white/70 text-sm font-medium mb-4">Get Sauci</h2>
          <div className="flex flex-col gap-3">
            <a
              href={APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!isOnline) event.preventDefault()
                handleStoreClick('app_store')
              }}
              aria-disabled={!isOnline}
              title={storeUnavailableTitle}
              className={`${platform === 'ios' ? 'btn-primary' : 'btn-secondary'} w-full ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Get it on the App Store
            </a>
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => {
                if (!isOnline) event.preventDefault()
                handleStoreClick('play_store')
              }}
              aria-disabled={!isOnline}
              title={storeUnavailableTitle}
              className={`${platform === 'android' ? 'btn-primary' : 'btn-secondary'} w-full ${!isOnline ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Get it on Google Play
            </a>
          </div>
        </section>
      </div>

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
