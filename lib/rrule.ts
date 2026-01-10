/**
 * RRULE Utilities for Recurring Events
 *
 * Uses RFC 5545 iCalendar RRULE format
 * Examples:
 *   - FREQ=WEEKLY;BYDAY=TU
 *   - FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE
 *   - FREQ=MONTHLY;BYMONTHDAY=15
 *   - FREQ=WEEKLY;BYDAY=TU;UNTIL=20251231T000000Z
 */

import { RecurrencePattern, RecurrenceFrequency, DAYS_OF_WEEK } from './database.types'
import { addDays, addWeeks, addMonths, addYears, format, parse, isBefore, isAfter, startOfDay } from 'date-fns'

// Day abbreviations for RRULE (RFC 5545 format)
const RRULE_DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']

/**
 * Convert UI RecurrencePattern to RRULE string
 */
export function patternToRRule(pattern: RecurrencePattern, startDate: Date): string {
  const parts: string[] = []

  // Frequency
  parts.push(`FREQ=${pattern.frequency.toUpperCase()}`)

  // Interval (if not 1)
  if (pattern.interval > 1) {
    parts.push(`INTERVAL=${pattern.interval}`)
  }

  // Days of week (for weekly)
  if (pattern.frequency === 'weekly' && pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const days = pattern.daysOfWeek.map(d => RRULE_DAYS[d]).join(',')
    parts.push(`BYDAY=${days}`)
  }

  // Day of month (for monthly)
  if (pattern.frequency === 'monthly' && pattern.dayOfMonth) {
    parts.push(`BYMONTHDAY=${pattern.dayOfMonth}`)
  }

  // End condition
  if (pattern.endType === 'until' && pattern.endDate) {
    // Format as UTC date-time
    const endDateObj = new Date(pattern.endDate)
    endDateObj.setHours(23, 59, 59) // End of day
    const untilStr = format(endDateObj, "yyyyMMdd'T'HHmmss'Z'")
    parts.push(`UNTIL=${untilStr}`)
  } else if (pattern.endType === 'count' && pattern.occurrences) {
    parts.push(`COUNT=${pattern.occurrences}`)
  }

  return parts.join(';')
}

/**
 * Parse RRULE string to UI RecurrencePattern
 */
export function rruleToPattern(rrule: string): RecurrencePattern | null {
  if (!rrule) return null

  const parts = rrule.split(';')
  const rules: Record<string, string> = {}

  for (const part of parts) {
    const [key, value] = part.split('=')
    if (key && value) {
      rules[key] = value
    }
  }

  // Frequency (required)
  const freq = rules['FREQ']?.toLowerCase() as RecurrenceFrequency
  if (!freq || !['daily', 'weekly', 'monthly', 'yearly'].includes(freq)) {
    return null
  }

  const pattern: RecurrencePattern = {
    frequency: freq,
    interval: parseInt(rules['INTERVAL'] || '1', 10),
    endType: 'never',
  }

  // Days of week
  if (rules['BYDAY']) {
    const dayStrs = rules['BYDAY'].split(',')
    pattern.daysOfWeek = dayStrs
      .map(d => RRULE_DAYS.indexOf(d.toUpperCase()))
      .filter(d => d >= 0)
  }

  // Day of month
  if (rules['BYMONTHDAY']) {
    pattern.dayOfMonth = parseInt(rules['BYMONTHDAY'], 10)
  }

  // End condition
  if (rules['UNTIL']) {
    pattern.endType = 'until'
    // Parse RRULE date format: YYYYMMDDTHHMMSSZ
    const untilStr = rules['UNTIL']
    const year = untilStr.substring(0, 4)
    const month = untilStr.substring(4, 6)
    const day = untilStr.substring(6, 8)
    pattern.endDate = `${year}-${month}-${day}`
  } else if (rules['COUNT']) {
    pattern.endType = 'count'
    pattern.occurrences = parseInt(rules['COUNT'], 10)
  }

  return pattern
}

/**
 * Generate next N occurrences from RRULE
 */
