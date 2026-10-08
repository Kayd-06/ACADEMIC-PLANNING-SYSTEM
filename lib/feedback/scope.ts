import type { Feedback } from '@/lib/db/schema'

interface TeacherIdentity {
  name: string
  email: string
  // Names the teacher is listed under in the faculty directory (admins pick that name when
  // sending), which can differ from the account name.
  aliases?: string[]
}

function isAddressedTo(item: Feedback, names: string[], email: string): boolean {
  const batch = (item.batch ?? '').trim()
  if (!batch || batch === 'All Faculty') return true
  if (names.includes(batch.toLowerCase())) return true
  if (email && (item.subject ?? '').trim().toLowerCase() === email) return true
  return false
}

// Slice 1: name/email matching only. Slice 2 replaces this with target_teacher_id / sender_user_id.
export function splitTeacherFeedback(items: Feedback[], teacher: TeacherIdentity) {
  const name = teacher.name.trim().toLowerCase()
  const email = teacher.email.trim().toLowerCase()
  const names = [name, ...(teacher.aliases ?? []).map(a => a.trim().toLowerCase())].filter(Boolean)

  const received = items.filter(i => i.type === 'Management -> Teacher' && isAddressedTo(i, names, email))
  const sent = name
    ? items.filter(i => i.type === 'Teacher -> Management' && i.senderName.trim().toLowerCase() === name)
    : []

  return { received, sent }
}
