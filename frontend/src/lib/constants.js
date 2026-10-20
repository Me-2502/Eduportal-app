// Matches the DB: day_of_week 1=Mon .. 6=Sat
export const DAYS = [
  { value: 1, short: 'Mon', long: 'Monday' },
  { value: 2, short: 'Tue', long: 'Tuesday' },
  { value: 3, short: 'Wed', long: 'Wednesday' },
  { value: 4, short: 'Thu', long: 'Thursday' },
  { value: 5, short: 'Fri', long: 'Friday' },
  { value: 6, short: 'Sat', long: 'Saturday' },
]

// In the order they happen during a year
export const EXAMS = [
  { value: 'unit1', label: 'Unit test 1' },
  { value: 'unit2', label: 'Unit test 2' },
  { value: 'midterm', label: 'Midterm' },
  { value: 'final', label: 'Final' },
]

export const EXAM_LABELS = Object.fromEntries(EXAMS.map((exam) => [exam.value, exam.label]))

export const EVENT_TYPES = [
  { value: 'event', label: 'Event' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'exam', label: 'Exam' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
]

export const EVENT_TYPE_LABELS = Object.fromEntries(EVENT_TYPES.map((type) => [type.value, type.label]))

// Full class names so Tailwind can see them
export const EVENT_TYPE_STYLES = {
  event: { dot: 'bg-ev-event', chip: 'bg-ev-event/12 text-ev-event border-ev-event/25' },
  holiday: { dot: 'bg-ev-holiday', chip: 'bg-ev-holiday/12 text-ev-holiday border-ev-holiday/25' },
  exam: { dot: 'bg-ev-exam', chip: 'bg-ev-exam/12 text-ev-exam border-ev-exam/25' },
  meeting: { dot: 'bg-ev-meeting', chip: 'bg-ev-meeting/12 text-ev-meeting border-ev-meeting/25' },
  other: { dot: 'bg-ev-other', chip: 'bg-ev-other/12 text-ev-other border-ev-other/25' },
}

export const SUBJECT_TONES = [
  'border-l-tone-1 bg-tone-1/8',
  'border-l-tone-2 bg-tone-2/8',
  'border-l-tone-3 bg-tone-3/8',
  'border-l-tone-4 bg-tone-4/8',
  'border-l-tone-5 bg-tone-5/8',
  'border-l-tone-6 bg-tone-6/8',
  'border-l-tone-7 bg-tone-7/8',
  'border-l-tone-8 bg-tone-8/8',
]
