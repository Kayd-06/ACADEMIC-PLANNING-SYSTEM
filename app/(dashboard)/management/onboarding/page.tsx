import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import OnboardingChoice from '@/components/dashboard/management/OnboardingChoice'

export default async function ManagementOnboardingPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if ((session.user as any).role !== 'management') redirect('/teacher')
  if ((session.user as any).schoolId) redirect('/management')

  return <OnboardingChoice userName={session.user.name ?? 'there'} />
}
