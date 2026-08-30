import type { Metadata } from 'next'
import { JoinClient } from './JoinClient'

export const metadata: Metadata = {
  title: 'Join your partner on Sauci',
  description: 'Open Sauci and pair up instantly with your invite code.',
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return <JoinClient code={code} />
}
