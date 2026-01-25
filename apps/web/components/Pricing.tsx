'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Check, Crown, Heart, Sparkles, Infinity } from 'lucide-react'

const APP_STORE_URL = 'https://apps.apple.com/gb/app/sauci-couple-games-romance/id6757159885'
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sauci.app'

const features = [

  'Unlock all question packs',
  'Access exclusive premium content',
  'New packs added regularly',
  'Both partners get full access',
  'One-time setup, shared benefits',
]

export default function Pricing() {
  const [downloadUrl, setDownloadUrl] = useState(APP_STORE_URL)

  useEffect(() => {
    const userAgent = navigator.userAgent || ''
    if (/Android/i.test(userAgent)) {
      setDownloadUrl(PLAY_STORE_URL)
    }
  }, [])

  return (

    <section id="pricing" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background-light to-background" />

      {/* Accent Glows */}
      <div className="absolute top-1/4 right-0 w-[400px] h-[400px] bg-primary/15 rounded-full blur-[150px]" />
      <div className="absolute bottom-1/4 left-0 w-[300px] h-[300px] bg-secondary/15 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-5xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Upgrade to <span className="gradient-text">Sauci Pro</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Unlock the full experience and discover new ways to connect with your partner.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="max-w-xl mx-auto"
        >
          {/* Main Pricing Card */}
          <div className="glass border-primary/30 p-8 relative overflow-hidden">
            {/* Crown Badge */}
            <div className="absolute -top-1 -right-1">
              <div className="bg-gradient-to-r from-primary to-secondary px-4 py-1 rounded-bl-xl rounded-tr-xl">
                <span className="text-sm font-semibold flex items-center gap-1">
                  <Crown className="w-4 h-4" /> PRO
                </span>
              </div>
            </div>

            {/* Couple Highlight */}
            <div className="flex items-center justify-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Heart className="w-6 h-6 text-primary" />
              </div>
              <Infinity className="w-6 h-6 text-white/40" />
              <div className="w-12 h-12 rounded-full bg-secondary/20 flex items-center justify-center">
                <Heart className="w-6 h-6 text-secondary" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-center mb-2">One Subscription, Both Partners</h3>

            {/* Pricing Display */}
            <div className="text-center mb-4">
              <span className="text-4xl font-bold gradient-text">From £4.99</span>
              <span className="text-white/60 text-lg">/month</span>
            </div>

            <p className="text-white/70 text-center mb-6">
              When you upgrade to Pro, your partner automatically gets full access too.
              No separate purchases needed - you&apos;re in this together.
            </p>

            {/* Feature List */}
            <ul className="space-y-3 mb-8">
              {features.map((feature, index) => (
                <motion.li
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <Check className="w-4 h-4 text-green-400" />
                  </div>
                  <span className="text-white/80">{feature}</span>
                </motion.li>
              ))}
            </ul>

            {/* Value Proposition */}
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-white/80">
                    <span className="font-semibold text-white">Pay once per couple.</span>{' '}
                    Whether monthly or yearly, one subscription unlocks Pro for both you and your partner.
                    That's two accounts for the price of one.
                  </p>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="text-center">
              <a
                href={downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2"
              >
                <Crown className="w-5 h-5" />
                Get Sauci Pro
              </a>

              <p className="text-sm text-white/40 mt-3">
                Upgrade anytime from within the app
              </p>
            </div>
          </div>
        </motion.div>

        {/* Bottom Note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="text-center text-white/40 text-sm mt-8 max-w-lg mx-auto"
        >
          Start free with access to selected packs. Upgrade to Pro when you're ready to unlock everything.
        </motion.p>
      </div>
    </section>
  )
}
