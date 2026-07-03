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
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
        token.role = (user as any).role
        token.schoolId = (user as any).schoolId ?? null
      }
      return token
    },
    session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        ;(session.user as any).role = token.role
        ;(session.user as any).schoolId = token.schoolId ?? null
      }
      return session
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const role = (auth?.user as any)?.role as string | undefined
      const path = nextUrl.pathname

      const isAuthPage = path.startsWith('/login') || path.startsWith('/signup')
      const isTeacher = path.startsWith('/teacher')
      const isManagement = path.startsWith('/management')
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
      return true
    },
  },
  session: { strategy: 'jwt' },
}
