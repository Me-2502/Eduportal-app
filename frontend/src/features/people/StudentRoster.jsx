import { Users } from 'lucide-react'

import { EmptyState } from '@/components/states'
import { UserAvatar } from '@/components/UserAvatar'
import { fullName } from '@/lib/format'

/** A class register: roll number + name. `highlightId` marks the current user. */
export function StudentRoster({ students, highlightId, emptyText = 'No students found.' }) {
  if (students.length === 0) {
    return <EmptyState icon={Users} title={emptyText} />
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-20 px-4 py-2.5 font-medium">Roll no.</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {students.map((student) => (
            <tr key={student.id} className={student.id === highlightId ? 'bg-primary/5' : undefined}>
              <td className="px-4 py-2.5 tabular text-muted-foreground">{student.roll_no ?? '–'}</td>
              <td className="px-4 py-2">
                <span className="flex items-center gap-3">
                  <UserAvatar person={student} className="size-7" />
                  <span className="font-medium">{fullName(student)}</span>
                  {student.id === highlightId && (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary">
                      You
                    </span>
                  )}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
