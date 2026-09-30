export const dynamic = 'force-dynamic'

import LoginForm from './LoginForm'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <LoginForm reason={error} />
}
