'use client'

import { motion } from 'framer-motion'
import { UserPlus, Layers, Hand, Heart, type LucideIcon } from 'lucide-react'

const steps: Array<{
  number: string
  title: string
  description: string
  icon: LucideIcon
  color: string
}> = [
  {
    number: '01',
    title: 'Connect with Your Partner',
    description: 'Create your account and invite your partner using a unique code. Your journey begins together.',
    icon: UserPlus,
    color: 'text-primary',
  },
  {
    number: '02',
    title: 'Browse Question Packs',
    description: 'Choose from curated packs covering communication, life goals, and relationship growth.',
    icon: Layers,
    color: 'text-secondary',
  },
  {
    number: '03',
    title: 'Swipe on Questions',
    description: 'Answer each question honestly. Swipe right for yes, left for no, or up for maybe. Your answers stay private.',
    icon: Hand,
    color: 'text-orange-400',
  },
  {
    number: '04',
    title: 'Discover Your Matches',
    description: 'When both partners answer positively, it\'s a match! Discuss what matters most through private chats.',
    icon: Heart,
    color: 'text-pink-400',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background-light to-background" />

      {/* Accent Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-secondary/10 rounded-full blur-[200px]" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            How <span className="gradient-text">Sauci</span> Works
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Four simple steps to better communication and a stronger relationship.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-[60%] w-full h-0.5 bg-gradient-to-r from-primary/50 to-transparent" />
              )}

              <div className="glass p-6 h-full group hover:border-white/20 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-4xl font-bold gradient-text opacity-50">
                    {step.number}
                  </div>
                  <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <step.icon className={`w-5 h-5 ${step.color}`} />
                  </div>
                </div>
                <h3 className="text-xl font-semibold mb-2">{step.title}</h3>
                <p className="text-white/70">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
