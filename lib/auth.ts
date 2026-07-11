import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { findUserByEmail } from '@/lib/db/queries/users'
import { authConfig } from '@/auth.config'

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
})
