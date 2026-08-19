import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { findUserByEmail, findUserById } from '@/lib/db/queries/users'
import { authConfig } from '@/auth.config'

// auth() re-runs the jwt callback on every call (every page render, every API
// route). Verifying the user against the DB unconditionally on each of those
// added a DB round-trip to every single request — with dozens of API routes
// each calling auth(), one page load could trigger this several times over.
// Re-verify only periodically (or on an explicit update()/sign-in), so
// role/school changes still land without requiring re-login, without paying
// the DB cost on the hot path of every request.
const SESSION_REVERIFY_INTERVAL_MS = 5 * 60 * 1000

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await findUserByEmail(credentials.email as string)
        if (!user) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        )
        if (!passwordMatch) return null

        if (user.status !== 'active') {
          throw new Error('EMAIL_NOT_VERIFIED')
        }

        // "Active school" only applies to management accounts, which can
        // belong to and switch between multiple schools. Teachers join
        // exactly one school, so a stray activeSchoolId (e.g. left over
        // from a role change) must never override their real schoolId.
        const schoolId = user.role === 'management'
          ? (user.activeSchoolId ?? user.schoolId ?? null)
          : (user.schoolId ?? null)

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          schoolId,
          profileImgUrl: user.profileImgUrl ?? null,
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (authConfig.callbacks?.jwt) {
        const result = await authConfig.callbacks.jwt({ token, user, trigger, session })
        if (result) {
          token = result
        }
      }
      if (token?.id) {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token.id as string)
        if (!isUuid) {
          return {}
        }

        if (user) {
          // Sign-in: `user` already carries fresh data from authorize(), no
          // need to re-fetch it immediately.
          token.verifiedAt = Date.now()
          return token
        }

        const lastVerified = typeof token.verifiedAt === 'number' ? token.verifiedAt : 0
        const isStale = Date.now() - lastVerified > SESSION_REVERIFY_INTERVAL_MS
        if (!isStale && trigger !== 'update') {
          return token
        }

        // Verify user still exists in the PostgreSQL database
        const dbUser = await findUserById(token.id as string)
        if (!dbUser) {
          // User doesn't exist (e.g. stale session from MongoDB)
          return {}
        }
        // Refresh token values from database
        token.role = dbUser.role
        token.schoolId = dbUser.role === 'management'
          ? (dbUser.activeSchoolId ?? dbUser.schoolId ?? null)
          : (dbUser.schoolId ?? null)
        token.profileImgUrl = dbUser.profileImgUrl ?? null
        token.verifiedAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      if (!token || !token.id) {
        if (session.user) {
          delete (session as any).user
        }
        return session
      }
      if (authConfig.callbacks?.session) {
        return await (authConfig.callbacks.session as any)({ session, token })
      }
      return session
    },
  },
})

export function getSchoolId(session: any): string | null {
  const schoolId = session?.user?.schoolId
  if (!schoolId || schoolId === 'null' || schoolId === 'undefined' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(schoolId)) {
    return null
  }
  return schoolId
}

