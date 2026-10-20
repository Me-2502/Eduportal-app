import { format } from 'date-fns'
import { ArrowLeft, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorNotice, SkeletonRows } from '@/components/states'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/auth-context'
import { useClasses, useClassStudents } from '@/features/people/api'
import { getErrorMessage } from '@/lib/api'
import { classLabel, formatScore, fullName } from '@/lib/format'

import { useAssignment, useDeleteAssignment, useMyAssignments, useSubmissions } from './api'
import { AssignmentDialog } from './AssignmentDialog'
import { StatusBadge } from './AssignmentRow'
import { GradeDialog } from './GradeDialog'
import { studentStatus } from './status'
import { SubmitWork } from './SubmitWork'

function Panel({ title, children, actions }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="font-medium">{title}</h2>
        {actions}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function Submissions({ assignment }) {
  const submissions = useSubmissions(assignment.id)
  const roster = useClassStudents(assignment.classroom_id)
  const [grading, setGrading] = useState(null)

  if (submissions.isPending) return <SkeletonRows rows={4} />
  if (submissions.isError) return <ErrorNotice error={submissions.error} onRetry={submissions.refetch} />

  const submittedIds = new Set(submissions.data.map((s) => s.student.id))
  const missing = (roster.data ?? []).filter((student) => !submittedIds.has(student.id))

  return (
    <div className="space-y-5">
      {submissions.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody has handed in yet.</p>
      ) : (
        <div className="-mx-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead className="border-b text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 pb-2 font-medium">Student</th>
                <th className="px-2 pb-2 font-medium">Handed in</th>
                <th className="px-2 pb-2 font-medium">Work</th>
                <th className="px-2 pb-2 text-right font-medium">Score</th>
                <th className="px-4 pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {submissions.data.map((submission) => (
                <tr key={submission.id}>
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar person={submission.student} className="size-7" />
                      <span>
                        <span className="block font-medium">{fullName(submission.student)}</span>
                        <span className="block text-xs text-muted-foreground">Roll {submission.student.roll_no}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-muted-foreground">
                    {format(new Date(submission.submitted_at), 'd MMM, HH:mm')}
                    {submission.is_late && (
                      <span className="ml-1.5 rounded bg-ev-meeting/15 px-1 py-px text-[0.7rem] font-medium text-ev-meeting">
                        late
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2.5">
                    <a
                      href={submission.file_path}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                    >
                      Open <ExternalLink className="size-3" />
                    </a>
                  </td>
                  <td className="px-2 py-2.5 text-right tabular">
                    {submission.graded_at
                      ? assignment.max_score != null
                        ? `${formatScore(submission.score)}/${formatScore(assignment.max_score)}`
                        : 'Reviewed'
                      : '–'}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button variant="outline" size="xs" onClick={() => setGrading(submission)}>
                      {submission.graded_at ? 'Edit' : assignment.max_score != null ? 'Grade' : 'Review'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {missing.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Not handed in ({missing.length})
          </p>
          <p className="text-sm text-muted-foreground">
            {missing.map((student) => `${student.roll_no}. ${fullName(student)}`).join(' · ')}
          </p>
        </div>
      )}

      <GradeDialog assignment={assignment} submission={grading} onOpenChange={(open) => !open && setGrading(null)} />
    </div>
  )
}

export function AssignmentDetailPage() {
  const { assignmentId } = useParams()
  const navigate = useNavigate()
  const { user, isStudent, canManage } = useAuth()
  const assignmentQuery = useAssignment(assignmentId)
  const mine = useMyAssignments({ enabled: isStudent })
  const classes = useClasses({ enabled: !isStudent })
  const deleteAssignment = useDeleteAssignment()
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (assignmentQuery.isPending) return <SkeletonRows rows={6} />
  if (assignmentQuery.isError) {
    return <ErrorNotice error={assignmentQuery.error} onRetry={assignmentQuery.refetch} />
  }

  const assignment = assignmentQuery.data
  const submission = mine.data?.find((item) => item.assignment.id === assignment.id)?.submission ?? null
  const classroom = classes.data?.find((c) => c.id === assignment.classroom_id)
  const isOwner = assignment.creator.id === user.id
  const canEdit = !isStudent && (isOwner || canManage)

  function handleDelete() {
    deleteAssignment.mutate(assignment.id, {
      onSuccess: () => {
        toast.success('Assignment deleted.')
        navigate('/assignments', { replace: true })
      },
      onError: (error) =>
        toast.error(
          error.response?.status === 409
            ? "Students have already handed in work, so it can't be deleted."
            : getErrorMessage(error),
        ),
    })
  }

  return (
    <>
      <Link
        to="/assignments"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" /> Assignments
      </Link>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {[assignment.subject.name, classroom && `Class ${classLabel(classroom)}`].filter(Boolean).join(' · ')}
          </p>
          <h1 className="mt-0.5 font-serif text-2xl font-semibold tracking-tight">{assignment.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Due {format(new Date(assignment.due_at), "EEEE d MMMM 'at' HH:mm")}</span>
            {isStudent && mine.data && <StatusBadge status={studentStatus(assignment, submission)} />}
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              <Pencil /> Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 /> Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Panel title="Instructions">
            {assignment.description ? (
              <p className="text-sm leading-relaxed whitespace-pre-line">{assignment.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">No instructions were added.</p>
            )}
          </Panel>
          {canEdit && (
            <Panel title="Submissions">
              <Submissions assignment={assignment} />
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          {isStudent && (
            <Panel title={submission?.graded_at ? 'Your result' : 'Your work'}>
              {mine.isPending ? (
                <SkeletonRows rows={2} />
              ) : (
                <SubmitWork
                  assignment={assignment}
                  submission={submission}
                  statusUnknown={mine.isError}
                  statusError={mine.error}
                />
              )}
            </Panel>
          )}
          <Panel title="Details">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Set by</dt>
              <dd>{fullName(assignment.creator)}</dd>
              <dt className="text-muted-foreground">Set on</dt>
              <dd>{format(new Date(assignment.created_at), 'd MMM yyyy')}</dd>
              <dt className="text-muted-foreground">Marks</dt>
              <dd>{assignment.max_score != null ? `Out of ${formatScore(assignment.max_score)}` : 'Not scored'}</dd>
              <dt className="text-muted-foreground">Late work</dt>
              <dd>{assignment.allow_late ? 'Accepted' : 'Not accepted'}</dd>
            </dl>
          </Panel>
        </div>
      </div>

      <AssignmentDialog open={editing} onOpenChange={setEditing} assignment={assignment} />
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this assignment?"
        description="Students will no longer see it. This can't be undone."
        pending={deleteAssignment.isPending}
        onConfirm={handleDelete}
      />
    </>
  )
}
