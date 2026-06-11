import { LayoutDashboard, Users, BookOpen, ShieldCheck, UserCircle, Calendar, GraduationCap, BarChart2, ClipboardList, ClipboardCheck } from 'lucide-react'

export const MANAGEMENT_NAV = [
  { label: 'Dashboard', href: '/management', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Recruitment', href: '/management/recruitment', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic & Quality', href: '/management/academic-planning', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Teacher Portal', href: '/management/teacher-portal', icon: <UserCircle className="w-4 h-4" /> },
  { label: 'Student Reports', href: '/management/student-reports', icon: <BarChart2 className="w-4 h-4" /> },
  { label: 'Student Roster', href: '/management/students', icon: <GraduationCap className="w-4 h-4" /> },
  { label: 'Daily Reports', href: '/management/daily-reports', icon: <ClipboardCheck className="w-4 h-4" /> },
]

export const TEACHER_NAV = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'My Courses', href: '/teacher/courses', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Schedule', href: '/teacher/schedule', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Students', href: '/teacher/students', icon: <Users className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/teacher/academic-planning', icon: <GraduationCap className="w-4 h-4" /> },
  { label: 'Student Reports', href: '/teacher/student-reports', icon: <ClipboardList className="w-4 h-4" /> },
  { label: 'Daily Report', href: '/teacher/daily-report', icon: <ClipboardCheck className="w-4 h-4" /> },
]

