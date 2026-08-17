export const dynamic = 'force-dynamic'
import QuoteAcceptView from './accept-view'

export default async function PublicQuotePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <QuoteAcceptView token={token} />
}
