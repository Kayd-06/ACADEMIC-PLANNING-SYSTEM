'use client'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Mail, MessageCircle, ChevronLeft, User } from 'lucide-react'

type Guardian = {
  id: string
  name: string
  relationship?: string
  isPrimary?: boolean
  email?: string | null
  phone?: string | null
}

function normalizeWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // Bare 10-digit numbers are stored without a country code — assume India (+91).
  return digits.length === 10 ? `91${digits}` : digits
}

export default function MessageParentModal({ guardians, studentName, onClose }: {
  guardians: Guardian[]
  studentName: string
  onClose: () => void
}) {
  const [selected, setSelected] = useState<Guardian | null>(guardians.length === 1 ? guardians[0] : null)

  function contact(guardian: Guardian, channel: 'email' | 'whatsapp') {
    if (channel === 'email' && guardian.email) {
      window.location.href = `mailto:${guardian.email}?subject=${encodeURIComponent(`Regarding ${studentName}`)}`
    } else if (channel === 'whatsapp' && guardian.phone) {
      window.open(`https://wa.me/${normalizeWhatsAppNumber(guardian.phone)}`, '_blank', 'noopener,noreferrer')
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {selected && guardians.length > 1 && (
              <button onClick={() => setSelected(null)} className="p-1 -ml-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-base font-bold text-slate-900">
              {selected ? `Message ${selected.name}` : 'Select Guardian'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {!selected ? (
          <div className="p-3 max-h-80 overflow-y-auto">
            {guardians.map(g => (
              <button key={g.id} onClick={() => setSelected(g)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors text-left">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900 truncate">{g.name}</span>
                    {g.isPrimary && (
                      <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 shrink-0">Primary</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">{g.relationship || 'Guardian'}</p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="p-5 space-y-2.5">
            <button
              onClick={() => contact(selected, 'email')}
              disabled={!selected.email}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Email</p>
                <p className="text-[11px] text-slate-400 truncate">{selected.email || 'No email on file'}</p>
              </div>
            </button>
            <button
              onClick={() => contact(selected, 'whatsapp')}
              disabled={!selected.phone}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                <MessageCircle className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">WhatsApp</p>
                <p className="text-[11px] text-slate-400 truncate">{selected.phone || 'No phone on file'}</p>
              </div>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
