import { useState } from 'react'
import { toast } from 'sonner'

import { Field, FormError } from '@/components/Field'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { getErrorMessage } from '@/lib/api'
import { formatScore, fullName } from '@/lib/format'

import { useGradeSubmission } from './api'

function GradeForm({ assignment, submission, onDone }) {
  const graded = assignment.max_score != null
  const [score, setScore] = useState(submission.score != null ? String(submission.score) : '')
  const [feedback, setFeedback] = useState(submission.feedback ?? '')
  const [localError, setLocalError] = useState('')
  const grade = useGradeSubmission()

  function handleSubmit(e) {
    e.preventDefault()
    const value = score === '' ? null : Number(score)
    if (graded && value !== null && !(value >= 0 && value <= assignment.max_score)) {
      setLocalError(`Score must be between 0 and ${formatScore(assignment.max_score)}.`)
      return
    }
    setLocalError('')
    grade.mutate(
      {
        assignmentId: assignment.id,
        submissionId: submission.id,
        score: graded ? value : null,
        feedback: feedback.trim() || null,
      },
      {
        onSuccess: () => {
          toast.success(`Saved for ${submission.student.first_name}.`)
          onDone()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {graded && (
        <Field label={`Score (out of ${formatScore(assignment.max_score)})`} htmlFor="gr-score">
          <Input
            id="gr-score"
            type="number"
            min={0}
            max={assignment.max_score}
            step="0.5"
            className="w-32"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            autoFocus
          />
        </Field>
      )}
      <Field label="Feedback" htmlFor="gr-feedback">
        <Textarea
          id="gr-feedback"
          rows={4}
          maxLength={2000}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Optional"
        />
      </Field>
      <FormError>{localError || (grade.error && getErrorMessage(grade.error))}</FormError>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={grade.isPending}>
          {grade.isPending && <Spinner />}
          Save
        </Button>
      </DialogFooter>
    </form>
  )
}

export function GradeDialog({ assignment, submission, onOpenChange }) {
  return (
    <Dialog open={Boolean(submission)} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{submission ? fullName(submission.student) : 'Grade'}</DialogTitle>
          <DialogDescription>Students see the score and feedback once you save.</DialogDescription>
        </DialogHeader>
        {submission && (
          <GradeForm
            key={submission.id}
            assignment={assignment}
            submission={submission}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
