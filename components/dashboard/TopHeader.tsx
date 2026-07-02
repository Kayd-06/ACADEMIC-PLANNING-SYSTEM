'use client'
import { useState, useEffect } from 'react'
import { HelpCircle, Settings, X, CheckCircle, AlertCircle, BookOpen, Calendar, Mail, User, Shield, Info, Check, Globe } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface UserSession {
  user: {
    id: string
    name: string
    email: string
    role: string
  }
}

const applyTheme = (themeName: string) => {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  const themes = {
    indigo: {
      primary: '#6366f1',
      hover: '#4f46e5',
      light: '#f5f7ff',
      rgb: '99, 102, 241'
    },
    blue: {
      primary: '#002045',
      hover: '#1a365d',
      light: '#eff6ff',
      rgb: '0, 32, 69'
    },
    emerald: {
      primary: '#10b981',
      hover: '#059669',
      light: '#ecfdf5',
      rgb: '16, 185, 129'
    },
    slate: {
      primary: '#475569',
      hover: '#334155',
      light: '#f1f5f9',
      rgb: '71, 85, 105'
    }
  }

  const selected = themes[themeName as keyof typeof themes] || themes.blue
  root.style.setProperty('--accent-primary', selected.primary)
  root.style.setProperty('--accent-hover', selected.hover)
  root.style.setProperty('--accent-light', selected.light)
  root.style.setProperty('--accent-primary-rgb', selected.rgb)
}

interface TopHeaderProps {
  initials: string
}

