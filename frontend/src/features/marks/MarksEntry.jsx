import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field, FormError } from '@/components/Field'
import { SkeletonRows, Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useSubjects } from '@/features/people/api'
import { getErrorMessage } from '@/lib/api'
import { EXAMS } from '@/lib/constants'

import { useDeleteMarks, useSaveMarks } from './api'

function existingScores(results, standard, exam) {
  const result = results?.find((r) => r.standard === standard && r.exam === exam)
  return Object.fromEntries(
    (result?.subjects ?? []).map((m) => [m.subject.code, { score: String(m.score), max: String(m.max_score) }]),
  )
}

function ScoresForm({ student, standard, exam, subjects, existing, hasExisting }) {
  const [rows, setRows] = useState(() =>
    Object.fromEntries(
      subjects.map((s) => [s.code, existing[s.code] ?? { score: '', max: '100' }]),
    ),
  )
  const [localError, setLocalError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const save = useSaveMarks()
  const remove = useDeleteMarks()

  const setRow = (code, field, value) =>
    setRows((current) => ({ ...current, [code]: { ...current[code], [field]: value } }))

  function handleSubmit(e) {
    e.preventDefault()
    const marks = []
    for (const subject of subjects) {
      const row = rows[subject.code]
      if (row.score === '') continue
      const score = Number(row.score)
      const max = Number(row.max)
      if (!(max > 0) || !(score >= 0) || score > max) {
        setLocalError(`${subject.name}: score must be between 0 and ${row.max || 'the max'}.`)
        return
      }
      marks.push({ subject_id: subject.id, score, max_score: max })
    }
    if (marks.length === 0) {
      setLocalError('Enter at least one score.')
      return
    }
    setLocalError('')
    save.mutate(
      { studentId: student.id, standard, exam, marks },
      { onSuccess: () => toast.success(`Marks saved for ${student.first_name}.`) },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Subject</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Score</th>
              <th className="w-24 px-3 py-2 text-left font-medium">Out of</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {subjects.map((subject) => (
              <tr key={subject.id}>
                <td className="px-3 py-1.5">
                  <label htmlFor={`mk-${subject.code}`}>{subject.name}</label>
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    id={`mk-${subject.code}`}
                    type="number"
                    min={0}
                    step="0.5"
                    className="h-8 tabular"
                    value={rows[subject.code].score}
                    onChange={(e) => setRow(subject.code, 'score', e.target.value)}
                  />
                </td>
                <td className="px-3 py-1.5">
                  <Input
                    type="number"
                    min={1}
                    step="0.5"
                    aria-label={`${subject.name} out of`}
                    className="h-8 tabular"
                    value={rows[subject.code].max}
                    onChange={(e) => setRow(subject.code, 'max', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Leave a score empty to skip that subject. Saving again overwrites earlier marks.
      </p>
      <FormError>{localError || (save.error && getErrorMessage(save.error))}</FormError>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <Spinner />}
          Save marks
        </Button>
        {hasExisting && (
          <Button type="button" variant="ghost" className="text-destructive" onClick={() => setConfirmDelete(true)}>
            Delete these marks
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete these marks?"
        description={`All subjects for standard ${standard}, ${EXAMS.find((x) => x.value === exam)?.label}, will be removed for ${student.first_name}.`}
        pending={remove.isPending}
        onConfirm={() =>
          remove.mutate(
            { studentId: student.id, standard, exam },
            {
              onSuccess: () => {
                toast.success('Marks deleted.')
                setConfirmDelete(false)
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            },
          )
        }
      />
    </form>
  )
}

/** HOD only: enter or correct one student's marks for one standard + exam. */
export function MarksEntry({ student, classroom, results }) {
  const subjects = useSubjects()
  const [standard, setStandard] = useState(classroom.standard)
  const [exam, setExam] = useState('final')

  const existing = existingScores(results, standard, exam)
  const standards = Array.from({ length: classroom.standard }, (_, i) => classroom.standard - i)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Standard" htmlFor="mk-std">
          <Select value={String(standard)} onValueChange={(v) => setStandard(Number(v))}>
            <SelectTrigger id="mk-std" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {standards.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  Standard {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Exam" htmlFor="mk-exam">
          <Select value={exam} onValueChange={setExam}>
            <SelectTrigger id="mk-exam" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EXAMS.map((x) => (
                <SelectItem key={x.value} value={x.value}>
                  {x.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      {subjects.isPending ? (
        <SkeletonRows rows={6} />
      ) : (
        <ScoresForm
          // remount when the selection or saved data changes, so inputs start from what's stored
          key={`${student.id}-${standard}-${exam}-${JSON.stringify(existing)}`}
          student={student}
          standard={standard}
          exam={exam}
          subjects={subjects.data ?? []}
          existing={existing}
          hasExisting={Object.keys(existing).length > 0}
        />
      )}
    </div>
  )
}
