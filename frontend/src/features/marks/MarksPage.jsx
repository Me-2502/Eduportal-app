import { ClipboardList } from 'lucide-react'
import { useSearchParams } from 'react-router'

import { Field } from '@/components/Field'
import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/states'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useClassStudents } from '@/features/people/api'
import { isNotImplemented } from '@/lib/api'
import { classLabel, fullName } from '@/lib/format'

import { useMyMarks, useStudentMarks } from './api'
import { MarksEntry } from './MarksEntry'
import { ReportCard } from './ReportCard'

function StudentMarks() {
  const marks = useMyMarks()
  return (
    <>
      <PageHeader title="Marks" description="Your results, newest standard first." />
      {marks.isPending ? (
        <SkeletonRows rows={8} />
      ) : marks.isError ? (
        <ErrorNotice error={marks.error} onRetry={marks.refetch} />
      ) : (
        <ReportCard results={marks.data} emptyText="No results have been published for you yet." />
      )}
    </>
  )
}

function StaffMarks() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const classId = params.get('class') ?? ''
  const studentId = params.get('student') ?? ''

  const classes = useClasses()
  const students = useClassStudents(classId)
  const marks = useStudentMarks(studentId)

  const classroom = classes.data?.find((c) => c.id === classId)
  const student = students.data?.find((s) => s.id === studentId)

  return (
    <>
      <PageHeader
        title="Marks"
        description={user.is_hod ? 'Look up a student, or enter and correct their marks.' : 'Look up a student’s results.'}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-[12rem_1fr] sm:max-w-xl">
        <Field label="Class" htmlFor="mk-class">
          <Select value={classId} onValueChange={(value) => setParams({ class: value })}>
            <SelectTrigger id="mk-class" className="w-full" disabled={classes.isPending}>
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {(classes.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  Class {classLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Student" htmlFor="mk-student">
          <Select
            value={studentId}
            onValueChange={(value) => setParams({ class: classId, student: value })}
            disabled={!classId || students.isPending}
          >
            <SelectTrigger id="mk-student" className="w-full">
              <SelectValue placeholder={classId ? 'Choose a student' : 'Pick a class first'} />
            </SelectTrigger>
            <SelectContent>
              {(students.data ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.roll_no}. {fullName(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {classes.isError && <ErrorNotice error={classes.error} onRetry={classes.refetch} />}

      {!student ? (
        <EmptyState icon={ClipboardList} title="Choose a student">
          Their report card will show up here.
        </EmptyState>
      ) : (
        <div className={user.is_hod ? 'grid gap-6 xl:grid-cols-[1fr_24rem]' : undefined}>
          <div>
            {marks.isPending ? (
              <SkeletonRows rows={8} />
            ) : marks.isError ? (
              <ErrorNotice error={marks.error} onRetry={marks.refetch} />
            ) : (
              <ReportCard results={marks.data} emptyText={`No marks recorded for ${student.first_name} yet.`} />
            )}
          </div>
          {user.is_hod && classroom && (
            <section className="rounded-lg border bg-card p-4 xl:self-start">
              <h2 className="mb-4 font-medium">Enter marks for {student.first_name}</h2>
              {/* still usable when reading marks isn't available yet, just without prefilled scores */}
              {(marks.isSuccess || isNotImplemented(marks.error)) && (
                <MarksEntry student={student} classroom={classroom} results={marks.data} />
              )}
            </section>
          )}
        </div>
      )}
    </>
  )
}

export function MarksPage() {
  const { isStudent } = useAuth()
  return isStudent ? <StudentMarks /> : <StaffMarks />
}
