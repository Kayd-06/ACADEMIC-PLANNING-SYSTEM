'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { User, Lock, Mail, Building2, ChevronRight, Hash, Eye, EyeOff } from 'lucide-react'

type Mode = 'login' | 'signup'
type SignupStep = 'select' | 'teacher' | 'management'

// ─── Primitives ───────────────────────────────────────────────────────────────

function FieldInput({ icon, className, ...props }: { icon: React.ReactNode } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      <input
        {...props}
        className={`w-full bg-gray-100 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800
                   placeholder-gray-400 focus:outline-none focus:bg-gray-50
                   focus:ring-2 focus:ring-indigo-400/30 transition-all ${className ?? ''}`}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        {icon}
      </span>
    </div>
  )
}

function PasswordInput({ value, onChange, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        className="w-full bg-gray-100 rounded-lg px-4 py-2.5 pr-10 text-sm text-gray-800
                   placeholder-gray-400 focus:outline-none focus:bg-gray-50
                   focus:ring-2 focus:ring-indigo-400/30 transition-all"
      />
      <button
        type="button"
        onClick={() => setVisible(v => !v)}
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  )
}

function PrimaryBtn({ loading, children, ...props }: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.98 }}
      {...(props as any)}
      disabled={loading || props.disabled}
      className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-60 text-white
                 font-semibold py-2.5 rounded-lg transition-colors text-sm cursor-pointer"
    >
      {loading ? 'Please wait…' : children}
    </motion.button>
  )
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <motion.p
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-3"
    >
      {msg}
    </motion.p>
  )
}

// ─── Login form ───────────────────────────────────────────────────────────────

