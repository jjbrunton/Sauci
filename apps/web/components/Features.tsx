'use client'

import { motion } from 'framer-motion'
import { Heart, MessageCircle, Lock, Sparkles, Users, Flame } from 'lucide-react'

const features = [
  {
    icon: Heart,
    title: 'Swipe to Connect',
    description: 'Answer intimate questions with simple swipes. Yes, no, or maybe - your desires stay private until you match.',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Sparkles,
    title: 'Discover Matches',
    description: 'When both partners swipe positively on a question, a match is created. Discover what you both secretly want.',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
  {
    icon: MessageCircle,
    title: 'Unlock Conversations',
    description: 'Each match opens a private chat thread. Talk about your desires in a safe, dedicated space.',
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
  },
  {
    icon: Lock,
    title: 'Complete Privacy',
    description: 'Your individual answers are never revealed. Only mutual matches are shown to both partners.',
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
  },
  {
    icon: Flame,
    title: 'Curated Question Packs',
    description: 'Explore themed packs from playful to passionate. New packs added regularly to keep things exciting.',
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
  },
  {
    icon: Users,
    title: 'Built for Couples',
    description: 'Designed exclusively for partners. Connect with your significant other using a private invite code.',
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
  },
]

export default function Features() {
  return (
    <section id="features" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-background to-background-light" />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Everything You Need to{' '}
            <span className="gradient-text">Explore Together</span>
          </h2>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Sauci creates a safe space for couples to discover their shared desires without fear of judgment.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`glass p-6 hover:border-white/20 transition-all duration-300 group card-tilt ${
                index < 2 ? 'md:col-span-1 lg:p-8' : ''
              }`}
            >
              <div className={`${index < 2 ? 'w-16 h-16' : 'w-14 h-14'} rounded-2xl ${feature.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                <feature.icon className={`${index < 2 ? 'w-8 h-8' : 'w-7 h-7'} ${feature.color} group-hover:scale-110 transition-transform duration-300`} />
              </div>
              <h3 className={`${index < 2 ? 'text-2xl' : 'text-xl'} font-semibold mb-2`}>{feature.title}</h3>
              <p className="text-white/70">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
