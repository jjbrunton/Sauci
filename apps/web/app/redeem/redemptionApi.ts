export type RedemptionResponse =
  | { success: true; message: string }
  | { success: false; error: string }

export async function redeemCode(email: string, code: string): Promise<RedemptionResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '')
  if (!apiUrl) throw new Error('NEXT_PUBLIC_API_URL is not configured')

  const response = await fetch(`${apiUrl}/public/v1/redemptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  return response.json() as Promise<RedemptionResponse>
}

