'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check, Plus, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const BOARDS = [
  'CBSE Affiliated',
  'ICSE Affiliated',
  'State Board',
  'IB',
  'IGCSE'
]

const STANDARD_PROGRAMS = [
  'JEE',
  'NEET',
  'Foundational'
]

export function SelectBoard({
  value,
  onChange,
  className = ''
}: {
  value: string
  onChange: (val: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [customVal, setCustomVal] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(!BOARDS.includes(value) && value !== '')
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 280 && rect.top > spaceBelow) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (board: string) => {
    setShowCustomInput(false)
    onChange(board)
    setIsOpen(false)
  }

  const submitCustom = () => {
    if (customVal.trim()) {
      onChange(customVal.trim())
      setIsOpen(false)
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 flex items-center justify-between w-full px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm cursor-pointer hover:border-slate-300 transition-all focus:outline-none focus:ring-2 focus:ring-slate-900"
      >
        <span className={value ? 'text-slate-800' : 'text-slate-400'}>
          {value || 'Select Board Affiliation'}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: openUpward ? -4 : 4 }}
            className={`absolute z-[60] w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto ${
              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {BOARDS.map((board) => (
              <button
                key={board}
                type="button"
                onClick={() => handleSelect(board)}
                className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span>{board}</span>
                {value === board && <Check className="w-4 h-4 text-indigo-600" />}
              </button>
            ))}
            
            <div className="border-t border-slate-100 my-1" />
            
            {!showCustomInput ? (
              <button
                type="button"
                onClick={() => {
                  setShowCustomInput(true)
                  setCustomVal(BOARDS.includes(value) ? '' : value)
                }}
                className="w-full px-3 py-2 text-left text-sm text-indigo-600 font-medium hover:bg-indigo-50/50 transition-colors"
              >
                + Custom Board...
              </button>
            ) : (
              <div className="px-3 py-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={customVal}
                  onChange={(e) => setCustomVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      e.stopPropagation()
                      submitCustom()
                    }
                  }}
                  placeholder="Type board name..."
                  autoFocus
                  className="flex-1 min-w-0 px-2.5 py-1 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                />
                <button
                  type="button"
                  onClick={submitCustom}
                  disabled={!customVal.trim()}
                  className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function MultiSelectPrograms({
  value,
  onChange,
  className = ''
}: {
  value: string
  onChange: (val: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [customVal, setCustomVal] = useState('')
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 280 && rect.top > spaceBelow) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []

  const handleToggle = (program: string) => {
    let next: string[]
    if (selected.includes(program)) {
      next = selected.filter((p) => p !== program)
    } else {
      next = [...selected, program]
    }
    onChange(next.join(', '))
  }

  const submitCustom = () => {
    const trimmed = customVal.trim()
    if (trimmed && !selected.includes(trimmed)) {
      const next = [...selected, trimmed]
      onChange(next.join(', '))
      setCustomVal('')
    }
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 flex flex-wrap items-center gap-1.5 w-full min-h-[38px] px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer hover:border-slate-300 transition-all focus-within:ring-2 focus-within:ring-slate-900"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400 my-0.5">Select programs...</span>
        ) : (
          <div className="flex flex-wrap gap-1">
            {selected.map((p) => (
              <span
                key={p}
                className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-750 text-xs font-semibold rounded-full"
              >
                {p}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggle(p)
                  }}
                  className="hover:bg-indigo-100 p-0.5 rounded-full transition-colors text-indigo-500 hover:text-indigo-700"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="ml-auto flex items-center shrink-0 pl-1.5">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: openUpward ? -4 : 4 }}
            className={`absolute z-[60] w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto ${
              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            {/* Standard Programs */}
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Standard Programs
            </div>
            {STANDARD_PROGRAMS.map((program) => {
              const active = selected.includes(program)
              return (
                <button
                  key={program}
                  type="button"
                  onClick={() => handleToggle(program)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>{program}</span>
                  {active && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              )
            })}

            {/* Custom Programs already added that aren't in STANDARD_PROGRAMS */}
            {selected.filter(p => !STANDARD_PROGRAMS.includes(p)).length > 0 && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Custom Programs
                </div>
                {selected
                  .filter((p) => !STANDARD_PROGRAMS.includes(p))
                  .map((program) => (
                    <button
                      key={program}
                      type="button"
                      onClick={() => handleToggle(program)}
                      className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      <span>{program}</span>
                      <Check className="w-4 h-4 text-indigo-600" />
                    </button>
                  ))}
              </>
            )}

            <div className="border-t border-slate-100 my-1" />
            
            {/* Add Custom Program */}
            <div className="px-3 py-2 flex items-center gap-1.5">
              <input
                type="text"
                value={customVal}
                onChange={(e) => setCustomVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.stopPropagation()
                    submitCustom()
                  }
                }}
                placeholder="Add custom program..."
                className="flex-1 min-w-0 px-2.5 py-1 border border-slate-200 rounded-md text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
              />
              <button
                type="button"
                onClick={submitCustom}
                disabled={!customVal.trim()}
                className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-bold rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-1 shrink-0"
              >
                <Plus className="w-3 h-3" /> Add
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const CLASS_OPTIONS = ['6', '7', '8', '9', '10', '11', '12', '12 pass']

export function formatClasses(value: string): string {
  if (!value) return ''
  const selected = value.split(',').map(s => s.trim()).filter(Boolean)
  
  const nums: number[] = []
  const nonNums: string[] = []
  
  selected.forEach(item => {
    const lower = item.toLowerCase()
    const n = parseInt(item, 10)
    if (!isNaN(n) && (item === n.toString() || lower === `${n}th` || lower === `${n}th pass` || lower === `${n} pass`)) {
      if (lower.includes('pass')) {
        nonNums.push('12 pass')
      } else {
        nums.push(n)
      }
    } else {
      nonNums.push(item)
    }
  })
  
  const uniqueNums = Array.from(new Set(nums)).sort((a, b) => a - b)
  const uniqueNonNums = Array.from(new Set(nonNums))
  
  const parts: string[] = []
  
  let i = 0
  while (i < uniqueNums.length) {
    let start = uniqueNums[i]
    let end = start
    while (i + 1 < uniqueNums.length && uniqueNums[i + 1] === uniqueNums[i] + 1) {
      end = uniqueNums[i + 1]
      i++
    }
    
    if (start === end) {
      parts.push(`${start}th`)
    } else {
      parts.push(`${start}th - ${end}th`)
    }
    i++
  }
  
  uniqueNonNums.forEach(item => {
    if (item.toLowerCase() === '12 pass') {
      parts.push('12th Pass')
    } else {
      parts.push(item)
    }
  })
  
  return parts.join(', ')
}

export function MultiSelectClasses({
  value,
  onChange,
  className = ''
}: {
  value: string
  onChange: (val: string) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [openUpward, setOpenUpward] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      if (spaceBelow < 280 && rect.top > spaceBelow) {
        setOpenUpward(true)
      } else {
        setOpenUpward(false)
      }
    }
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selected = value ? value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : []

  const handleToggle = (opt: string) => {
    const optLower = opt.toLowerCase()
    let next: string[]
    
    if (selected.includes(optLower)) {
      next = selected.filter((p) => p !== optLower)
    } else {
      next = [...selected, optLower]
    }
    
    next.sort((a, b) => {
      return CLASS_OPTIONS.indexOf(a) - CLASS_OPTIONS.indexOf(b)
    })

    const mapped = next.map(val => {
      const found = CLASS_OPTIONS.find(o => o.toLowerCase() === val)
      return found || val
    })

    onChange(mapped.join(', '))
  }

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="mt-1 flex flex-wrap items-center gap-1.5 w-full min-h-[38px] px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white cursor-pointer hover:border-slate-300 transition-all focus-within:ring-2 focus-within:ring-slate-900"
      >
        {selected.length === 0 ? (
          <span className="text-slate-400 my-0.5">Select classes...</span>
        ) : (
          <div className="flex-1 text-slate-800 font-medium py-0.5">
            {formatClasses(value)}
          </div>
        )}
        <div className="ml-auto flex items-center shrink-0 pl-1.5">
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: openUpward ? -4 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: openUpward ? -4 : 4 }}
            className={`absolute z-[60] w-full bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden py-1 max-h-60 overflow-y-auto ${
              openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            }`}
          >
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Classes Offered
            </div>
            {CLASS_OPTIONS.map((opt) => {
              const active = selected.includes(opt.toLowerCase())
              const displayLabel = opt === '12 pass' ? '12th Pass' : `${opt}th`
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleToggle(opt)}
                  className="flex items-center justify-between w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <span>{displayLabel}</span>
                  {active && <Check className="w-4 h-4 text-indigo-600" />}
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
