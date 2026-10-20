import { format, getISODay, isSameDay } from 'date-fns'

import { SUBJECT_TONES } from '@/lib/constants'

export function fullName(person) {
  if (!person) return ''
  return `${person.first_name} ${person.last_name}`.trim()
}

/** Case-insensitive match on first + last name. */
export function matchesName(person, query) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fullName(person).toLowerCase().includes(q)
}

export function initials(person) {
  if (!person) return '?'
  return `${person.first_name?.[0] ?? ''}${person.last_name?.[0] ?? ''}`.toUpperCase()
}

export function classLabel(classroom) {
  if (!classroom) return ''
  return `${classroom.standard}-${classroom.division}`
}

/** 1 = Monday ... 7 = Sunday, same numbering as the timetable. */
export function todayDayOfWeek() {
  return getISODay(new Date())
}

// The usual subjects get hand-picked tones so neighbours in the timetable never look alike
const KNOWN_SUBJECT_TONES = { MATHS: 3, SCI: 1, ENG: 2, SS: 0, HIN: 4, GUJ: 6, PE: 5, EXTRA: 7 }

/** Stable colour per subject code, so Maths looks the same on every page. */
export function subjectTone(code = '') {
  if (code in KNOWN_SUBJECT_TONES) return SUBJECT_TONES[KNOWN_SUBJECT_TONES[code]]
  let hash = 0
  for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return SUBJECT_TONES[hash % SUBJECT_TONES.length]
}

/**
 * Events have no all-day flag in the API. The form saves all-day events as
 * 00:00 -> 23:59 local time, so that's what we treat as all-day here.
 */
export function isAllDay(event) {
  const start = new Date(event.starts_at)
  if (start.getHours() !== 0 || start.getMinutes() !== 0) return false
  if (!event.ends_at) return true
  const end = new Date(event.ends_at)
  return end.getHours() === 23 && end.getMinutes() === 59
}

export function formatEventWhen(event) {
  const start = new Date(event.starts_at)
  const end = event.ends_at ? new Date(event.ends_at) : null
  const allDay = isAllDay(event)

  if (!end || isSameDay(start, end)) {
    if (allDay) return format(start, 'EEE d MMM')
    return end
      ? `${format(start, 'EEE d MMM, HH:mm')} – ${format(end, 'HH:mm')}`
      : format(start, 'EEE d MMM, HH:mm')
  }
  return allDay
    ? `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`
    : `${format(start, 'd MMM, HH:mm')} – ${format(end, 'd MMM, HH:mm')}`
}

export function formatScore(value) {
  if (value === null || value === undefined) return '–'
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

export function greeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