export function getOccurrences(
  rrule: string,
  startDate: Date,
  count: number,
  afterDate?: Date
): Date[] {
  const pattern = rruleToPattern(rrule)
  if (!pattern) return []

  const occurrences: Date[] = []
  let current = startOfDay(startDate)
  const after = afterDate ? startOfDay(afterDate) : undefined
  let generated = 0
  const maxIterations = count * 100 // Safety limit

  // For weekly with specific days, we need to handle it differently
  if (pattern.frequency === 'weekly' && pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    let weekStart = current
    let iteration = 0

    while (occurrences.length < count && iteration < maxIterations) {
      iteration++

      // For each week, check all specified days
      for (const dayOfWeek of pattern.daysOfWeek.sort((a, b) => a - b)) {
        // Find the day in the current week
        const currentDayOfWeek = weekStart.getDay()
        let daysToAdd = dayOfWeek - currentDayOfWeek
        if (daysToAdd < 0) daysToAdd += 7

        const occurrenceDate = addDays(weekStart, daysToAdd)

        // Check if this occurrence is valid
        if (!isBefore(occurrenceDate, startDate)) {
          if (!after || !isBefore(occurrenceDate, after)) {
            // Check end conditions
            if (pattern.endType === 'until' && pattern.endDate) {
              if (isAfter(occurrenceDate, new Date(pattern.endDate))) {
                return occurrences
              }
            }
            if (pattern.endType === 'count' && pattern.occurrences) {
              if (generated >= pattern.occurrences) {
                return occurrences
              }
            }

            occurrences.push(occurrenceDate)
            generated++

            if (occurrences.length >= count) {
              return occurrences
            }
          }
        }
      }

      // Move to next interval
      weekStart = addWeeks(weekStart, pattern.interval)
    }
  } else {
    // Simple recurrence (daily, monthly, yearly, or weekly without specific days)
    let iteration = 0

    while (occurrences.length < count && iteration < maxIterations) {
      iteration++

      // Check if current date is valid
      if (!after || !isBefore(current, after)) {
        // Check end conditions
        if (pattern.endType === 'until' && pattern.endDate) {
          if (isAfter(current, new Date(pattern.endDate))) {
            break
          }
        }
        if (pattern.endType === 'count' && pattern.occurrences) {
          if (generated >= pattern.occurrences) {
            break
          }
        }

        occurrences.push(new Date(current))
        generated++
      }

      // Advance to next occurrence
      switch (pattern.frequency) {
        case 'daily':
          current = addDays(current, pattern.interval)
          break
        case 'weekly':
          current = addWeeks(current, pattern.interval)
          break
        case 'monthly':
          current = addMonths(current, pattern.interval)
          // Handle day of month
          if (pattern.dayOfMonth) {
            current.setDate(Math.min(pattern.dayOfMonth, getDaysInMonth(current)))
          }
          break
        case 'yearly':
          current = addYears(current, pattern.interval)
          break
      }
    }
  }

  return occurrences
}

/**
 * Get number of days in a month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Human-readable description of recurrence pattern
 */
export function describeRecurrence(pattern: RecurrencePattern): string {
  const { frequency, interval, daysOfWeek, dayOfMonth, endType, endDate, occurrences } = pattern

  let text = ''

  // Frequency
  if (interval === 1) {
    text = frequency === 'daily' ? 'Every day'
      : frequency === 'weekly' ? 'Every week'
      : frequency === 'monthly' ? 'Every month'
      : 'Every year'
  } else {
    text = frequency === 'daily' ? `Every ${interval} days`
      : frequency === 'weekly' ? `Every ${interval} weeks`
      : frequency === 'monthly' ? `Every ${interval} months`
      : `Every ${interval} years`
  }

  // Days of week
  if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
    const dayNames = daysOfWeek
      .sort((a, b) => a - b)
      .map(d => DAYS_OF_WEEK[d].label)
    if (dayNames.length === 1) {
      text = `Every ${dayNames[0]}`
      if (interval > 1) {
        text = `Every ${interval} weeks on ${dayNames[0]}`
      }
    } else if (dayNames.length === 7) {
      text = interval === 1 ? 'Every day' : `Every ${interval} days`
    } else {
      const daysStr = dayNames.slice(0, -1).join(', ') + ' and ' + dayNames.slice(-1)
      text = interval === 1 ? `Every ${daysStr}` : `Every ${interval} weeks on ${daysStr}`
    }
  }

  // Day of month
  if (frequency === 'monthly' && dayOfMonth) {
    const suffix = dayOfMonth === 1 ? 'st' : dayOfMonth === 2 ? 'nd' : dayOfMonth === 3 ? 'rd' : 'th'
    text += ` on the ${dayOfMonth}${suffix}`
  }

  // End condition
  if (endType === 'until' && endDate) {
    text += `, until ${format(new Date(endDate), 'MMM d, yyyy')}`
  } else if (endType === 'count' && occurrences) {
    text += `, ${occurrences} time${occurrences > 1 ? 's' : ''}`
  }

  return text
}

/**
 * Check if an RRULE is still active (hasn't ended)
 */
export function isRecurrenceActive(rrule: string, startDate: Date): boolean {
  const pattern = rruleToPattern(rrule)
  if (!pattern) return false

  const now = new Date()

  if (pattern.endType === 'until' && pattern.endDate) {
    return !isAfter(now, new Date(pattern.endDate))
  }

  if (pattern.endType === 'count' && pattern.occurrences) {
    const occurrences = getOccurrences(rrule, startDate, pattern.occurrences + 1)
    const lastOccurrence = occurrences[occurrences.length - 1]
    return lastOccurrence ? !isAfter(now, lastOccurrence) : false
  }

  return true // Never ends
}
