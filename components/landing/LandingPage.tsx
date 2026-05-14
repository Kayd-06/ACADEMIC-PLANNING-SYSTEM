'use client'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { GraduationCap, ArrowRight, ShieldCheck, Users, BookOpen, Sparkles } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, type: 'spring' as const, stiffness: 260, damping: 25 },
})

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900 selection:bg-indigo-100 overflow-x-hidden">
      {/* Background Decor */}
      <div className="absolute top-0 inset-x-0 h-[600px] bg-gradient-to-b from-indigo-50/50 to-transparent -z-10 pointer-events-none" />
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-200/20 blur-[120px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-violet-200/20 blur-[120px] -z-10 pointer-events-none" />

      {/* Nav */}
      <nav className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2.5"
        >
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight">EduAdmin Pro</span>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-6"
        >
          <Link href="/login" className="text-sm font-semibold hover:text-indigo-600 transition-colors">Sign In</Link>
          <Link href="/login">
            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-indigo-100 transition-all hover:scale-105 active:scale-95 flex items-center gap-2">
              Get Started <ArrowRight className="w-4 h-4" />
            </button>
          </Link>
        </motion.div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-6 pt-24 pb-32">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div 
            {...fadeUp(0)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold tracking-wide uppercase mb-8"
          >
            <Sparkles className="w-3.5 h-3.5" /> Next-Gen Academic Management
          </motion.div>
          
          <motion.h1 
            {...fadeUp(0.1)}
            className="text-6xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-8 leading-[1.1]"
          >
            Orchestrate Your <br />
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent italic">Academic Excellence</span>
          </motion.h1>
          
          <motion.p 
            {...fadeUp(0.2)}
            className="text-lg text-gray-500 leading-relaxed mb-12 px-8"
          >
            A unified operating system for modern educational institutions. 
            Streamline recruitment, academic planning, and quality monitoring in one seamless interface.
          </motion.p>
          
          <motion.div 
            {...fadeUp(0.3)}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link href="/login">
              <button className="w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white px-8 py-4 rounded-2xl text-base font-bold shadow-2xl shadow-gray-200 transition-all hover:scale-105 active:scale-95">
                Administrator Login
              </button>
            </Link>
            <Link href="/login">
              <button className="w-full sm:w-auto bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/30 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-105 active:scale-95">
                Teacher Access
              </button>
            </Link>
          </motion.div>
        </div>

        {/* Feature Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { 
              title: 'Faculty Recruitment', 
              desc: 'End-to-end recruitment pipelines with candidate tracking and induction management.',
              icon: <Users className="w-6 h-6 text-indigo-600" />,
              color: 'bg-indigo-50'
            },
            { 
              title: 'Academic Planning', 
              desc: 'Precision scheduling and milestone tracking for diverse academic programs.',
              icon: <BookOpen className="w-6 h-6 text-violet-600" />,
              color: 'bg-violet-50'
            },
            { 
              title: 'Quality Monitoring', 
              desc: 'Real-time audits and performance metrics to ensure institutional standards.',
              icon: <ShieldCheck className="w-6 h-6 text-blue-600" />,
              color: 'bg-blue-50'
            }
          ].map((feature, idx) => (
            <motion.div 
              key={feature.title}
              {...fadeUp(0.4 + idx * 0.1)}
              className="p-8 rounded-3xl border border-gray-100 bg-white shadow-sm hover:shadow-xl hover:shadow-indigo-50/50 transition-all group"
            >
              <div className={`w-14 h-14 ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-sm text-gray-400">© 2024 EduAdmin Pro. All rights reserved.</p>
        <div className="flex gap-8">
          <Link href="#" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Privacy Policy</Link>
          <Link href="#" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Terms of Service</Link>
          <Link href="#" className="text-sm text-gray-400 hover:text-indigo-600 transition-colors">Contact Support</Link>
        </div>
      </footer>
    </div>
  )
}
