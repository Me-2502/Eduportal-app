import { createBrowserRouter } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { NotFoundPage } from '@/components/NotFoundPage'
import { FullPageSpinner } from '@/components/states'
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage'
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { PublicOnly, RequireAuth, RequireRole } from '@/features/auth/guards'
import { LoginPage } from '@/features/auth/LoginPage'

/** Code-split a page: the module is only downloaded when the route is visited. */
const page = (load, name) => ({
  lazy: async () => ({ Component: (await load())[name] }),
})

export const router = createBrowserRouter([
  {
    hydrateFallbackElement: <FullPageSpinner />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/login', element: <LoginPage /> },
          { path: '/forgot-password', element: <ForgotPasswordPage /> },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          { path: '/change-password', element: <ChangePasswordPage /> },
          {
            element: <AppShell />,
            children: [
              { index: true, ...page(() => import('@/features/overview/OverviewPage'), 'OverviewPage') },
              { path: 'calendar', ...page(() => import('@/features/events/CalendarPage'), 'CalendarPage') },
              { path: 'faculty', ...page(() => import('@/features/people/FacultyPage'), 'FacultyPage') },
              { path: 'marks', ...page(() => import('@/features/marks/MarksPage'), 'MarksPage') },
              { path: 'attendance', ...page(() => import('@/features/attendance/AttendancePage'), 'AttendancePage') },
              { path: 'profile', ...page(() => import('@/features/profile/ProfilePage'), 'ProfilePage') },
              {
                path: 'assignments',
                children: [
                  { index: true, ...page(() => import('@/features/assignments/AssignmentsPage'), 'AssignmentsPage') },
                  {
                    path: ':assignmentId',
                    ...page(() => import('@/features/assignments/AssignmentDetailPage'), 'AssignmentDetailPage'),
                  },
                ],
              },
              {
                element: <RequireRole roles={['student', 'faculty']} />,
                children: [
                  { path: 'timetable', ...page(() => import('@/features/timetable/TimetablePage'), 'TimetablePage') },
                ],
              },
              {
                element: <RequireRole roles={['student']} />,
                children: [
                  { path: 'classmates', ...page(() => import('@/features/people/ClassmatesPage'), 'ClassmatesPage') },
                ],
              },
              {
                element: <RequireRole roles={['faculty', 'admin']} />,
                children: [
                  { path: 'classes', ...page(() => import('@/features/people/ClassesPage'), 'ClassesPage') },
                  {
                    path: 'classes/:classId',
                    ...page(() => import('@/features/people/ClassDetailPage'), 'ClassDetailPage'),
                  },
                ],
              },
              { path: '*', element: <NotFoundPage /> },
            ],
          },
        ],
      },
    ],
  },
])
