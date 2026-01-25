import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy - Sauci',
  description: 'Privacy Policy for Sauci - the couples relationship app',
}

export default function PrivacyPolicy() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-white/40 mb-12">Last updated: December 2024</p>

        <div className="prose prose-invert prose-lg max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
            <p className="text-white/70 leading-relaxed">
              Welcome to Sauci (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and related services (collectively, the &quot;Service&quot;).
            </p>
            <p className="text-white/70 leading-relaxed">
              By using Sauci, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>

            <h3 className="text-xl font-medium text-white/90 mb-3">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong>Account Information:</strong> Email address, display name, and profile information when you create an account.</li>
              <li><strong>Relationship Data:</strong> Information about your partner connection, including invite codes used to link accounts.</li>
              <li><strong>Response Data:</strong> Your answers (yes/no/maybe) to questions within the app.</li>
              <li><strong>Messages:</strong> Content of messages you send within match chat threads.</li>
              <li><strong>Feedback:</strong> Any feedback, suggestions, or communications you send to us.</li>
            </ul>

            <h3 className="text-xl font-medium text-white/90 mb-3 mt-6">2.2 Automatically Collected Information</h3>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong>Device Information:</strong> Device type, operating system, unique device identifiers.</li>
              <li><strong>Usage Data:</strong> App interactions, features used, time spent in the app.</li>
              <li><strong>Log Data:</strong> IP address, access times, and app crash reports.</li>
            </ul>

            <h3 className="text-xl font-medium text-white/90 mb-3 mt-6">2.3 Third-Party Services</h3>
            <p className="text-white/70 leading-relaxed">
              We use third-party services that may collect information:
            </p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong>Authentication:</strong> Apple Sign-In for secure account creation.</li>
              <li><strong>Analytics:</strong> To understand app usage and improve our service.</li>
              <li><strong>Payment Processing:</strong> RevenueCat for subscription management (we do not store payment details).</li>
              <li><strong>Error Tracking:</strong> Sentry for crash reporting and performance monitoring.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
            <p className="text-white/70 leading-relaxed mb-4">We use the collected information to:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li>Provide, maintain, and improve our Service</li>
              <li>Create and manage your account</li>
              <li>Enable partner matching functionality</li>
              <li>Process your question responses and determine matches</li>
              <li>Facilitate in-app messaging between matched partners</li>
              <li>Send push notifications about matches and messages</li>
              <li>Process subscriptions and in-app purchases</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Detect, prevent, and address technical issues and fraud</li>
              <li>Analyze usage patterns to improve user experience</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">4. Privacy of Your Responses</h2>
            <div className="glass p-6 my-4">
              <p className="text-white/90 font-medium mb-2">Important: Your Individual Answers Are Private</p>
              <p className="text-white/70">
                Your individual responses to questions are never shared with your partner or anyone else. Only when both partners respond positively (yes or maybe) to the same question is a &quot;match&quot; created and revealed to both users. This ensures that you can answer honestly without fear of judgment.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">5. Data Sharing and Disclosure</h2>
            <p className="text-white/70 leading-relaxed mb-4">We do not sell your personal information. We may share information in the following circumstances:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong>With Your Partner:</strong> Match information (when both respond positively) and messages within chat threads.</li>
              <li><strong>Service Providers:</strong> Third-party vendors who assist in operating our Service (hosting, analytics, payment processing).</li>
              <li><strong>Legal Requirements:</strong> When required by law, legal process, or to protect our rights and safety.</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">6. Data Security</h2>
            <p className="text-white/70 leading-relaxed">
              We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. This includes encryption of data in transit and at rest, secure authentication, and regular security assessments. However, no method of transmission over the Internet or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">7. Data Retention</h2>
            <p className="text-white/70 leading-relaxed">
              We retain your personal information for as long as your account is active or as needed to provide you services. If you delete your account, we will delete or anonymize your personal information within 30 days, except where we are required to retain it for legal purposes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">8. Your Rights and Choices</h2>
            <p className="text-white/70 leading-relaxed mb-4">You have the following rights regarding your data:</p>
            <ul className="list-disc pl-6 text-white/70 space-y-2">
              <li><strong>Access:</strong> Request a copy of the personal information we hold about you.</li>
              <li><strong>Correction:</strong> Request correction of inaccurate personal information.</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data.</li>
              <li><strong>Portability:</strong> Request a copy of your data in a portable format.</li>
              <li><strong>Opt-out:</strong> Disable push notifications through your device settings.</li>
            </ul>
            <p className="text-white/70 leading-relaxed mt-4">
              To exercise these rights, please contact us at <a href="mailto:privacy@sauci.app" className="text-primary hover:underline">privacy@sauci.app</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-white/70 leading-relaxed">
              Sauci is intended for users who are 18 years of age or older. We do not knowingly collect personal information from children under 18. If we learn that we have collected personal information from a child under 18, we will delete that information promptly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">10. International Data Transfers</h2>
            <p className="text-white/70 leading-relaxed">
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. We ensure appropriate safeguards are in place to protect your information when transferred internationally.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
            <p className="text-white/70 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. You are advised to review this Privacy Policy periodically for any changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Us</h2>
            <p className="text-white/70 leading-relaxed">
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="glass p-6 mt-4">
              <p className="text-white/90">
                <strong>Email:</strong>{' '}
                <a href="mailto:privacy@sauci.app" className="text-primary hover:underline">privacy@sauci.app</a>
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
