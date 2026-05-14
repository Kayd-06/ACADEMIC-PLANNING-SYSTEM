import { LayoutDashboard, Users, BookOpen, ShieldCheck, UserCircle, Calendar, GraduationCap } from 'lucide-react'

export const MANAGEMENT_NAV = [
  { label: 'Dashboard', href: '/management', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Recruitment', href: '/management/recruitment', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/management/academic-planning', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Quality Monitoring', href: '/management/quality', icon: <ShieldCheck className="w-4 h-4" /> },
  { label: 'Teacher Portal', href: '/management/teacher-portal', icon: <UserCircle className="w-4 h-4" /> },
]

export const TEACHER_NAV = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'My Courses', href: '/teacher/courses', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Schedule', href: '/teacher/schedule', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Students', href: '/teacher/students', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/teacher/academic-planning', icon: <GraduationCap className="w-4 h-4" /> },
]

