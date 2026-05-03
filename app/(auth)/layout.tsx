import AuthBackground from '@/components/auth/AuthBackground'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-screen h-screen overflow-hidden">
      <AuthBackground />
      {children}
    </div>
  )
}
