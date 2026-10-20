import {
  BookOpenCheck,
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  House,
  LayoutGrid,
  School,
  UserRound,
  Users,
} from 'lucide-react'

// `roles` limits an item to those roles; no `roles` means everyone.
export const NAV_SECTIONS = [
  {
    items: [
      { to: '/', label: 'Overview', icon: House, end: true },
      { to: '/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/timetable', label: 'Timetable', icon: LayoutGrid, roles: ['student', 'faculty'] },
    ],
  },
  {
    title: 'Classwork',
    items: [
      { to: '/assignments', label: 'Assignments', icon: BookOpenCheck, roles: ['student', 'faculty', 'admin'] },
      { to: '/marks', label: 'Marks', icon: ClipboardList },
      { to: '/attendance', label: 'Attendance', icon: CalendarCheck2 },
    ],
  },
  {
    title: 'People',
    items: [
      { to: '/classmates', label: 'Classmates', icon: Users, roles: ['student'] },
      { to: '/classes', label: 'Classes', icon: School, roles: ['faculty', 'admin'] },
      { to: '/faculty', label: 'Faculty', icon: UserRound },
    ],
  },
]

export function navForRole(role) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(role)),
  })).filter((section) => section.items.length > 0)
}
