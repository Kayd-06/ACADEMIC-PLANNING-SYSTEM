import type { NextAuthConfig } from 'next-auth'

// Edge-runtime compatible config — no Node.js imports (no mongoose, bcrypt, etc.)
// Used by both middleware and lib/auth.ts
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role
        token.schoolId = (user as any).schoolId ?? null
        token.profileImgUrl = (user as any).profileImgUrl ?? null
      }
      if (trigger === 'update' && (session as any)?.schoolId !== undefined) {
        token.schoolId = (session as any).schoolId
      }
      if (trigger === 'update' && (session as any)?.profileImgUrl !== undefined) {
        token.profileImgUrl = (session as any).profileImgUrl
      }
      return token
    },
    session({ session, token }) {
      if (token && token.id) {
        const id = token.id as string
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
        if (isUuid) {
          session.user.id = id
          ;(session.user as any).role = token.role
          ;(session.user as any).schoolId = token.schoolId ?? null
          ;(session.user as any).profileImgUrl = token.profileImgUrl ?? null
          return session
        }
      }
      return null as any
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user?.id
      const role = (auth?.user as any)?.role as string | undefined
      const schoolId = (auth?.user as any)?.schoolId as string | null | undefined
      const path = nextUrl.pathname

      const isAuthPage = path.startsWith('/login') || path.startsWith('/signup')
      const isTeacher = path.startsWith('/teacher')
      const isManagement = path.startsWith('/management')
      const isOnboarding = path === '/management/onboarding'
      const isDashboard = isTeacher || isManagement

      if (isAuthPage && isLoggedIn && role) {
        return Response.redirect(new URL(`/${role}`, nextUrl))
      }
      if (isDashboard && !isLoggedIn) {
        return Response.redirect(new URL('/login', nextUrl))
      }
      if (isTeacher && role !== 'teacher') {
        return Response.redirect(new URL('/management', nextUrl))
      }
      if (isManagement && role !== 'management') {
        return Response.redirect(new URL('/teacher', nextUrl))
      }
      // Management accounts with no school yet must finish onboarding first
      if (isManagement && role === 'management' && !schoolId && !isOnboarding) {
        return Response.redirect(new URL('/management/onboarding', nextUrl))
      }
      if (isOnboarding && schoolId) {
        return Response.redirect(new URL('/management', nextUrl))
      }
      return true
    },
  },
  session: { strategy: 'jwt' },
}
