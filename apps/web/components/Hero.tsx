'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-to-b from-background-light to-background" />

      {/* Accent Glows */}
      <div className="absolute top-20 right-0 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[150px] animate-pulse-glow" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-secondary/20 rounded-full blur-[150px] animate-pulse-glow" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-20 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        {/* Text Content */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="flex-1 text-center lg:text-left"
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 glass px-4 py-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-sm text-white/80">Discover What You Both Desire</span>
          </motion.div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold leading-tight mb-6">
            Ignite Your{' '}
            <span className="gradient-text">Connection</span>
          </h1>

          <p className="text-lg sm:text-xl text-white/60 max-w-xl mx-auto lg:mx-0 mb-8">
            Sauci helps couples explore their desires through playful questions.
            Swipe, match, and unlock deeper conversations with your partner.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <a
              href="https://apps.apple.com/app/sauci"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary flex items-center gap-2 w-full sm:w-auto justify-center"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Download for iOS
            </a>
            <a href="#how-it-works" className="btn-secondary flex items-center gap-2 w-full sm:w-auto justify-center">
              Learn More
            </a>
          </div>
        </motion.div>

        {/* Phone Mockups */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex-1 flex justify-center items-center"
        >
          <div className="relative flex items-center justify-center">
            {/* Glow behind phones */}
            <div className="absolute w-[400px] h-[500px] bg-gradient-primary rounded-full blur-[100px] opacity-20" />

            {/* Back Phone - Packs */}
            <motion.div
              initial={{ opacity: 0, x: 60, rotate: 12 }}
              animate={{ opacity: 1, x: 60, rotate: 12 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className="absolute -right-4 sm:right-0"
            >
              <PhoneMockup
                screenshot="/screenshots/packs.png"
                alt="Question Packs"
                className="w-[180px] sm:w-[220px] opacity-60"
              />
            </motion.div>

            {/* Back Phone - Swipe */}
            <motion.div
              initial={{ opacity: 0, x: -60, rotate: -12 }}
              animate={{ opacity: 1, x: -60, rotate: -12 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="absolute -left-4 sm:left-0"
            >
              <PhoneMockup
                screenshot="/screenshots/swipe.png"
                alt="Swipe on Questions"
                className="w-[180px] sm:w-[220px] opacity-60"
              />
            </motion.div>

            {/* Front Phone - Home */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative z-10 animate-float"
            >
              <PhoneMockup
                screenshot="/screenshots/home.png"
                alt="Sauci Home Screen"
                className="w-[220px] sm:w-[280px]"
                featured
              />
            </motion.div>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <div className="w-6 h-10 rounded-full border-2 border-white/20 flex justify-center pt-2">
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="w-1.5 h-1.5 rounded-full bg-white/60"
          />
        </div>
      </motion.div>
    </section>
  )
}

function PhoneMockup({
  screenshot,
  alt,
  className = '',
  featured = false,
}: {
  screenshot: string
  alt: string
  className?: string
  featured?: boolean
}) {
  return (
    <div className={`relative ${className}`}>
      {/* Phone Frame */}
      <div className={`relative bg-black rounded-[2.5rem] p-2 shadow-2xl ${featured ? 'glow-primary' : ''}`}>
        {/* Screen */}
        <div className="relative rounded-[2rem] overflow-hidden bg-background">
          <Image
            src={screenshot}
            alt={alt}
            width={430}
            height={932}
            className="w-full h-auto"
            priority={featured}
          />
        </div>
        {/* Dynamic Island / Notch */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[30%] h-[3%] bg-black rounded-full" />
      </div>
    </div>
  )
}
