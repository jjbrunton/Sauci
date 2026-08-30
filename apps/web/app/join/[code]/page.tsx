import type { Metadata } from 'next'
import { JoinClient } from './JoinClient'

export const metadata: Metadata = {
  title: 'Join your partner on Sauci',
  description: 'Open Sauci and pair up instantly with your invite code.',
}

export default function JoinPage({ params }: { params: { code: string } }) {
  return <JoinClient code={params.code} />
}
