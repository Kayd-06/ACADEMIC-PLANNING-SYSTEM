'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  X, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle, 
  Trash2, 
  Calendar, 
  BookOpen, 
  UserX,
  Info
} from 'lucide-react'

export type AlertIconType = 'card' | 'warning' | 'success' | 'trash' | 'calendar' | 'book' | 'user-x' | 'info'

export interface ShowAlertOptions {
  title: string
  message: string
  type?: AlertIconType
  onRetry?: () => void | Promise<void>
  onCancel?: () => void
  retryText?: string
  cancelText?: string
}

interface AlertContextProps {
  showAlert: (options: ShowAlertOptions) => void
  hideAlert: () => void
}

const AlertContext = createContext<AlertContextProps | undefined>(undefined)

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alert, setAlert] = useState<ShowAlertOptions | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const showAlert = useCallback((options: ShowAlertOptions) => {
    setAlert(options)
    setIsOpen(true)
  }, [])

  const hideAlert = useCallback(() => {
    setIsOpen(false)
    if (alert?.onCancel) {
      alert.onCancel()
    }
  }, [alert])

  const handleRetry = useCallback(async () => {
    if (alert?.onRetry) {
      setIsOpen(false)
      // Call the retry handler
      await alert.onRetry()
    }
  }, [alert])

  const renderIcon = (type?: AlertIconType) => {
    const iconClass = "w-7 h-7 text-[#1a1b21]"
    switch (type) {
      case 'card':
        return <CreditCard className={iconClass} />
      case 'trash':
        return <Trash2 className="w-7 h-7 text-red-600" />
      case 'success':
        return <CheckCircle className="w-7 h-7 text-green-600" />
      case 'calendar':
        return <Calendar className={iconClass} />
      case 'book':
        return <BookOpen className={iconClass} />
      case 'user-x':
        return <UserX className="w-7 h-7 text-red-600" />
      case 'warning':
      default:
        return <AlertTriangle className="w-7 h-7 text-amber-500" />
    }
  }

  const getIconContainerClass = (type?: AlertIconType) => {
    const base = "w-16 h-12 rounded-xl flex items-center justify-center mb-6"
    switch (type) {
      case 'trash':
      case 'user-x':
        return `${base} border-2 border-red-200 bg-red-50`
      case 'success':
        return `${base} border-2 border-green-200 bg-green-50`
      case 'warning':
        return `${base} border-2 border-amber-200 bg-amber-50`
      case 'card':
      default:
        return `${base} border-2 border-[#1a1b21] bg-white`
    }
  }

  return (
    <AlertContext.Provider value={{ showAlert, hideAlert }}>
      {children}
      <AnimatePresence>
        {isOpen && alert && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={hideAlert}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-[400px] bg-white rounded-[28px] p-8 shadow-2xl flex flex-col items-center z-10 border border-gray-100"
            >
              {/* Close Button */}
              <button
                onClick={hideAlert}
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-50 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Icon */}
              <div className={getIconContainerClass(alert.type)}>
                {renderIcon(alert.type)}
              </div>

              {/* Title */}
              <h3 className="text-[20px] font-bold text-gray-900 text-center px-1 leading-snug">
                {alert.title}
              </h3>

              {/* Description */}
              <p className="text-[14px] text-gray-500 mt-2 text-center leading-relaxed px-2">
                {alert.message}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-3 w-full mt-8">
                {alert.onRetry ? (
                  <>
                    <button
                      onClick={hideAlert}
                      className="flex-1 py-3 px-6 bg-[#f3f4f6] hover:bg-[#e5e7eb] text-gray-900 font-semibold rounded-2xl transition-colors text-[14px] text-center cursor-pointer"
                    >
                      {alert.cancelText || 'Cancel'}
                    </button>
                    <button
                      onClick={handleRetry}
                      className="flex-1 py-3 px-6 bg-[#1a1b21] hover:bg-[#2e2f36] text-white font-semibold rounded-2xl transition-colors text-[14px] text-center cursor-pointer"
                    >
                      {alert.retryText || 'Retry'}
                    </button>
                  </>
                ) : (
                  <button
                    onClick={hideAlert}
                    className="w-full py-3 px-6 bg-[#1a1b21] hover:bg-[#2e2f36] text-white font-semibold rounded-2xl transition-colors text-[14px] text-center cursor-pointer"
                  >
                    {alert.cancelText || 'Close'}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider')
  }
  return context
}
