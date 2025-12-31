'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Gift, Mail, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function RedeemPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isRedeemed, setIsRedeemed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Please enter your email address')
      return
    }

    if (!code.trim()) {
      setError('Please enter your redemption code')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/redeem-code`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            code: code.trim(),
          }),
        }
      )

      const data = await response.json()

      if (data.success) {
        setIsRedeemed(true)
      } else {
        setError(data.error || 'Failed to redeem code. Please try again.')
      }
    } catch (err) {
      console.error('Redemption error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Success state
  if (isRedeemed) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-background-light to-background flex items-center justify-center p-6">
        <div className="glass-light p-8 sm:p-12 max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold mb-3">Code Redeemed!</h1>
          <p className="text-white/60 mb-2">
            Your premium access has been activated for
          </p>
          <p className="text-primary font-semibold mb-6">{email}</p>
          <p className="text-white/40 text-sm mb-8">
            Enjoy all premium question packs and features.
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
      <div className="max-w-md mx-auto px-6 py-12 sm:py-20">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-8">
          <Gift className="w-10 h-10 text-primary" />
        </div>

        {/* Title */}
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-3">Redeem Premium</h1>
        <p className="text-white/60 text-center mb-10">
          Enter your email and redemption code to unlock premium features
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass-light p-6 sm:p-8">
          {/* Error Message */}
          {error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {/* Email Field */}
          <div className="mb-4">
            <label htmlFor="email" className="block text-white/60 text-sm mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => { setError(null); setEmail(e.target.value) }}
                placeholder="Enter your email"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Code Field */}
          <div className="mb-6">
            <label htmlFor="code" className="block text-white/60 text-sm mb-2">
              Redemption Code
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                id="code"
                value={code}
                onChange={(e) => { setError(null); setCode(e.target.value.toUpperCase()) }}
                placeholder="Enter redemption code"
                className="w-full bg-white/5 border border-white/10 rounded-lg py-3 pl-12 pr-4 text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors uppercase tracking-wider"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Redeeming...
              </>
            ) : (
              'Redeem Code'
            )}
          </button>
        </form>

        {/* Info Text */}
        <p className="text-white/40 text-sm text-center mt-6 px-4">
          Redemption codes are provided through promotions and giveaways. Each code can only be used once.
        </p>
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
