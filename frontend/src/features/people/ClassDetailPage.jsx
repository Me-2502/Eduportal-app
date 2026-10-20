import { ArrowLeft, BookOpenCheck, CalendarCheck2, LayoutGrid } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/PageHeader'
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAssignments } from '@/features/assignments/api'
import { AssignmentRow } from '@/features/assignments/AssignmentRow'
import { useCurrentUser } from '@/features/auth/auth-context'
import { useClassTimetable } from '@/features/timetable/api'
import { TimetableGrid } from '@/features/timetable/TimetableGrid'
import { classLabel, fullName } from '@/lib/format'

import { useClasses, useClassStudents } from './api'
import { StudentRoster } from './StudentRoster'

function ClassTimetable({ classId }) {
  const timetable = useClassTimetable(classId)
  if (timetable.isPending) return <SkeletonRows rows={5} />
  if (timetable.isError) return <ErrorNotice error={timetable.error} onRetry={timetable.refetch} />
  if (timetable.data.length === 0) return <EmptyState icon={LayoutGrid} title="No timetable for this class yet." />
  return <TimetableGrid slots={timetable.data} perspective="student" />
}

function ClassAssignments({ classId }) {
  const assignments = useAssignments({ classroomId: classId })
  if (assignments.isPending) return <SkeletonRows rows={4} />
  if (assignments.isError) return <ErrorNotice error={assignments.error} onRetry={assignments.refetch} />
  if (assignments.data.length === 0) {
    return <EmptyState icon={BookOpenCheck} title="No assignments set for this class." />
  }
  return (
    <ul className="divide-y overflow-hidden rounded-lg border bg-card">
      {assignments.data.map((assignment) => (
        <AssignmentRow key={assignment.id} assignment={assignment} meta={fullName(assignment.creator)} />
      ))}
    </ul>
  )
}

export function ClassDetailPage() {
  const { classId } = useParams()
  const user = useCurrentUser()
  const classes = useClasses()
  const students = useClassStudents(classId)
  const classroom = classes.data?.find((c) => c.id === classId)
  const isClassTeacher = classroom?.class_teacher?.id === user.id

  if (classes.isPending) return <SkeletonRows rows={6} />
  if (classes.isError) return <ErrorNotice error={classes.error} onRetry={classes.refetch} />
  if (!classroom) {
    return (
      <EmptyState
        title="Class not found"
        action={
          <Button asChild variant="outline">
            <Link to="/classes">Back to classes</Link>
          </Button>
        }
      >
        It may belong to an earlier academic year.
      </EmptyState>
    )
  }

  return (
    <>
      <Link to="/classes" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Classes
      </Link>
      <PageHeader
        title={`Class ${classLabel(classroom)}`}
        description={[
          `Room ${classroom.room_no}`,
          classroom.class_teacher ? `Class teacher: ${fullName(classroom.class_teacher)}` : 'No class teacher',
          students.data && `${students.data.length} students`,
        ]
          .filter(Boolean)
          .join(' · ')}
        actions={
          isClassTeacher && (
            <Button asChild>
              <Link to="/attendance">
                <CalendarCheck2 /> Take attendance
              </Link>
            </Button>
          )
        }
      />

      <Tabs defaultValue="students">
        <TabsList className="mb-4">
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="timetable">Timetable</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
        </TabsList>
        <TabsContent value="students">
          {students.isPending ? (
            <SkeletonRows rows={8} />
          ) : students.isError ? (
            <ErrorNotice error={students.error} onRetry={students.refetch} />
          ) : (
            <StudentRoster students={students.data} emptyText="No students in this class yet." />
          )}
        </TabsContent>
        <TabsContent value="timetable">
          <ClassTimetable classId={classId} />
        </TabsContent>
        <TabsContent value="assignments">
          <ClassAssignments classId={classId} />
        </TabsContent>
      </Tabs>
    </>
  )
}
