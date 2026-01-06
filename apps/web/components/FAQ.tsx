'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'How does matching work?',
    answer:
      "When you and your partner both answer positively to the same question (yes or maybe), it's a match! You'll both be notified and a private chat thread opens for that question. Your individual answers remain private until there's a match.",
  },
  {
    question: 'Are my answers private?',
    answer:
      "Absolutely. Your individual answers are never revealed to your partner. They only see questions where you've both answered positively. If you say no to something, your partner will never know.",
  },
  {
    question: 'What happens if my partner says no to a question?',
    answer:
      "Nothing! They won't know you were interested, and you won't know they said no. The question simply doesn't become a match. This creates a safe space to be honest about your desires.",
  },
  {
    question: 'Do both partners need Pro?',
    answer:
      "No! When one partner upgrades to Pro, both partners automatically get full access to all premium packs. One subscription covers your entire relationship.",
  },
  {
    question: 'Is my data secure?',
    answer:
      'Yes. All chat messages are end-to-end encrypted, meaning only you and your partner can read them. We take your privacy seriously and never share your data with third parties.',
  },
]

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
}: {
  question: string
  answer: string
  isOpen: boolean
  onClick: () => void
}) {
  return (
    <div className="glass overflow-hidden">
      <button
        onClick={onClick}
        className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-semibold text-lg pr-4">{question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0"
        >
          <ChevronDown className="w-5 h-5 text-white/60" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-6 pb-5 text-white/70 leading-relaxed">{answer}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section id="faq" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-background-light" />

      <div className="relative z-10 max-w-3xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto">
            Everything you need to know about Sauci.
          </p>
        </motion.div>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <FAQItem
                question={faq.question}
                answer={faq.answer}
                isOpen={openIndex === index}
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
