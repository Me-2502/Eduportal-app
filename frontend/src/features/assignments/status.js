import { formatDistanceToNowStrict, isPast } from 'date-fns'

import { formatScore } from '@/lib/format'

/**
 * One status for a student's view of an assignment.
 * tone maps to a badge colour in AssignmentStatusBadge.
 */
export function studentStatus(assignment, submission) {
  const due = new Date(assignment.due_at)

  if (submission?.graded_at) {
    const label =
      assignment.max_score != null && submission.score != null
        ? `Graded · ${formatScore(submission.score)}/${formatScore(assignment.max_score)}`
        : 'Reviewed'
    return { key: 'graded', label, tone: 'good' }
  }
  if (submission) {
    return { key: 'submitted', label: submission.is_late ? 'Submitted late' : 'Submitted', tone: 'neutral' }
  }
  if (isPast(due)) {
    return assignment.allow_late
      ? { key: 'overdue', label: 'Overdue · late allowed', tone: 'warn' }
      : { key: 'missed', label: 'Missed', tone: 'bad' }
  }
  return { key: 'pending', label: `Due in ${formatDistanceToNowStrict(due)}`, tone: 'todo' }
}

export function canSubmit(assignment, submission) {
  if (submission?.graded_at) return false
  return !isPast(new Date(assignment.due_at)) || assignment.allow_late
}
