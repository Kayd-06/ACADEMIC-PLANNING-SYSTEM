'use client'
import { useState, useEffect, useRef } from 'react'
import { HelpCircle, Settings, X, CheckCircle, AlertCircle, BookOpen, Calendar, Mail, User, Shield, Info, Check, Globe, Building2, Hash, Loader2, LogIn, Bell, Megaphone, FileBarChart, ClipboardList, CreditCard, CalendarCheck, CheckCheck, Camera, Upload } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import MyProfileModal from '@/components/dashboard/teacher/MyProfileModal'
import { getBlobUrl } from '@/lib/blob'



const applyTheme = (themeName: string) => {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const themes = {
    indigo: { primary: '#6366f1', hover: '#4f46e5', light: '#f5f7ff', rgb: '99, 102, 241' },
    blue: { primary: '#002045', hover: '#1a365d', light: '#eff6ff', rgb: '0, 32, 69' },
    emerald: { primary: '#10b981', hover: '#059669', light: '#ecfdf5', rgb: '16, 185, 129' },
    slate: { primary: '#475569', hover: '#334155', light: '#f1f5f9', rgb: '71, 85, 105' },
  }
  const selected = themes[themeName as keyof typeof themes] || themes.blue
  root.style.setProperty('--accent-primary', selected.primary)
  root.style.setProperty('--accent-hover', selected.hover)
  root.style.setProperty('--accent-light', selected.light)
  root.style.setProperty('--accent-primary-rgb', selected.rgb)
}

function formatRelativeTime(dateInput: string | Date) {
  const date = new Date(dateInput)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffSec < 60) return 'Just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr}h ago`
  if (diffDay === 1) return 'Yesterday'
  return `${diffDay}d ago`
}

interface TopHeaderProps {
  initials: string
}

