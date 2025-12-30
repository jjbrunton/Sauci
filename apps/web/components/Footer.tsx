'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="relative py-12 border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Sauci"
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <span className="text-xl font-bold gradient-text">Sauci</span>
          </Link>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            <Link href="/privacy" className="text-white/60 hover:text-white transition-colors text-sm">
              Privacy Policy
            </Link>
            <Link href="/terms" className="text-white/60 hover:text-white transition-colors text-sm">
              Terms & Conditions
            </Link>
            <a href="mailto:support@sauci.app" className="text-white/60 hover:text-white transition-colors text-sm">
              Contact
            </a>
          </div>

          {/* Copyright */}
          <div className="text-white/40 text-sm">
            &copy; {currentYear} Sauci. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  )
}
