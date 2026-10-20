import { addDays, format } from 'date-fns'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useSubjects } from '@/features/people/api'
import { useMyTimetable } from '@/features/timetable/api'
import { getErrorMessage } from '@/lib/api'
import { classLabel } from '@/lib/format'

import { useCreateAssignment, useUpdateAssignment } from './api'

/**
 * A faculty member may only set work for a class + subject they teach (the DB checks
 * this against the timetable), so the options come straight from their timetable.
 */
function useTeachingOptions() {
  const timetable = useMyTimetable()
  const subjects = useSubjects()
  const subjectIdByCode = new Map((subjects.data ?? []).map((s) => [s.code, s.id]))

  const options = new Map()
  for (const slot of timetable.data ?? []) {
    const subjectId = subjectIdByCode.get(slot.subject.code)
    if (!subjectId) continue
    const value = `${slot.classroom.id}|${subjectId}`
    if (!options.has(value)) {
      options.set(value, {
        value,
        label: `${classLabel(slot.classroom)} · ${slot.subject.name}`,
        standard: slot.classroom.standard,
        division: slot.classroom.division,
      })
    }
  }
  const sorted = [...options.values()].sort(
    (a, b) => a.standard - b.standard || a.division.localeCompare(b.division) || a.label.localeCompare(b.label),
  )
  return { options: sorted, isPending: timetable.isPending || subjects.isPending }
}

function initialValues(assignment) {
  if (!assignment) {
    return {
      target: '',
      title: '',
      description: '',
      dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      dueTime: '23:59',
      graded: true,
      maxScore: '10',
      allowLate: false,
    }
  }
  const due = new Date(assignment.due_at)
  return {
    target: '',
    title: assignment.title,
    description: assignment.description ?? '',
    dueDate: format(due, 'yyyy-MM-dd'),
    dueTime: format(due, 'HH:mm'),
    graded: assignment.max_score != null,
    maxScore: assignment.max_score != null ? String(assignment.max_score) : '10',
    allowLate: assignment.allow_late,
  }
}

function AssignmentForm({ assignment, onDone }) {
  const isEdit = Boolean(assignment)
  const [values, setValues] = useState(() => initialValues(assignment))
  const [localError, setLocalError] = useState('')
  const teaching = useTeachingOptions()
  const create = useCreateAssignment()
  const update = useUpdateAssignment()
  const mutation = isEdit ? update : create

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }))

  function handleSubmit(e) {
    e.preventDefault()
    const dueAt = new Date(`${values.dueDate}T${values.dueTime || '23:59'}`)
    const maxScore = Number(values.maxScore)

    let problem = ''
    if (!isEdit && !values.target) problem = 'Pick a class and subject.'
    else if (!isEdit && dueAt <= new Date()) problem = 'The due date must be in the future.'
    else if (values.graded && !(maxScore > 0 && maxScore < 1000)) problem = 'Max score must be between 1 and 999.'
    setLocalError(problem)
    if (problem) return

    const body = {
      title: values.title.trim(),
      description: values.description.trim() || null,
      due_at: dueAt.toISOString(),
      max_score: values.graded ? maxScore : null,
      allow_late: values.allowLate,
    }

    if (isEdit) {
      update.mutate(
        { id: assignment.id, ...body },
        {
          onSuccess: () => {
            toast.success('Assignment updated.')
            onDone()
          },
        },
      )
    } else {
      const [classroomId, subjectId] = values.target.split('|')
      create.mutate(
        { ...body, classroom_id: classroomId, subject_id: subjectId },
        {
          onSuccess: (created) => {
            toast.success('Assignment set.')
            onDone(created)
          },
        },
      )
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      {!isEdit && (
        <Field label="Class and subject" htmlFor="as-target">
          <Select value={values.target} onValueChange={(target) => setValues((v) => ({ ...v, target }))}>
            <SelectTrigger id="as-target" className="w-full" disabled={teaching.isPending}>
              <SelectValue placeholder={teaching.isPending ? 'Loading…' : 'Choose…'} />
            </SelectTrigger>
            <SelectContent>
              {teaching.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!teaching.isPending && teaching.options.length === 0 && (
            <p className="text-xs text-muted-foreground">
              You don&apos;t have any periods in the timetable yet, so there&apos;s no class to set work for.
            </p>
          )}
        </Field>
      )}

      <Field label="Title" htmlFor="as-title">
        <Input id="as-title" maxLength={150} value={values.title} onChange={set('title')} autoFocus={isEdit} />
      </Field>

      <Field label="Instructions" htmlFor="as-desc">
        <Textarea
          id="as-desc"
          rows={4}
          maxLength={5000}
          value={values.description}
          onChange={set('description')}
          placeholder="What should students do? Optional."
        />
      </Field>

      <Field label="Due" htmlFor="as-due">
        <div className="flex gap-2">
          <Input id="as-due" type="date" value={values.dueDate} onChange={set('dueDate')} required />
          <Input type="time" aria-label="Due time" className="w-28" value={values.dueTime} onChange={set('dueTime')} />
        </div>
      </Field>

      <div className="grid gap-3 rounded-md border p-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="as-graded" className="font-normal">
            Give a score
          </Label>
          <Switch
            id="as-graded"
            checked={values.graded}
            onCheckedChange={(graded) => setValues((v) => ({ ...v, graded }))}
          />
        </div>
        {values.graded && (
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="as-max" className="font-normal text-muted-foreground">
              Out of
            </Label>
            <Input
              id="as-max"
              type="number"
              min={1}
              max={999}
              step="0.5"
              className="w-24"
              value={values.maxScore}
              onChange={set('maxScore')}
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="as-late" className="font-normal">
            Accept late submissions
          </Label>
          <Switch
            id="as-late"
            checked={values.allowLate}
            onCheckedChange={(allowLate) => setValues((v) => ({ ...v, allowLate }))}
          />
        </div>
      </div>

      <FormError>{localError || (mutation.error && getErrorMessage(mutation.error))}</FormError>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone()}>
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending || !values.title.trim()}>
          {mutation.isPending && <Spinner />}
          {isEdit ? 'Save changes' : 'Set assignment'}
        </Button>
      </DialogFooter>
    </form>
  )
}

export function AssignmentDialog({ open, onOpenChange, assignment, onCreated }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{assignment ? 'Edit assignment' : 'New assignment'}</DialogTitle>
          <DialogDescription>
            {assignment
              ? 'Students see changes straight away.'
              : 'Students in the class see it on their assignments page.'}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <AssignmentForm
            assignment={assignment}
            onDone={(created) => {
              onOpenChange(false)
              if (created) onCreated?.(created)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
