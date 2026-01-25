import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms & Conditions - Sauci',
  description: 'Terms and Conditions for Sauci - the couples relationship app',
}

export default function TermsAndConditions() {
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
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-2">Terms & Conditions</h1>
        <p className="text-white/40 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Agreement to Terms</h2>
            <p className="text-white/70 leading-relaxed">
              By accessing or using Sauci (&quot;the App&quot;), you agree to be bound by these Terms and Conditions (&quot;Terms&quot;). If you disagree with any part of these terms, you may not access or use our Service.
            </p>
            <p className="text-white/70 leading-relaxed">
              These Terms constitute a legally binding agreement between you and Sauci regarding your use of the App and any related services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Eligibility</h2>
            <p className="text-white/70 leading-relaxed">
              You must be at least 18 years of age to use Sauci. By using the App, you represent and warrant that:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>You are at least 18 years old</li>
              <li>You have the legal capacity to enter into these Terms</li>
              <li>You are not prohibited from using the App under applicable laws</li>
              <li>You will use the App in compliance with all applicable laws and regulations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. Account Registration</h2>
            <p className="text-white/70 leading-relaxed mb-4">
              To use certain features of Sauci, you must create an account. When creating an account, you agree to:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Provide accurate, current, and complete information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Notify us immediately of any unauthorized access to your account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-4">
              We reserve the right to suspend or terminate your account if any information provided is inaccurate, false, or violates these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Partner Connection</h2>
            <p className="text-white/70 leading-relaxed">
              Sauci is designed for use between consenting adult partners. By connecting with another user:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>You confirm that you have their consent to connect</li>
              <li>You understand that matches will be visible to both parties</li>
              <li>You agree to use the messaging features respectfully</li>
              <li>You acknowledge that either party can end the connection at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Acceptable Use</h2>
            <p className="text-white/70 leading-relaxed mb-4">
              You agree not to use Sauci to:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Harass, abuse, or harm another person</li>
              <li>Share content that is illegal, harmful, threatening, or violates others&apos; rights</li>
              <li>Impersonate any person or entity</li>
              <li>Collect or store personal data about other users without consent</li>
              <li>Interfere with or disrupt the App or servers</li>
              <li>Attempt to gain unauthorized access to the App or other accounts</li>
              <li>Use the App for any commercial purpose without authorization</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Share explicit content involving minors or non-consensual activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Content and Messaging</h2>
            <p className="text-white/70 leading-relaxed">
              You retain ownership of any content you submit through the App. By submitting content, you grant us a non-exclusive, royalty-free license to use, store, and display such content solely for the purpose of providing the Service.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              Messages sent within match chat threads are private between you and your connected partner. We do not actively monitor message content but reserve the right to review content if reported for violations of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Subscriptions and Payments</h2>

            <h3 className="text-xl font-medium text-white/90 mb-3">7.1 Premium Features</h3>
            <p className="text-white/70 leading-relaxed">
              Sauci offers premium features through subscription plans. Subscription fees are charged through the Apple App Store. All purchases are subject to Apple&apos;s terms and conditions.
            </p>

            <h3 className="text-xl font-medium text-white/90 mb-3 mt-6">7.2 Billing</h3>
            <p className="text-white/70 leading-relaxed">
              Subscriptions automatically renew unless cancelled at least 24 hours before the end of the current billing period. You can manage your subscription through your Apple ID account settings.
            </p>

            <h3 className="text-xl font-medium text-white/90 mb-3 mt-6">7.3 Refunds</h3>
            <p className="text-white/70 leading-relaxed">
              Refund requests are handled by Apple in accordance with their refund policies. We do not have direct access to process refunds for App Store purchases.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Intellectual Property</h2>
            <p className="text-white/70 leading-relaxed">
              The App and its original content (excluding user-submitted content), features, and functionality are owned by Sauci and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              You may not copy, modify, distribute, sell, or lease any part of our App or included content, nor may you reverse engineer or attempt to extract the source code.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Disclaimers</h2>
            <div className="glass p-6 my-4">
              <p className="text-white/70">
                THE APP IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              </p>
            </div>
            <p className="text-white/70 leading-relaxed">
              We do not warrant that the App will be uninterrupted, timely, secure, or error-free. We do not make any guarantees regarding the results that may be obtained from using the App or the accuracy of any information obtained through the App.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. Limitation of Liability</h2>
            <p className="text-white/70 leading-relaxed">
              To the maximum extent permitted by applicable law, Sauci shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Your use or inability to use the App</li>
              <li>Any unauthorized access to or use of our servers or personal information</li>
              <li>Any interruption or cessation of transmission to or from the App</li>
              <li>Any bugs, viruses, or similar issues transmitted through the App</li>
              <li>Any content or conduct of any third party on the App</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Indemnification</h2>
            <p className="text-white/70 leading-relaxed">
              You agree to defend, indemnify, and hold harmless Sauci and its officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses, including reasonable attorney&apos;s fees, arising out of or relating to your use of the App or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Termination</h2>
            <p className="text-white/70 leading-relaxed">
              We may terminate or suspend your account and access to the App immediately, without prior notice or liability, for any reason, including if you breach these Terms.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              Upon termination, your right to use the App will immediately cease. If you wish to terminate your account, you may do so through the App settings or by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">13. Changes to Terms</h2>
            <p className="text-white/70 leading-relaxed">
              We reserve the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days&apos; notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion.
            </p>
            <p className="text-white/70 leading-relaxed mt-4">
              By continuing to access or use our App after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">14. Governing Law</h2>
            <p className="text-white/70 leading-relaxed">
              These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which Sauci operates, without regard to its conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">15. Dispute Resolution</h2>
            <p className="text-white/70 leading-relaxed">
              Any dispute arising from or relating to these Terms or the App shall first be attempted to be resolved through good-faith negotiations. If negotiations fail, disputes shall be resolved through binding arbitration in accordance with applicable arbitration rules.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">16. Severability</h2>
            <p className="text-white/70 leading-relaxed">
              If any provision of these Terms is held to be invalid or unenforceable, such provision shall be struck and the remaining provisions shall be enforced to the fullest extent under law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">17. Entire Agreement</h2>
            <p className="text-white/70 leading-relaxed">
              These Terms, together with our Privacy Policy, constitute the entire agreement between you and Sauci regarding your use of the App and supersede any prior agreements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">18. Contact Us</h2>
            <p className="text-white/70 leading-relaxed">
              If you have any questions about these Terms, please contact us at:
            </p>
            <div className="glass p-6 mt-4">
              <p className="text-white/90">
                <strong>Email:</strong>{' '}
                <a href="mailto:legal@sauci.app" className="text-primary hover:underline">legal@sauci.app</a>
              </p>
            </div>
          </section>
        </div>
      </div>

      {/* Footer */}
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
