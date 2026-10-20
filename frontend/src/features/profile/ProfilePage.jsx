import { toast } from 'sonner'

import { PageHeader } from '@/components/PageHeader'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/features/auth/auth-context'
import { ChangePasswordForm } from '@/features/auth/ChangePasswordForm'
import { useMyClassroom } from '@/features/people/api'
import { classLabel, fullName } from '@/lib/format'

const GENDERS = { M: 'Male', F: 'Female', O: 'Other' }
const ROLES = { student: 'Student', faculty: 'Faculty', admin: 'Administrator' }

function Detail({ label, children }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children || <span className="text-muted-foreground">–</span>}</dd>
    </>
  )
}

export function ProfilePage() {
  const { user, isStudent, isFaculty } = useAuth()
  const { classroom } = useMyClassroom()

  return (
    <>
      <PageHeader title="Profile" description="Your details as the school has them." />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-5">
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar person={user} className="size-14 text-base" />
            <div>
              <p className="font-serif text-xl font-semibold">{fullName(user)}</p>
              <p className="text-sm text-muted-foreground">
                {ROLES[user.role]}
                {user.is_hod && ' · Head of department'}
              </p>
            </div>
          </div>
          <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2.5 text-sm">
            <Detail label="Username">
              <span className="font-mono text-[0.8rem]">{user.username}</span>
            </Detail>
            <Detail label="Email">{user.email}</Detail>
            <Detail label="Gender">{GENDERS[user.gender]}</Detail>
            {isStudent && (
              <>
                <Detail label="Class">{classroom && `${classLabel(classroom)} · Room ${classroom.room_no}`}</Detail>
                <Detail label="Roll number">{user.roll_no}</Detail>
              </>
            )}
            {isFaculty && <Detail label="Class teacher of">{classroom && `Class ${classLabel(classroom)}`}</Detail>}
          </dl>
          <p className="mt-5 text-xs text-muted-foreground">
            Something wrong here? The school office can correct it.
          </p>
        </section>

        <section className="rounded-lg border bg-card p-5">
          <h2 className="font-medium">Change password</h2>
          <p className="mb-5 text-sm text-muted-foreground">You&apos;ll stay signed in on this device.</p>
          <ChangePasswordForm onDone={() => toast.success('Password changed.')} />
        </section>
      </div>
    </>
  )
}
