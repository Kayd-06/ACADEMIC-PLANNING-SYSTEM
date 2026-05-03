'use client'
import { motion } from 'framer-motion'

const orbs = [
  { size: 600, x: '-15%', y: '-20%', color: '#e0e7ff', duration: 12 },
  { size: 500, x: '70%', y: '-15%', color: '#ede9fe', duration: 15 },
  { size: 450, x: '55%', y: '55%', color: '#dbeafe', duration: 11 },
  { size: 380, x: '-8%', y: '55%', color: '#f3e8ff', duration: 14 },
]

export default function AuthBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden bg-white -z-10">
      {orbs.map((orb, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: orb.size,
            height: orb.size,
            left: orb.x,
            top: orb.y,
            background: `radial-gradient(circle at center, ${orb.color}99 0%, transparent 70%)`,
          }}
          animate={{
            x: [0, 30, -20, 10, 0],
            y: [0, -25, 30, -10, 0],
          }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 1.2,
          }}
        />
      ))}
    </div>
  )
}
