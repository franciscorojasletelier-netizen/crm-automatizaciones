import { NextResponse } from 'next/server'

export async function GET() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN ?? ''
  const codes: number[] = []
  for (let i = 0; i < Math.min(token.length, 15); i++) {
    codes.push(token.charCodeAt(i))
  }
  return NextResponse.json({ len: token.length, first15codes: codes })
}
