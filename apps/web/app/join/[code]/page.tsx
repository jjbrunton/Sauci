import type { Metadata } from 'next'
import { JoinClient } from './JoinClient'

export const metadata: Metadata = {
  title: 'Compare answers together on Sauci',
  description: 'Copy your invite code, then join Sauci to discover what you both agree on.',
}

export default async function JoinPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  return <JoinClient code={code} />
}
