import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Delete your Sauci account',
  description: 'How to delete your Sauci account and associated data.',
}

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-background-light to-background">
      <header className="py-6 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Home</span>
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-4">Delete your Sauci account</h1>
        <p className="text-white/70 leading-relaxed text-lg">
          You can request deletion of your Sauci account and associated data without reinstalling the app.
        </p>

        <div className="glass p-6 my-8">
          <h2 className="text-2xl font-semibold text-white mb-3">Request deletion by email</h2>
          <p className="text-white/70 leading-relaxed mb-4">
            Email us from the address associated with your Sauci account and ask us to delete your account.
          </p>
          <a
            href="mailto:privacy@sauci.app?subject=Sauci%20account%20deletion%20request"
            className="inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white hover:opacity-90 transition-opacity"
          >
            Request account deletion
          </a>
          <p className="text-white/60 mt-4">
            Or email <a href="mailto:privacy@sauci.app" className="text-primary hover:underline">privacy@sauci.app</a>.
          </p>
        </div>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Delete your account in the Sauci app</h2>
            <ol className="list-decimal pl-6 text-white/70 space-y-2">
              <li>Open Sauci and go to your Profile.</li>
              <li>Select Account.</li>
              <li>Choose Delete Account and follow the confirmation steps.</li>
            </ol>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">What deletion covers</h2>
            <p className="text-white/70 leading-relaxed">
              Deleting an account permanently removes the account and profile, relationship data, question responses, match data, chat messages and photos, encryption keys, and other cloud-stored data associated with that account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Timing and limited retention</h2>
            <p className="text-white/70 leading-relaxed">
              We will delete or anonymize your personal information within 30 days. We may retain information where required for legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">Need help?</h2>
            <p className="text-white/70 leading-relaxed">
              For questions about deletion or your data, contact <a href="mailto:privacy@sauci.app" className="text-primary hover:underline">privacy@sauci.app</a>.
            </p>
          </section>
        </div>
      </div>

      <footer className="py-8 px-6 border-t border-white/5">
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
