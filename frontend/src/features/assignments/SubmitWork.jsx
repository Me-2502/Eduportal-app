import { format } from 'date-fns'
import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Field, FormError } from '@/components/Field'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getErrorMessage, isNotImplemented } from '@/lib/api'
import { formatScore } from '@/lib/format'

import { useSubmitAssignment, useWithdrawSubmission } from './api'
import { canSubmit } from './status'

function isHttpUrl(value) {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * There is no file upload on the backend yet, so students hand in a link
 * (Google Drive, OneDrive...). It goes into file_path until storage exists.
 */
function SubmitForm({ assignmentId, existing, onDone }) {
  const [link, setLink] = useState(existing?.file_path ?? '')
  const [name, setName] = useState(existing?.file_name ?? '')
  const [localError, setLocalError] = useState('')
  const submit = useSubmitAssignment()

  function handleSubmit(e) {
    e.preventDefault()
    if (!isHttpUrl(link.trim())) {
      setLocalError('Paste a full link starting with https://')
      return
    }
    setLocalError('')
    submit.mutate(
      { assignmentId, file_path: link.trim(), file_name: name.trim() || null },
      {
        onSuccess: (saved) => {
          toast.success(saved.is_late ? 'Handed in (late).' : 'Handed in.')
          onDone?.()
        },
      },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <Field label="Link to your work" htmlFor="sub-link" hint="Make sure your teacher can open it.">
        <Input
          id="sub-link"
          type="url"
          inputMode="url"
          placeholder="https://drive.google.com/…"
          value={link}
          onChange={(e) => setLink(e.target.value)}
        />
      </Field>
      <Field label="Title" htmlFor="sub-name">
        <Input
          id="sub-name"
          maxLength={255}
          placeholder="Optional, e.g. Chapter 4 answers"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <FormError>{localError || (submit.error && getErrorMessage(submit.error))}</FormError>
      <div className="flex gap-2">
        <Button type="submit" disabled={submit.isPending || !link.trim()}>
          {submit.isPending && <Spinner />}
          {existing ? 'Replace submission' : 'Hand in'}
        </Button>
        {existing && (
          <Button type="button" variant="ghost" onClick={onDone}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}

export function SubmitWork({ assignment, submission, statusUnknown, statusError }) {
  const [editing, setEditing] = useState(false)
  const [confirmWithdraw, setConfirmWithdraw] = useState(false)
  const withdraw = useWithdrawSubmission()
  const open = canSubmit(assignment, submission)

  if (statusError && !isNotImplemented(statusError)) {
    return <p className="text-sm text-destructive">{getErrorMessage(statusError)}</p>
  }

  if (submission?.graded_at) {
    return (
      <div className="space-y-3">
        {assignment.max_score != null && (
          <p>
            <span className="font-serif text-3xl font-semibold tabular">{formatScore(submission.score)}</span>
            <span className="text-muted-foreground"> / {formatScore(assignment.max_score)}</span>
          </p>
        )}
        {submission.feedback ? (
          <blockquote className="border-l-2 border-primary/40 pl-3 text-sm whitespace-pre-line">
            {submission.feedback}
          </blockquote>
        ) : (
          <p className="text-sm text-muted-foreground">No written feedback.</p>
        )}
        <SubmittedLink submission={submission} />
      </div>
    )
  }

  if (submission && !editing) {
    return (
      <div className="space-y-4">
        <SubmittedLink submission={submission} />
        <p className="text-sm text-muted-foreground">
          Handed in {format(new Date(submission.submitted_at), "d MMM 'at' HH:mm")}
          {submission.is_late && ' · late'}. Waiting for your teacher to review it.
        </p>
        {open && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Replace
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmWithdraw(true)}>
              Withdraw
            </Button>
          </div>
        )}
        <ConfirmDialog
          open={confirmWithdraw}
          onOpenChange={setConfirmWithdraw}
          title="Withdraw your submission?"
          description="Your teacher won't see it any more. You can hand in again while the assignment is open."
          confirmLabel="Withdraw"
          pending={withdraw.isPending}
          onConfirm={() =>
            withdraw.mutate(assignment.id, {
              onSuccess: () => {
                toast.success('Submission withdrawn.')
                setConfirmWithdraw(false)
              },
              onError: (error) => toast.error(getErrorMessage(error)),
            })
          }
        />
      </div>
    )
  }

  if (!open) {
    return <p className="text-sm text-muted-foreground">This assignment is closed for submissions.</p>
  }

  return (
    <div className="space-y-3">
      {statusUnknown && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
          Your earlier submission (if any) can&apos;t be shown yet. Handing in again replaces it.
        </p>
      )}
      <SubmitForm assignmentId={assignment.id} existing={submission} onDone={() => setEditing(false)} />
    </div>
  )
}

function SubmittedLink({ submission }) {
  return (
    <a
      href={submission.file_path}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex max-w-full items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      <ExternalLink className="size-3.5 shrink-0" />
      <span className="truncate">{submission.file_name || submission.file_path}</span>
    </a>
  )
}
