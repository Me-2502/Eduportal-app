import { format, parseISO } from 'date-fns'
import { CalendarCheck2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/states'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/features/auth/auth-context'
import { useClassStudents, useFaculty, useMyClassroom } from '@/features/people/api'
import { getErrorMessage } from '@/lib/api'
import { classLabel } from '@/lib/format'

import {
  useClassAbsences,
  useFacultyAbsences,
  useMyAbsences,
  useMyAttendanceSummary,
  useSetClassAttendance,
  useSetFacultyAttendance,
} from './api'
import { AttendanceRegister } from './AttendanceRegister'

const today = () => format(new Date(), 'yyyy-MM-dd')

// Academic year runs June -> May, same rule as deps.current_academic_year
function academicYear(date = new Date()) {
  return date.getMonth() >= 5 ? date.getFullYear() : date.getFullYear() - 1
}

function MonthlySummary({ year }) {
  const summary = useMyAttendanceSummary(year)
  if (summary.isPending) return <SkeletonRows rows={3} />
  if (summary.isError) return <ErrorNotice error={summary.error} onRetry={summary.refetch} />
  if (summary.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No absences in any month so far.</p>
  }
  const max = Math.max(...summary.data.map((m) => m.absent_days))
  return (
    <ul className="space-y-2">
      {summary.data.map((month) => (
        <li key={month.month} className="grid grid-cols-[4.5rem_1fr_2rem] items-center gap-3 text-sm">
          <span className="text-muted-foreground">{format(parseISO(month.month), 'MMM yyyy')}</span>
          <span className="h-2 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full rounded-full bg-destructive/70"
              style={{ width: `${(month.absent_days / max) * 100}%` }}
            />
          </span>
          <span className="text-right tabular">{month.absent_days}</span>
        </li>
      ))}
    </ul>
  )
}

function MyRecord() {
  const year = academicYear()
  const absences = useMyAbsences({ from: `${year}-06-01`, to: today() })

  const total = absences.data?.length ?? 0
  const excused = absences.data?.filter((a) => a.is_excused).length ?? 0

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="font-medium">Days absent this year</h2>
          <p className="text-sm text-muted-foreground">
            Since 1 June {year}. A day not listed here counts as present.
          </p>
        </div>
        <div className="p-4">
          {absences.isPending ? (
            <SkeletonRows rows={3} />
          ) : absences.isError ? (
            <ErrorNotice error={absences.error} onRetry={absences.refetch} />
          ) : total === 0 ? (
            <EmptyState icon={CalendarCheck2} title="Full attendance">
              You haven&apos;t missed a day this year.
            </EmptyState>
          ) : (
            <>
              <p className="mb-4">
                <span className="font-serif text-3xl font-semibold tabular">{total}</span>
                <span className="text-muted-foreground">
                  {' '}
                  {total === 1 ? 'day' : 'days'} · {excused} excused
                </span>
              </p>
              <ul className="divide-y rounded-md border">
                {absences.data.map((absence) => (
                  <li key={absence.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <span className="w-28 shrink-0 tabular">{format(parseISO(absence.absent_on), 'EEE d MMM')}</span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">{absence.reason || 'No reason given'}</span>
                    {absence.is_excused && (
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-xs">Excused</span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
      <section className="rounded-lg border bg-card lg:self-start">
        <h2 className="border-b px-4 py-3 font-medium">By month</h2>
        <div className="p-4">
          <MonthlySummary year={year} />
        </div>
      </section>
    </div>
  )
}

function DayPicker({ day, onChange }) {
  return (
    <Field label="Date" htmlFor="att-day" className="mb-4 max-w-48">
      <Input id="att-day" type="date" max={today()} value={day} onChange={(e) => e.target.value && onChange(e.target.value)} />
    </Field>
  )
}

function ClassRegister({ classroom }) {
  const [day, setDay] = useState(today)
  const students = useClassStudents(classroom.id)
  const absences = useClassAbsences(classroom.id, day)
  const save = useSetClassAttendance()

  return (
    <>
      <DayPicker day={day} onChange={setDay} />
      {students.isPending || absences.isPending ? (
        <SkeletonRows rows={8} />
      ) : students.isError || absences.isError ? (
        <ErrorNotice error={students.error ?? absences.error} onRetry={() => (students.refetch(), absences.refetch())} />
      ) : (
        <AttendanceRegister
          // a fresh register for every day, starting from what's already saved
          key={`${day}-${absences.dataUpdatedAt}`}
          people={students.data}
          existing={absences.data}
          showRoll
          saving={save.isPending}
          error={save.error && getErrorMessage(save.error)}
          onSave={(absentees) =>
            save.mutate(
              { classId: classroom.id, day, absentees },
              { onSuccess: () => toast.success(`Register saved for ${format(parseISO(day), 'd MMM')}.`) },
            )
          }
        />
      )}
    </>
  )
}

function StaffRegister() {
  const { user, isAdmin } = useAuth()
  const [day, setDay] = useState(today)
  const faculty = useFaculty()
  const absences = useFacultyAbsences(day)
  const save = useSetFacultyAttendance()
  // a HOD can't mark themselves (the API rejects it)
  const people = (faculty.data ?? []).filter((person) => isAdmin || person.id !== user.id)

  return (
    <>
      <DayPicker day={day} onChange={setDay} />
      {faculty.isPending || absences.isPending ? (
        <SkeletonRows rows={6} />
      ) : faculty.isError || absences.isError ? (
        <ErrorNotice error={faculty.error ?? absences.error} onRetry={() => (faculty.refetch(), absences.refetch())} />
      ) : (
        <AttendanceRegister
          key={`${day}-${absences.dataUpdatedAt}`}
          people={people}
          existing={absences.data}
          saving={save.isPending}
          error={save.error && getErrorMessage(save.error)}
          onSave={(absentees) =>
            save.mutate(
              { day, absentees },
              { onSuccess: () => toast.success(`Staff register saved for ${format(parseISO(day), 'd MMM')}.`) },
            )
          }
        />
      )}
    </>
  )
}

export function AttendancePage() {
  const { isFaculty, canManage } = useAuth()
  const { classroom, isPending } = useMyClassroom()
  const showClass = isFaculty && classroom
  const showStaff = canManage

  // wait for the class teacher lookup, otherwise the tabs would pick the wrong default
  if (isFaculty && isPending) return <SkeletonRows rows={6} />

  if (!showClass && !showStaff) {
    return (
      <>
        <PageHeader title="Attendance" description="Your attendance for this academic year." />
        <MyRecord />
      </>
    )
  }

  return (
    <>
      <PageHeader title="Attendance" description="Take the register, or check your own record." />
      <Tabs defaultValue={showClass ? 'class' : 'staff'}>
        <TabsList className="mb-4">
          {showClass && <TabsTrigger value="class">Class {classLabel(classroom)}</TabsTrigger>}
          {showStaff && <TabsTrigger value="staff">Staff</TabsTrigger>}
          <TabsTrigger value="me">My record</TabsTrigger>
        </TabsList>
        {showClass && (
          <TabsContent value="class">
            <ClassRegister classroom={classroom} />
          </TabsContent>
        )}
        {showStaff && (
          <TabsContent value="staff">
            <StaffRegister />
          </TabsContent>
        )}
        <TabsContent value="me">
          <MyRecord />
        </TabsContent>
      </Tabs>
    </>
  )
}
