import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      name: string
      email: string
      role: 'teacher' | 'management'
    }
  }

  interface User {
    id: string
    role: 'teacher' | 'management'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: 'teacher' | 'management'
  }
}
