import { DAYS } from '@/lib/constants'
import { subjectTone, todayDayOfWeek } from '@/lib/format'
import { cn } from '@/lib/utils'

import { slotDetail } from './slot-detail'

function indexSlots(slots) {
  const byKey = new Map()
  for (const slot of slots) byKey.set(`${slot.day_of_week}-${slot.period}`, slot)
  const periods = Math.max(...slots.map((slot) => slot.period))
  return { byKey, periods: Array.from({ length: periods }, (_, i) => i + 1) }
}

function SlotCard({ slot, perspective, className }) {
  return (
    <div
      className={cn(
        'h-full rounded-md border-l-[3px] px-2.5 py-2',
        subjectTone(slot.subject.code),
        className,
      )}
    >
      <p className="text-sm font-medium leading-snug">{slot.subject.name}</p>
      <p className="mt-0.5 truncate text-xs text-muted-foreground">{slotDetail(slot, perspective)}</p>
    </div>
  )
}

export function TimetableGrid({ slots, perspective = 'student' }) {
  const { byKey, periods } = indexSlots(slots)
  const today = todayDayOfWeek()

  return (
    <>
      {/* desktop / tablet: the classic week grid */}
      <div className="hidden overflow-x-auto rounded-lg border bg-card md:block">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="w-16 px-3 py-2.5 text-xs font-medium text-muted-foreground">Period</th>
              {DAYS.map((day) => (
                <th
                  key={day.value}
                  className={cn(
                    'px-2 py-2.5 text-xs font-medium',
                    day.value === today ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {day.short}
                    {day.value === today && (
                      <span className="size-1.5 rounded-full bg-marker" aria-label="today" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((period) => (
              <tr key={period} className="border-b last:border-0">
                <th className="px-3 py-2 align-top text-sm font-medium tabular text-muted-foreground">
                  {period}
                </th>
                {DAYS.map((day) => {
                  const slot = byKey.get(`${day.value}-${period}`)
                  return (
                    <td
                      key={day.value}
                      className={cn('h-[4.5rem] p-1.5 align-top', day.value === today && 'bg-marker/5')}
                    >
                      {slot ? (
                        <SlotCard slot={slot} perspective={perspective} />
                      ) : (
                        <div className="h-full rounded-md border border-dashed border-border/70" />
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* phone: one block per day, today first */}
      <div className="space-y-4 md:hidden">
        {[...DAYS]
          .sort((a, b) => (a.value === today ? -1 : b.value === today ? 1 : a.value - b.value))
          .map((day) => {
            const daySlots = slots
              .filter((slot) => slot.day_of_week === day.value)
              .sort((a, b) => a.period - b.period)
            return (
              <section key={day.value} className="rounded-lg border bg-card p-3">
                <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {day.long}
                  {day.value === today && (
                    <span className="rounded bg-marker/15 px-1.5 py-0.5 text-[0.7rem] font-medium text-marker">
                      Today
                    </span>
                  )}
                </h3>
                {daySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No periods.</p>
                ) : (
                  <ol className="space-y-1.5">
                    {daySlots.map((slot) => (
                      <li key={slot.period} className="flex gap-3">
                        <span className="w-5 pt-2 text-right text-xs tabular text-muted-foreground">
                          {slot.period}
                        </span>
                        <SlotCard slot={slot} perspective={perspective} className="flex-1" />
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            )
          })}
      </div>
    </>
  )
}
