'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Home, ArrowLeft } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-12">
        <div className="text-[180px] font-black text-indigo-50 leading-none select-none">404</div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Lost in Academic Space?</h1>
          <p className="text-gray-500 max-w-sm mx-auto">
            The page you are looking for doesn't exist or has been moved to another department.
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <Link href="/">
          <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95">
            <Home className="w-4 h-4" /> Go Home
          </button>
        </Link>
        <Link href="/management">
          <button className="flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 px-8 py-3 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </Link>
      </div>

      <div className="mt-16 pt-8 border-t border-gray-100 w-full max-w-md">
        <p className="text-xs text-gray-400">
          If you believe this is a technical error, please contact the IT support department.
        </p>
      </div>
    </div>
  )
}
