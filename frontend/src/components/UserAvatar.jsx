import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { initials } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONES = [
  'bg-tone-1/15 text-tone-1',
  'bg-tone-2/15 text-tone-2',
  'bg-tone-3/15 text-tone-3',
  'bg-tone-4/15 text-tone-4',
  'bg-tone-5/15 text-tone-5',
  'bg-tone-6/15 text-tone-6',
]

function toneFor(person) {
  const key = person?.id ?? person?.username ?? ''
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TONES[hash % TONES.length]
}

export function UserAvatar({ person, className }) {
  return (
    <Avatar className={cn('size-9', className)}>
      <AvatarFallback className={cn('text-xs font-semibold', toneFor(person))}>
        {initials(person)}
      </AvatarFallback>
    </Avatar>
  )
}