function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // A teacher who signed up but never finished OTP verification (or closed
  // the tab before it) has no other way back to that screen — this lets
  // them resume by re-requesting a code with just their email.
  const [showResume, setShowResume] = useState(false)
  const [resumeStage, setResumeStage] = useState<'email' | 'otp' | 'done'>('email')
  const [resumeEmail, setResumeEmail] = useState('')
  const [resumeOtp, setResumeOtp] = useState('')
  const [resumeError, setResumeError] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (result?.error) {
      if (result.error.includes('EMAIL_NOT_VERIFIED') || result.error === 'EMAIL_NOT_VERIFIED') {
        setError('Your email address is not verified yet. Click "Verify email" below to complete verification.')
        setResumeEmail(email)
      } else {
        setError('Invalid email address or password.')
      }
      return
    }
    const s = await fetch('/api/auth/session').then(r => r.json())
    router.push(s?.user?.role === 'management' ? '/management' : '/teacher')
    router.refresh()
  }

  function closeResume() {
    setShowResume(false)
    setResumeStage('email')
    setResumeOtp('')
    setResumeError('')
  }

  async function sendResumeCode(e: React.FormEvent) {
    e.preventDefault(); setResumeError(''); setResumeLoading(true)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resumeEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setResumeError(data.error || 'Failed to send code.'); return }
      setResumeStage('otp')
      setResendCooldown(30)
    } finally { setResumeLoading(false) }
  }

  async function verifyResumeCode(e: React.FormEvent) {
    e.preventDefault(); setResumeError(''); setResumeLoading(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resumeEmail, otp: resumeOtp }),
      })
      const data = await res.json()
      if (!res.ok) { setResumeError(data.error || 'Verification failed.'); return }
      setResumeStage('done')
    } finally { setResumeLoading(false) }
  }

  async function resendResumeCode() {
    if (resendCooldown > 0) return
    setResumeError(''); setResumeLoading(true)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resumeEmail }),
      })
      const data = await res.json()
      if (!res.ok) { setResumeError(data.error || 'Failed to resend code.'); return }
      setResendCooldown(30)
    } finally { setResumeLoading(false) }
  }

  if (showResume) {
    return (
      <div className="w-full">
        <button onClick={closeResume} className="text-xs text-gray-400 hover:text-gray-600 mb-3 block transition-colors">← Back to login</button>
        <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Verify Email</h2>
        <ErrorMsg msg={resumeError} />
        {resumeStage === 'done' ? (
          <div className="text-center py-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            </div>
            <p className="text-sm font-medium text-gray-800">Email verified</p>
            <p className="text-xs text-gray-400 mt-1">You can sign in now</p>
            <button onClick={closeResume} className="mt-3 text-xs text-indigo-500 hover:text-indigo-600 transition-colors">Back to sign in</button>
          </div>
        ) : resumeStage === 'otp' ? (
          <form onSubmit={verifyResumeCode} className="space-y-2.5">
            <p className="text-xs text-gray-500">
              Enter the 6-digit code sent to <span className="font-semibold text-gray-700">{resumeEmail}</span>
            </p>
            <FieldInput
              icon={<Hash className="w-4 h-4" />} type="text" inputMode="numeric" maxLength={6}
              value={resumeOtp} onChange={e => setResumeOtp(e.target.value.replace(/\D/g, ''))}
              required placeholder="6-digit code"
              className="text-center tracking-[0.5em] font-semibold"
            />
            <div className="pt-1"><PrimaryBtn loading={resumeLoading}>Verify Email</PrimaryBtn></div>
            <button
              type="button" onClick={resendResumeCode} disabled={resumeLoading || resendCooldown > 0}
              className="w-full text-center text-xs text-indigo-500 hover:text-indigo-600 disabled:text-gray-300 transition-colors pt-1"
            >
              {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
            </button>
          </form>
        ) : (
          <form onSubmit={sendResumeCode} className="space-y-2.5">
            <FieldInput icon={<Mail className="w-4 h-4" />} type="email" value={resumeEmail} onChange={e => setResumeEmail(e.target.value)} required placeholder="Your account email" />
            <div className="pt-1"><PrimaryBtn loading={resumeLoading}>Send Verification Code</PrimaryBtn></div>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-6">Login</h2>
      <ErrorMsg msg={error} />
      <form onSubmit={submit} className="space-y-3">
        <FieldInput icon={<User className="w-4 h-4" />} type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="Email" />
        <PasswordInput value={password} onChange={e => setPassword(e.target.value)} required placeholder="Password" />
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => { setResumeEmail(email); setShowResume(true) }} className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
            Verify email
          </button>
          <button type="button" className="text-xs text-gray-400 hover:text-indigo-500 transition-colors">
            Forgot Password?
          </button>
        </div>
        <PrimaryBtn loading={loading}>Login</PrimaryBtn>
      </form>
    </div>
  )
}

// ─── Role select ──────────────────────────────────────────────────────────────

function RoleSelect({ onSelect }: { onSelect: (s: SignupStep) => void }) {
  return (
    <motion.div key="select" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="w-full">
      <h2 className="text-2xl font-bold text-gray-800 text-center mb-1">Create Account</h2>
      <p className="text-xs text-gray-400 text-center mb-6">Select your role to continue</p>
      <div className="space-y-3">
        {[
          { key: 'teacher' as const, label: 'Teacher', desc: 'Institutional email · requires verification', icon: <User className="w-4 h-4" /> },
          { key: 'management' as const, label: 'Administration', desc: 'Staff accounts · invite code required', icon: <Building2 className="w-4 h-4" /> },
        ].map(r => (
          <motion.button key={r.key} whileHover={{ x: 3 }} whileTap={{ scale: 0.99 }} onClick={() => onSelect(r.key)}
            className="w-full flex items-center justify-between bg-gray-100 hover:bg-indigo-50 rounded-lg px-4 py-3 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="text-gray-400 group-hover:text-indigo-500 transition-colors">{r.icon}</span>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">{r.label}</p>
                <p className="text-[11px] text-gray-400">{r.desc}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Teacher signup ───────────────────────────────────────────────────────────

type TeacherStage = 'form' | 'otp' | 'verified'

function TeacherForm({ onBack }: { onBack: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', department: '', joinCode: '' })
  const [error, setError] = useState('')
  const [stage, setStage] = useState<TeacherStage>('form')
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  const [otp, setOtp] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setInterval(() => setResendCooldown(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(t)
  }, [resendCooldown])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const res = await fetch('/api/auth/register/teacher', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'Registration failed.'); return }
    setStage('otp')
    setResendCooldown(30)
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault(); setError(''); setVerifying(true)
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Verification failed.'); return }
      setStage('verified')
    } finally { setVerifying(false) }
  }

  async function resendOtp() {
    if (resendCooldown > 0) return
    setError(''); setResending(true)
    try {
      const res = await fetch('/api/auth/resend-otp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to resend code.'); return }
      setResendCooldown(30)
    } finally { setResending(false) }
  }

  return (
    <motion.div key="teacher" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="w-full">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-3 block transition-colors">← Back</button>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Teacher Sign Up</h2>
      <ErrorMsg msg={error} />
      {stage === 'verified' ? (
        <div className="text-center py-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-800">Email verified</p>
          <p className="text-xs text-gray-400 mt-1">Your account is active — you can sign in now</p>
          <button onClick={onBack} className="mt-3 text-xs text-indigo-500 hover:text-indigo-600 transition-colors">Back to sign in</button>
        </div>
      ) : stage === 'otp' ? (
        <form onSubmit={verifyOtp} className="space-y-2.5">
          <p className="text-xs text-gray-500">
            Enter the 6-digit code sent to <span className="font-semibold text-gray-700">{form.email}</span>
          </p>
          <FieldInput
            icon={<Hash className="w-4 h-4" />} type="text" inputMode="numeric" maxLength={6}
            value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
            required placeholder="6-digit code"
            className="text-center tracking-[0.5em] font-semibold"
          />
          <div className="pt-1"><PrimaryBtn loading={verifying}>Verify Email</PrimaryBtn></div>
          <button
            type="button" onClick={resendOtp} disabled={resending || resendCooldown > 0}
            className="w-full text-center text-xs text-indigo-500 hover:text-indigo-600 disabled:text-gray-300 transition-colors pt-1"
          >
            {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : resending ? 'Sending…' : 'Resend code'}
          </button>
        </form>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <FieldInput icon={<User className="w-4 h-4" />} type="text" value={form.name} onChange={set('name')} required placeholder="Full name" />
          <FieldInput icon={<Mail className="w-4 h-4" />} type="email" value={form.email} onChange={set('email')} required placeholder="Institutional email" />
          <PasswordInput value={form.password} onChange={set('password')} required placeholder="Password (min. 8 chars)" minLength={8} />
          <FieldInput icon={<Building2 className="w-4 h-4" />} type="text" value={form.department} onChange={set('department')} placeholder="Department (optional)" />
          <FieldInput icon={<Hash className="w-4 h-4" />} type="text" value={form.joinCode} onChange={set('joinCode')} placeholder="School join code (e.g. EDUA-4821)" />
          <div className="pt-1"><PrimaryBtn loading={loading}>Create Account</PrimaryBtn></div>
        </form>
      )}
    </motion.div>
  )
}

// ─── Management signup ────────────────────────────────────────────────────────

function ManagementForm({ onBack, onSuccess }: { onBack: () => void, onSuccess: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', employeeId: '', inviteCode: '' })
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true)
    const res = await fetch('/api/auth/register/management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json(); setLoading(false)
    if (!res.ok) { setError(data.error || 'Registration failed.'); return }
    setDone(true)
    setTimeout(() => {
      onSuccess()
    }, 2000)
  }

  return (
    <motion.div key="mgmt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="w-full">
      <button onClick={onBack} className="text-xs text-gray-400 hover:text-gray-600 mb-3 block transition-colors">← Back</button>
      <h2 className="text-xl font-bold text-gray-800 mb-4">Administration Sign Up</h2>
      <ErrorMsg msg={error} />
      {done ? (
        <div className="text-center py-3">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <p className="text-sm font-medium text-gray-800">Account Created Successfully!</p>
          <p className="text-xs text-gray-400 mt-1">Redirecting to login page...</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-2.5">
          <FieldInput icon={<User className="w-4 h-4" />} type="text" value={form.name} onChange={set('name')} required placeholder="Full name" />
          <FieldInput icon={<Mail className="w-4 h-4" />} type="email" value={form.email} onChange={set('email')} required placeholder="Email" />
          <PasswordInput value={form.password} onChange={set('password')} required placeholder="Password (min. 8 chars)" minLength={8} />
          <FieldInput icon={<Building2 className="w-4 h-4" />} type="text" value={form.employeeId} onChange={set('employeeId')} placeholder="Employee ID (optional)" />
          <FieldInput icon={<Lock className="w-4 h-4" />} type="text" value={form.inviteCode} onChange={set('inviteCode')} required placeholder="Admin invite code" />
          <p className="text-[11px] text-gray-400 px-0.5">You'll create or join your school right after signing in.</p>
          <div className="pt-1"><PrimaryBtn loading={loading}>Create Account</PrimaryBtn></div>
        </form>
      )}
    </motion.div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [step, setStep] = useState<SignupStep>('select')

  return (
    <div className="min-h-screen gradient-mesh flex items-center justify-center p-6 font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-4xl h-[600px] bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] overflow-hidden flex border border-white/50"
      >

        {/* Left half — signup forms */}
        <div className="w-1/2 flex items-center justify-center px-12 py-10 z-10">
          <AnimatePresence mode="wait">
            {step === 'select'     && <RoleSelect      key="select"  onSelect={s => setStep(s)} />}
            {step === 'teacher'    && <TeacherForm     key="teacher" onBack={() => setStep('select')} />}
            {step === 'management' && <ManagementForm  key="mgmt"    onBack={() => setStep('select')} onSuccess={() => { setMode('login'); setStep('select') }} />}
          </AnimatePresence>
        </div>

        {/* Right half — login form */}
        <div className="w-1/2 flex items-center justify-center px-12 py-10 z-10">
          <LoginForm />
        </div>

        {/* Sliding indigo panel */}
        <motion.div
          className="absolute top-0 left-0 w-1/2 h-full z-20 flex flex-col items-center justify-center px-12 text-white shadow-2xl"
          style={{ 
            background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
          }}
          animate={{
            x: mode === 'login' ? '0%' : '100%',
            borderRadius: mode === 'login' ? '0 80px 80px 0' : '80px 0 0 80px',
          }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
        >
          <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
            <div className="absolute -top-24 -left-24 w-64 h-64 bg-white rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-400 rounded-full blur-3xl" />
          </div>

          <AnimatePresence mode="wait">
            {mode === 'login' ? (
              <motion.div key="panel-l" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.3 }} className="text-center relative z-10">
                <h2 className="text-4xl font-extrabold mb-4 tracking-tight">New Here?</h2>
                <p className="text-indigo-100 text-base mb-10 font-medium leading-relaxed">
                  Join the most advanced academic <br/> planning ecosystem today.
                </p>
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: '0 10px 20px -5px rgba(0,0,0,0.2)' }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => { setStep('select'); setMode('signup') }}
                  className="bg-white/10 backdrop-blur-md border border-white/30 text-white font-bold px-10 py-3.5 rounded-xl hover:bg-white hover:text-indigo-600 transition-all text-sm uppercase tracking-wider"
                >
                  Create Account
                </motion.button>
              </motion.div>
            ) : (
              <motion.div key="panel-r" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="text-center relative z-10">
                <h2 className="text-4xl font-extrabold mb-4 tracking-tight">Welcome Back!</h2>
                <p className="text-indigo-100 text-base mb-10 font-medium leading-relaxed">
                  To stay connected with your <br/> institution, please login.
                </p>
                <motion.button 
                  whileHover={{ scale: 1.05, boxShadow: '0 10px 20px -5px rgba(0,0,0,0.2)' }} 
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setMode('login')}
                  className="bg-white/10 backdrop-blur-md border border-white/30 text-white font-bold px-10 py-3.5 rounded-xl hover:bg-white hover:text-indigo-600 transition-all text-sm uppercase tracking-wider"
                >
                  Sign In
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  )
}