export default function TopHeader({ initials }: TopHeaderProps) {
  const [session, setSession] = useState<UserSession | null>(null)

  // Modals & Popovers
  const [showHelp, setShowHelp] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Settings Mock Preferences
  const [prefEmail, setPrefEmail] = useState(true)
  const [prefTheme, setPrefTheme] = useState('blue')
  const [prefSyllabusNotify, setPrefSyllabusNotify] = useState(true)
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)

  // Fetch Session
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data?.user) {
          setSession(data)

          // Load user settings preferences
          const storedPrefs = localStorage.getItem(`user_preferences_${data.user.email}`)
          if (storedPrefs) {
            try {
              const parsed = JSON.parse(storedPrefs)
              if (parsed.prefEmail !== undefined) setPrefEmail(parsed.prefEmail)
              if (parsed.prefTheme !== undefined) {
                setPrefTheme(parsed.prefTheme)
                applyTheme(parsed.prefTheme)
              }
              if (parsed.prefSyllabusNotify !== undefined) setPrefSyllabusNotify(parsed.prefSyllabusNotify)
            } catch (e) {
              console.error(e)
            }
          } else {
            // Apply default blue theme
            applyTheme('blue')
          }
        }
      })
      .catch(console.error)
  }, [])

  const savePreferences = () => {
    if (session?.user?.email) {
      const prefs = {
        prefEmail,
        prefTheme,
        prefSyllabusNotify
      }
      localStorage.setItem(`user_preferences_${session.user.email}`, JSON.stringify(prefs))
      applyTheme(prefTheme)
    }
    setShowSaveSuccess(true)
    setTimeout(() => {
      setShowSaveSuccess(false)
      setShowSettings(false)
    }, 1200)
  }

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

        {/* 1. Help Button */}
        <button
          onClick={() => setShowHelp(true)}
          className="p-2 rounded-full text-gray-500 hover:text-[#002045] hover:bg-slate-100 transition-colors"
        >
          <HelpCircle className="w-5 h-5" />
        </button>

        {/* 2. Settings Button */}
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-full text-gray-500 hover:text-[#002045] hover:bg-slate-100 transition-colors"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* User initials circle */}
        <div className="w-8 h-8 rounded-full bg-[#002045] flex items-center justify-center text-white text-xs font-semibold ml-2 cursor-pointer hover:bg-[#1a365d] transition-colors relative group">
          {initials}
          {session && (
            <div className="absolute right-0 top-10 w-44 bg-white border border-slate-200 rounded-xl shadow-lg p-2.5 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 text-left">
              <p className="text-xs font-bold text-slate-800 truncate">{session.user.name}</p>
              <p className="text-[10px] font-medium text-slate-400 truncate mt-0.5">{session.user.email}</p>
              <div className="border-t border-slate-100 mt-2 pt-2">
                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 uppercase tracking-wider">
                  {session.user.role}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

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
                {/* 1. Academic Planning */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-[#002045] uppercase tracking-wider mb-2">
                    <BookOpen className="w-4 h-4 text-[#002045]" />
                    Academic planning & curriculum
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    View active course structures, required syllabus modules, and program guidelines set by the Academic Administration. Teachers can mark weekly syllabus progress directly on their course cards to verify curriculum alignment.
                  </p>
                </div>

                {/* 2. Uploading Student Reports */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-indigo-600 uppercase tracking-wider mb-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    Uploading student reports
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    To upload grades, go to the <strong>Student Reports</strong> tab. Drag-and-drop or select an Excel/CSV file matching the standard format. Specify the Class, Subject, and Academic Term before uploading.
                  </p>
                </div>

                {/* 3. Real-Time Performance Analytics */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-600 uppercase tracking-wider mb-2">
                    <Info className="w-4 h-4 text-emerald-500" />
                    Performance analytics & graphs
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    The <strong>Students</strong> dashboard provides deep analytics: subject-specific proficiency, overall ranks, attendance rates, and multi-term performance trends. Use the Class selector and Student select dropdown to switch details dynamically.
                  </p>
                </div>

                {/* 4. Support Contacts */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-amber-600 uppercase tracking-wider mb-2">
                    <Mail className="w-4 h-4 text-amber-500" />
                    Support & IT Contact
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    For technical problems, access key malfunctions, or role updates, email:
                    <span className="font-bold text-slate-700 ml-1 block mt-1">support-it@eduadminpro.ac.in</span>
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 shrink-0 text-center">
                <button
                  onClick={() => setShowHelp(false)}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-indigo-100"
                >
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
                {/* Profile section */}
                {session && (
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-sm shadow">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate">{session.user.name}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate">{session.user.email}</p>
                      <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wide bg-indigo-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">
                        {session.user.role}
                      </span>
                    </div>
                  </div>
                )}

                {/* Preference Toggles */}
                <div className="space-y-3">
                  <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Notification Options</h4>

                  {/* Email Toggle */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Email Notifications</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Receive reports digest via email</p>
                    </div>
                    <button
                      onClick={() => setPrefEmail(!prefEmail)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${prefEmail ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${prefEmail ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>

                  {/* Syllabus notify */}
                  <div className="flex items-center justify-between bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Syllabus Updates</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Alerts for syllabus coverage changes</p>
                    </div>
                    <button
                      onClick={() => setPrefSyllabusNotify(!prefSyllabusNotify)}
                      className={`w-9 h-5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${prefSyllabusNotify ? 'bg-indigo-500' : 'bg-slate-300'
                        }`}
                    >
                      <div className={`w-4 h-4 bg-white rounded-full shadow transform transition-transform duration-200 ${prefSyllabusNotify ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                    </button>
                  </div>

                  {/* Theme Accent selector */}
                  <div className="pt-2">
                    <h4 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">Accent Theme</h4>
                    <div className="flex gap-2">
                      {[
                        { id: 'indigo', name: 'Indigo', bg: 'bg-indigo-500', border: 'border-indigo-200' },
                        { id: 'blue', name: 'Blue', bg: 'bg-blue-500', border: 'border-blue-200' },
                        { id: 'emerald', name: 'Emerald', bg: 'bg-emerald-500', border: 'border-emerald-200' },
                        { id: 'slate', name: 'Slate', bg: 'bg-slate-800', border: 'border-slate-300' },
                      ].map(t => (
                        <button
                          key={t.id}
                          onClick={() => setPrefTheme(t.id)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg border text-[11px] font-bold transition-all ${prefTheme === t.id
                            ? 'bg-slate-900 border-slate-900 text-white shadow'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                        >
                          <span className={`w-2 h-2 rounded-full ${t.bg}`} />
                          {t.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 text-center">
                <button
                  onClick={savePreferences}
                  disabled={showSaveSuccess}
                  className="px-6 py-2 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-85 text-white rounded-lg text-xs font-bold transition-all shadow-sm shadow-indigo-100 flex items-center justify-center gap-1.5 mx-auto"
                >
                  {showSaveSuccess ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" /> Preferences Saved!
                    </>
                  ) : (
                    'Save Preferences'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.header>
  )
}
