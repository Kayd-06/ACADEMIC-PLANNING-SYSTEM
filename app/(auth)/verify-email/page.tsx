'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import Link from 'next/link'

type Status = 'loading' | 'success' | 'error'

function VerifyContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<Status>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setStatus('error')
      setMessage('No verification token found.')
      return
    }

    fetch(`/api/auth/verify-email?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.message) {
          setStatus('success')
          setMessage(data.message)
          setTimeout(() => router.push('/login'), 3000)
        } else {
          setStatus('error')
          setMessage(data.error || 'Verification failed.')
        }
      })
      .catch(() => {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
      })
  }, [searchParams, router])

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className="w-full max-w-xs"
    >
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
        {status === 'loading' && (
          <>
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"
            />
            <p className="text-gray-700 text-sm font-medium">Verifying your email</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Email verified</p>
            <p className="text-gray-500 text-xs mt-1">Redirecting to sign in…</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Verification failed</p>
            <p className="text-gray-500 text-xs mt-1">{message}</p>
            <Link
              href="/signup/teacher"
              className="inline-block mt-4 text-xs text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Try signing up again
            </Link>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyContent />
    </Suspense>
  )
}
