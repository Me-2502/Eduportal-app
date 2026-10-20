import { classLabel, fullName } from '@/lib/format'

/**
 * The second line of a timetable slot, depending on who is looking:
 *  - "student": who teaches it
 *  - "faculty": which class and room
 */
export function slotDetail(slot, perspective) {
  if (perspective === 'faculty') {
    return `Class ${classLabel(slot.classroom)} · Room ${slot.classroom.room_no}`
  }
  return fullName(slot.faculty)
}
