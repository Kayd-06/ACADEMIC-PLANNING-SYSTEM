import type { Feedback } from '@/lib/db/schema'

interface TeacherIdentity {
  name: string
  email: string
}

function isAddressedTo(item: Feedback, name: string, email: string): boolean {
  const batch = (item.batch ?? '').trim()
  if (!batch || batch === 'All Faculty') return true
  if (name && batch.toLowerCase() === name) return true
  if (email && (item.subject ?? '').trim().toLowerCase() === email) return true
  return false
}

// Slice 1: name/email matching only. Slice 2 replaces this with target_teacher_id / sender_user_id.
export function splitTeacherFeedback(items: Feedback[], teacher: TeacherIdentity) {
  const name = teacher.name.trim().toLowerCase()
  const email = teacher.email.trim().toLowerCase()

  const received = items.filter(i => i.type === 'Management -> Teacher' && isAddressedTo(i, name, email))
  const sent = name
    ? items.filter(i => i.type === 'Teacher -> Management' && i.senderName.trim().toLowerCase() === name)
    : []

  return { received, sent }
}
