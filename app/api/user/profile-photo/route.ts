import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// PATCH — any signed-in user sets/clears their own account profile photo.
// Teachers already have a richer photo field on their faculty record
// (edited via /api/teacher/profile); this covers management accounts,
// which have no faculty row, and doubles as a generic account-level photo.
export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { profileImgUrl } = await req.json()
  if (profileImgUrl !== null && typeof profileImgUrl !== 'string') {
    return NextResponse.json({ error: 'profileImgUrl must be a string or null' }, { status: 400 })
  }
  if (profileImgUrl && profileImgUrl.length > 2000) {
    return NextResponse.json({ error: 'Image URL is too long' }, { status: 400 })
  }

  const [updated] = await db.update(users)
    .set({ profileImgUrl: profileImgUrl || null, updatedAt: new Date() })
    .where(eq(users.id, session.user.id!))
    .returning({ profileImgUrl: users.profileImgUrl })

  return NextResponse.json(updated)
}
