'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import type { CaptureResult } from 'posthog-js'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

const INVITE_PATH_PATTERN = /\/join\/[^/?#\s]+/g

function redactInviteUrl(defaultUrl: string): string {
  const url = new URL(defaultUrl)

  if (url.pathname.startsWith('/join/')) {
    return `${url.origin}/join/[invite]`
  }

  return defaultUrl
}

export function redactInvitePaths<T>(value: T): T {
  if (typeof value === 'string') {
    return value.replace(INVITE_PATH_PATTERN, '/join/[invite]') as T
  }

  if (Array.isArray(value)) {
    return value.map(redactInvitePaths) as T
  }

  if (value && typeof value === 'object' && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactInvitePaths(entry)])) as T
  }

  return value
}

export function redactInvitePathsBeforeSend(event: CaptureResult | null): CaptureResult | null {
  return event ? redactInvitePaths(event) : null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      const isInvitePage = window.location.pathname.startsWith('/join/')
      posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: false,
        get_current_url: redactInviteUrl,
        before_send: redactInvitePathsBeforeSend,
        // This must be part of initialization, not only the navigation effect
        // below, so an initially loaded invite page is protected before its DOM
        // can be considered for capture or recording.
        autocapture: !isInvitePage,
        disable_session_recording: isInvitePage,
        mask_all_text: isInvitePage,
      })
    }
  }, [])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

    // Invite codes are credentials. Do not let their page enter PostHog's DOM
    // autocapture or session-recording pipeline, even though event properties
    // and URLs are separately redacted below.
    const isInvitePage = pathname?.startsWith('/join/')
    posthog.set_config({
      autocapture: !isInvitePage,
      disable_session_recording: isInvitePage,
      mask_all_text: isInvitePage,
    })
  }, [pathname])

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) {
    return <>{children}</>
  }

  return <PHProvider client={posthog}>{children}</PHProvider>
}
