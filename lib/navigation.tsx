'use client'

import { LayoutDashboard, Users, BookOpen, ShieldCheck, UserCircle, Calendar, GraduationCap, BarChart2, ClipboardList, ClipboardCheck, CreditCard, FileQuestion, CheckSquare, MessageSquare, HeartHandshake, Bell, BookText, FileCheck, ListTodo } from 'lucide-react'

export const MANAGEMENT_NAV = [
  { label: 'Dashboard', href: '/management', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/management/academic-planning', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Recruitment', href: '/management/recruitment', icon: <Users className="w-4 h-4" /> },
  { label: 'Student Reports', href: '/management/student-reports', icon: <BarChart2 className="w-4 h-4" /> },
  { label: 'Students', href: '/management/students', icon: <GraduationCap className="w-4 h-4" /> },
  { label: 'Teacher Portal', href: '/management/teacher-portal', icon: <UserCircle className="w-4 h-4" /> },
  { label: 'Daily Reports', href: '/management/daily-reports', icon: <ClipboardCheck className="w-4 h-4" /> },
  { label: 'Fee Management', href: '#', icon: <CreditCard className="w-4 h-4" /> },
  { label: 'Tests & Question Bank', href: '#', icon: <FileQuestion className="w-4 h-4" /> },
  { label: 'Attendance', href: '#', icon: <CheckSquare className="w-4 h-4" /> },
  { label: 'Feedback', href: '#', icon: <MessageSquare className="w-4 h-4" /> },
  { label: 'Counseling', href: '#', icon: <HeartHandshake className="w-4 h-4" /> },
  { label: 'Calendar', href: '#', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Announcements', href: '#', icon: <Bell className="w-4 h-4" /> },
]

export const TEACHER_NAV = [
  { label: 'Dashboard', href: '/teacher', icon: <LayoutDashboard className="w-4 h-4" /> },
  { label: 'Schedule', href: '/teacher/schedule', icon: <Calendar className="w-4 h-4" /> },
  { label: 'Academic Planning', href: '/teacher/academic-planning', icon: <GraduationCap className="w-4 h-4" /> },
  { label: 'Student Reports', href: '/teacher/student-reports', icon: <ClipboardList className="w-4 h-4" /> },
  { label: 'Students', href: '/teacher/students', icon: <Users className="w-4 h-4" /> },
  { label: 'Daily Report', href: '/teacher/daily-report', icon: <ClipboardCheck className="w-4 h-4" /> },
  { label: 'Courses', href: '/teacher/courses', icon: <BookOpen className="w-4 h-4" /> },
  { label: 'Attendance', href: '#', icon: <CheckSquare className="w-4 h-4" /> },
  { label: 'Tests & Question Bank', href: '#', icon: <FileQuestion className="w-4 h-4" /> },
  { label: 'Assignments/DPP', href: '#', icon: <ListTodo className="w-4 h-4" /> },
  { label: 'Test Results', href: '#', icon: <FileCheck className="w-4 h-4" /> },
  { label: 'Counseling Log', href: '#', icon: <HeartHandshake className="w-4 h-4" /> },
  { label: 'Feedback', href: '#', icon: <MessageSquare className="w-4 h-4" /> },
]

