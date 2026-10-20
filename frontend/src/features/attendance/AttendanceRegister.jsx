import { useState } from 'react'

import { FormError } from '@/components/Field'
import { Spinner } from '@/components/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'

/**
 * A day's register. The API takes the full list of absentees for the day and
 * marks everyone else present, so this keeps the whole list in local state.
 */
export function AttendanceRegister({ people, existing, onSave, saving, error, showRoll = false }) {
  const [absent, setAbsent] = useState(() =>
    Object.fromEntries(
      existing.map((a) => [a.user_id, { reason: a.reason ?? '', excused: a.is_excused }]),
    ),
  )

  const toggle = (id) =>
    setAbsent((current) => {
      const next = { ...current }
      if (next[id]) delete next[id]
      else next[id] = { reason: '', excused: false }
      return next
    })

  const update = (id, field, value) =>
    setAbsent((current) => ({ ...current, [id]: { ...current[id], [field]: value } }))

  const absentCount = Object.keys(absent).length

  function handleSave() {
    onSave(
      Object.entries(absent).map(([userId, entry]) => ({
        user_id: userId,
        reason: entry.reason.trim() || null,
        is_excused: entry.excused,
      })),
    )
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border bg-card">
        <ul className="divide-y">
          {people.map((person) => {
            const entry = absent[person.id]
            return (
              <li key={person.id} className={cn('px-4 py-2.5', entry && 'bg-destructive/[0.04]')}>
                <div className="flex items-center gap-3">
                  {showRoll && (
                    <span className="w-6 text-right text-sm tabular text-muted-foreground">{person.roll_no}</span>
                  )}
                  <UserAvatar person={person} className="size-7" />
                  <span className="min-w-0 flex-1 truncate font-medium">{fullName(person)}</span>
                  <div className="flex rounded-md border p-0.5 text-xs" role="radiogroup" aria-label={`${fullName(person)} attendance`}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={!entry}
                      onClick={() => entry && toggle(person.id)}
                      className={cn(
                        'rounded px-2.5 py-1 font-medium transition-colors',
                        !entry ? 'bg-primary/12 text-primary' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Present
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={Boolean(entry)}
                      onClick={() => !entry && toggle(person.id)}
                      className={cn(
                        'rounded px-2.5 py-1 font-medium transition-colors',
                        entry ? 'bg-destructive text-white' : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      Absent
                    </button>
                  </div>
                </div>
                {entry && (
                  <div className={cn('mt-2 flex flex-col gap-2 sm:flex-row sm:items-center', showRoll ? 'sm:pl-[4.75rem]' : 'sm:pl-10')}>
                    <Input
                      placeholder="Reason (optional)"
                      maxLength={255}
                      className="h-8 sm:max-w-xs"
                      value={entry.reason}
                      onChange={(e) => update(person.id, 'reason', e.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={entry.excused}
                        onCheckedChange={(checked) => update(person.id, 'excused', checked === true)}
                      />
                      Excused
                    </label>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
      <FormError>{error}</FormError>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Spinner />}
          Save register
        </Button>
        <span className="text-sm text-muted-foreground">
          {people.length - absentCount} present · {absentCount} absent
        </span>
      </div>
    </div>
  )
}