export default function TopHeader({ initials }: TopHeaderProps) {
  const { data: session, update } = useSession()
  const role = (session?.user as any)?.role as string | undefined

  // Modals
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showJoinSchool, setShowJoinSchool] = useState(false)

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [loadingNotifications, setLoadingNotifications] = useState(false)
  const notificationsRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications')
      if (res.ok) {
        const data = await res.json()
        setNotifications(data.items || [])
        setUnreadCount(data.unreadCount || 0)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAsRead = async (id: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const markAllAsRead = async () => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true })
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const deleteNotification = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications?id=${id}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const clearReadNotifications = async () => {
    try {
      const res = await fetch('/api/notifications?read=true', {
        method: 'DELETE'
      })
      if (res.ok) {
        fetchNotifications()
      }
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (!session?.user?.id) return
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [session?.user?.id])

  // Settings preferences
  const [prefEmail, setPrefEmail] = useState(true)
  const [prefTheme, setPrefTheme] = useState('blue')
  const [prefSyllabusNotify, setPrefSyllabusNotify] = useState(true)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // School info (for teacher)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [teacherPhotoUrl, setTeacherPhotoUrl] = useState<string | null>(null)

  // My Profile (teacher faculty record)
  const [showMyProfile, setShowMyProfile] = useState(false)

  function openMyProfile() {
    setShowProfileMenu(false)
    setShowMyProfile(true)
  }

  // Edit Profile Picture (management — no faculty record to store a photo on,
  // so this writes directly to users.profile_img_url instead)
  const [showEditPhoto, setShowEditPhoto] = useState(false)
  const [photoUrlInput, setPhotoUrlInput] = useState('')
  const [savingPhoto, setSavingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploadingBlob, setUploadingBlob] = useState(false)

  const sessionPhotoUrl = (session?.user as any)?.profileImgUrl as string | null | undefined
  const myPhotoUrl = role === 'teacher' ? teacherPhotoUrl : (sessionPhotoUrl ?? null)

  const [myPhotoBroken, setMyPhotoBroken] = useState(false)
  useEffect(() => { setMyPhotoBroken(false) }, [myPhotoUrl])
  const myPhotoOk = myPhotoUrl && !myPhotoBroken

  function openEditPhoto() {
    setShowProfileMenu(false)
    setPhotoUrlInput(sessionPhotoUrl ?? '')
    setPhotoError(null)
    setShowEditPhoto(true)
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBlob(true)
    setPhotoError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('folder', 'profiles')
      const res = await fetch('/api/blob/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) {
        setPhotoError(data.error || 'Upload failed')
        return
      }
      setPhotoUrlInput(data.url)
    } catch {
      setPhotoError('Network error uploading file')
    } finally {
      setUploadingBlob(false)
    }
  }

  async function handleSavePhoto(e: React.FormEvent) {
    e.preventDefault()
    setSavingPhoto(true)
    setPhotoError(null)
    try {
      const res = await fetch('/api/user/profile-photo', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileImgUrl: photoUrlInput.trim() || null }),
      })
      const data = await res.json()
      if (!res.ok) { setPhotoError(data.error || 'Failed to save photo'); return }
      await update({ profileImgUrl: data.profileImgUrl ?? null })
      setShowEditPhoto(false)
    } catch {
      setPhotoError('Network error — please try again')
    } finally {
      setSavingPhoto(false)
    }
  }

  // Join school form
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [joinSuccess, setJoinSuccess] = useState(false)

  const profileRef = useRef<HTMLDivElement>(null)

  // Load theme preferences on mount
  useEffect(() => {
    if (!session?.user?.email) return
    const stored = localStorage.getItem(`user_preferences_${session.user.email}`)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (parsed.prefEmail !== undefined) setPrefEmail(parsed.prefEmail)
        if (parsed.prefTheme !== undefined) { setPrefTheme(parsed.prefTheme); applyTheme(parsed.prefTheme) }
        if (parsed.prefSyllabusNotify !== undefined) setPrefSyllabusNotify(parsed.prefSyllabusNotify)
      } catch { /* ignore */ }
    } else {
      applyTheme('blue')
    }
  }, [session?.user?.email])

  // Fetch current school name for teacher
  useEffect(() => {
    if (role !== 'teacher') return
    const schoolId = (session?.user as any)?.schoolId
    if (!schoolId) { setSchoolName(null); return }
    fetch('/api/school').then(r => r.json()).then(d => {
      if (!d.error) setSchoolName(d.name ?? null)
    }).catch(() => {})
  }, [role, (session?.user as any)?.schoolId])

  // Fetch the teacher's own faculty photo, if set, so the header avatar isn't
  // stuck on initials once they've uploaded a profileImgUrl
  useEffect(() => {
    if (role !== 'teacher') return
    fetch('/api/teacher/profile').then(r => r.json()).then(d => {
      setTeacherPhotoUrl(d?.profile?.profileImgUrl || null)
    }).catch(() => {})
  }, [role])

  // Close profile menu and notifications on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const savePreferences = () => {
    if (session?.user?.email) {
      localStorage.setItem(`user_preferences_${session.user.email}`, JSON.stringify({ prefEmail, prefTheme, prefSyllabusNotify }))
      applyTheme(prefTheme)
    }
    setShowSaveSuccess(true)
    setTimeout(() => { setShowSaveSuccess(false); setShowSettings(false) }, 1200)
  }

  async function handleJoinSchool(e: React.FormEvent) {
    e.preventDefault()
    if (!joinCode.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      const res = await fetch('/api/teacher/join-school', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode }),
      })
      const data = await res.json()
      if (!res.ok) { setJoinError(data.error || 'Something went wrong'); return }
      setJoinSuccess(true)
      setSchoolName(data.schoolName)
      await update({ schoolId: data.schoolId })
      setTimeout(() => { window.location.reload() }, 1000)
    } catch {
      setJoinError('Network error — please try again')
    } finally {
      setJoining(false)
    }
  }

  function openJoinModal() {
    setShowProfileMenu(false)
    setJoinCode('')
    setJoinError(null)
    setJoinSuccess(false)
    setShowJoinSchool(true)
  }

  const currentSchoolId = (session?.user as any)?.schoolId as string | null

  return (
    <motion.header
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30 }}
      className="bg-white border-b border-slate-200 px-6 h-[72px] flex items-center justify-between sticky top-0 z-40 print:hidden"
    >
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div className="relative w-full">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search students, classes, or reports..."
            className="w-full pl-10 pr-4 py-2.5 text-[13px] bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-200 focus:bg-white transition-all placeholder-slate-400 text-slate-700"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 relative">

        {/* Help */}
        <button onClick={() => setShowHelp(true)} className="p-2 rounded-full text-gray-500 hover:text-[#002045] hover:bg-slate-100 transition-colors">
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* Notifications */}
        <div ref={notificationsRef} className="relative">
          <button
            onClick={() => setShowNotifications(v => !v)}
            className="p-2 rounded-full text-gray-500 hover:text-[#002045] hover:bg-slate-100 transition-colors relative"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold">
                {unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.13 }}
                className="absolute right-0 top-10 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {loadingNotifications ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                      <Bell className="w-8 h-8 text-slate-300 mb-2" />
                      <p className="text-xs text-slate-500 font-medium">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markAsRead(n.id)
                          if (n.link) {
                            window.location.href = n.link
                          }
                          setShowNotifications(false)
                        }}
                        className={`p-3 flex gap-3 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!n.isRead ? 'bg-indigo-50/30' : ''}`}
                      >
                        {/* Category icon */}
                        <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 shrink-0 mt-0.5">
                          <CalendarCheck className="w-4 h-4 text-indigo-500" />
                        </div>
                        {/* Text content */}
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-xs font-bold text-slate-800 leading-tight truncate">{n.title}</p>
                          <p className="text-[11px] text-slate-500 leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                          <span className="text-[9px] text-slate-400 mt-1 inline-block">{formatRelativeTime(n.createdAt)}</span>
                        </div>
                        {/* Status / actions */}
                        <div className="flex flex-col items-end justify-between shrink-0">
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 mt-2"></span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteNotification(n.id)
                            }}
                            className="p-1 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {notifications.length > 0 && (
                  <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-center">
                    <button
                      onClick={clearReadNotifications}
                      className="text-[10px] font-extrabold text-slate-500 hover:text-slate-700 uppercase tracking-wider"
                    >
                      Clear read notifications
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings */}
        <button onClick={() => setShowSettings(true)} className="p-2 rounded-full text-gray-500 hover:text-[#002045] hover:bg-slate-100 transition-colors">
          <Settings className="w-5 h-5" />
        </button>

        {/* Profile avatar + dropdown */}
        <div ref={profileRef} className="relative ml-2">
          <button
            onClick={() => setShowProfileMenu(v => !v)}
            className="w-8 h-8 rounded-full bg-[#002045] flex items-center justify-center text-white text-xs font-semibold hover:bg-[#1a365d] transition-colors focus:outline-none focus:ring-2 focus:ring-[#002045]/30 overflow-hidden"
          >
            {myPhotoOk ? <img src={getBlobUrl(myPhotoUrl!)} alt="" className="w-full h-full object-cover" onError={() => setMyPhotoBroken(true)} /> : initials}
          </button>

          <AnimatePresence>
            {showProfileMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.13 }}
                className="absolute right-0 top-10 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden"
              >
                {/* User info */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#002045] flex items-center justify-center text-white text-xs font-bold shrink-0 overflow-hidden">
                      {myPhotoOk ? <img src={getBlobUrl(myPhotoUrl!)} alt="" className="w-full h-full object-cover" onError={() => setMyPhotoBroken(true)} /> : initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{session?.user?.name ?? '—'}</p>
                      <p className="text-[10px] text-slate-400 truncate">{session?.user?.email ?? '—'}</p>
                      <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-wide mt-1 inline-block">
                        {role ?? 'faculty'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* School info (teacher only) */}
                {role === 'teacher' && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1.5">Current School</p>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <p className="text-xs font-semibold text-slate-700 truncate">
                        {schoolName ?? (currentSchoolId ? 'Loading…' : 'No school joined')}
                      </p>
                    </div>
                    <button
                      onClick={openJoinModal}
                      className="mt-2.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-1.5 transition-colors border border-indigo-100"
                    >
                      <LogIn className="w-3 h-3" />
                      {currentSchoolId ? 'Switch School' : 'Join a School'}
                    </button>
                    <button
                      onClick={openMyProfile}
                      className="mt-1.5 w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-600 hover:text-slate-800 bg-slate-50 hover:bg-slate-100 rounded-lg py-1.5 transition-colors border border-slate-200"
                    >
                      <User className="w-3 h-3" />
                      My Profile
                    </button>
                  </div>
                )}

                {/* Profile picture (management — no faculty record for a photo) */}
                {role === 'management' && (
                  <div className="px-4 py-3 border-b border-slate-100">
                    <button
                      onClick={openEditPhoto}
                      className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg py-1.5 transition-colors border border-indigo-100"
                    >
                      <Camera className="w-3 h-3" />
                      {myPhotoUrl ? 'Change Profile Picture' : 'Add Profile Picture'}
                    </button>
                  </div>
                )}

                {/* Close */}
                <div className="px-4 py-2.5">
                  <button
                    onClick={() => setShowProfileMenu(false)}
                    className="w-full text-[11px] font-semibold text-slate-500 hover:text-slate-700 text-center py-1 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ─── Join / Switch School Modal (teacher only) ─── */}
      <AnimatePresence>
        {showJoinSchool && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden"
            >
              <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {currentSchoolId ? 'Switch School' : 'Join a School'}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Enter the school invite code provided by your administration</p>
                </div>
                <button onClick={() => setShowJoinSchool(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {joinSuccess ? (
                <div className="px-6 py-8 flex flex-col items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="w-6 h-6 text-emerald-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Joined {schoolName}!</p>
                  <p className="text-xs text-slate-400 text-center">Refreshing your session…</p>
                </div>
              ) : (
                <form onSubmit={handleJoinSchool} className="px-6 py-5 space-y-4">
                  {/* Current school info */}
                  {currentSchoolId && schoolName && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Currently In</p>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <p className="text-xs font-semibold text-slate-700 truncate">{schoolName}</p>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest block mb-1.5">
                      School Invite Code
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={joinCode}
                        onChange={e => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
                        placeholder="e.g. GGLD-XNYM"
                        maxLength={9}
                        className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-800 tracking-widest placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all uppercase"
                        autoFocus
                      />
                    </div>
                    {joinError && (
                      <p className="mt-1.5 text-[11px] font-semibold text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 shrink-0" /> {joinError}
                      </p>
                    )}
                  </div>

                  {currentSchoolId && (
                    <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
                      Entering a new code will switch you to the new school. Your existing school access will be removed.
                    </p>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowJoinSchool(false)}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={joining || !joinCode.trim()}
                      className="flex-1 py-2.5 bg-[#002045] hover:bg-[#1a365d] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      {joining ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Joining…</> : currentSchoolId ? 'Switch School' : 'Join School'}
                    </button>
                  </div>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── My Profile Modal (teacher faculty record, editable) ─── */}
      <MyProfileModal isOpen={showMyProfile} onClose={() => setShowMyProfile(false)} onSaved={(profile) => setTeacherPhotoUrl(profile.profileImgUrl || null)} />

      {/* ─── Edit Profile Picture Modal (management) ─── */}
      <AnimatePresence>
        {showEditPhoto && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 overflow-hidden"
            >
              <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Profile Picture</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">Paste a link to an image hosted online</p>
                </div>
                <button onClick={() => setShowEditPhoto(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <form onSubmit={handleSavePhoto} className="px-6 py-5 space-y-4">
                <div className="flex justify-center">
                  <div className="w-20 h-20 rounded-full bg-[#002045] flex items-center justify-center text-white text-xl font-bold overflow-hidden ring-2 ring-slate-100">
                    {photoUrlInput.trim() ? (
                      <img src={getBlobUrl(photoUrlInput.trim())} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                    ) : initials}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Image URL or File</label>
                    <label className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer flex items-center gap-1">
                      {uploadingBlob ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                      {uploadingBlob ? 'Uploading...' : 'Upload File'}
                      <input type="file" accept="image/*" onChange={handlePhotoFileChange} className="hidden" disabled={uploadingBlob} />
                    </label>
                  </div>
                  <input
                    value={photoUrlInput}
                    onChange={e => { setPhotoUrlInput(e.target.value); setPhotoError(null) }}
                    placeholder="https://… or click Upload File"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all"
                  />
                  {photoError && (
                    <p className="mt-1.5 text-[11px] font-semibold text-red-500 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 shrink-0" /> {photoError}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  {myPhotoUrl && (
                    <button type="button" onClick={() => setPhotoUrlInput('')}
                      className="flex-1 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors">
                      Remove
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={savingPhoto}
                    className="flex-1 py-2.5 bg-[#002045] hover:bg-[#1a365d] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {savingPhoto ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Photo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Help Center Modal ─── */}
      <AnimatePresence>
        {showHelp && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-base font-bold text-slate-900">EduAdmin Pro Help Center</h3>
                </div>
                <button onClick={() => setShowHelp(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#002045] uppercase tracking-wider mb-2">
                    <BookOpen className="w-4 h-4 text-[#002045]" /> Academic planning & curriculum
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Track syllabus coverage on the <strong>Academic Planning</strong> board: pick a batch and subject to see its chapters sorted into Not Started, In Progress, and Completed columns. Click a chapter to edit its details or update its status, or use Add Chapter to create a new one — changes sync instantly between faculty and admin.
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 uppercase tracking-wider mb-2">
                    <Calendar className="w-4 h-4 text-indigo-500" /> Uploading student reports
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    To upload grades, go to the <strong>Student Reports</strong> tab. Drag-and-drop or select an Excel/CSV file matching the standard format. Specify the Class, Subject, and Academic Term before uploading.
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 uppercase tracking-wider mb-2">
                    <Info className="w-4 h-4 text-emerald-500" /> Performance analytics & graphs
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The <strong>Students</strong> dashboard provides deep analytics: subject-specific proficiency, overall ranks, attendance rates, and multi-term performance trends.
                  </p>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-600 uppercase tracking-wider mb-2">
                    <Mail className="w-4 h-4 text-amber-500" /> Support & IT Contact
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    For technical problems, access key malfunctions, or role updates, email:
                    <a 
                      href="https://mail.google.com/mail/?view=cm&fs=1&to=academicplanningsystem@gmail.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="font-bold text-blue-600 hover:text-blue-700 transition ml-1 block mt-1 hover:underline cursor-pointer"
                    >
                      academicplanningsystem@gmail.com
                    </a>
                  </p>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 shrink-0 text-center">
                <button onClick={() => setShowHelp(false)} className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-indigo-100">
                  Close Help Center
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Settings / Preferences Modal ─── */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-md border border-slate-100 overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-base font-bold text-slate-900">Account Preferences</h3>
                </div>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-50 transition-all">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="py-4 space-y-4">
                {session && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow overflow-hidden">
                      {myPhotoOk ? <img src={getBlobUrl(myPhotoUrl!)} alt="" className="w-full h-full object-cover" onError={() => setMyPhotoBroken(true)} /> : initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{session.user?.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{session.user?.email}</p>
                      <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        {role}
                      </span>
                    </div>
                  </div>
                )}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Notification Options</h4>
                  <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Email Notifications</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Receive reports digest via email</p>
                    </div>
                    <button onClick={() => setPrefEmail(!prefEmail)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${prefEmail ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${prefEmail ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Syllabus Updates</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Alerts for syllabus coverage changes</p>
                    </div>
                    <button onClick={() => setPrefSyllabusNotify(!prefSyllabusNotify)} className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${prefSyllabusNotify ? 'bg-indigo-500' : 'bg-slate-300'}`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${prefSyllabusNotify ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="pt-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Accent Theme</h4>
                    <div className="flex gap-2">
                      {[
                        { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500' },
                        { id: 'blue', name: 'Blue', bg: 'bg-blue-500' },
                        { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500' },
                        { id: 'slate', name: 'Slate', bg: 'bg-slate-800' },
                      ].map(t => (
                        <button key={t.id} onClick={() => setPrefTheme(t.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${prefTheme === t.id ? 'bg-slate-900 border-slate-900 text-white shadow' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
                          <span className={`w-2 h-2 rounded-full ${t.bg}`} />{t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 text-center">
                <button onClick={savePreferences} disabled={showSaveSuccess}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-85 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-indigo-100 flex items-center justify-center gap-1.5 mx-auto">
                  {showSaveSuccess ? <><Check className="w-4 h-4 text-emerald-400" /> Preferences Saved!</> : 'Save Preferences'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.header>
  )
}
