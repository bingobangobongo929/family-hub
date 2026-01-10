'use client'

import { useState, useMemo } from 'react'
import { Repeat, Calendar, ChevronDown } from 'lucide-react'
import { RecurrencePattern, RecurrenceFrequency, DAYS_OF_WEEK } from '@/lib/database.types'

interface RecurrenceSelectorProps {
  value: RecurrencePattern | null
  onChange: (pattern: RecurrencePattern | null) => void
  startDate?: Date
}

const FREQUENCY_OPTIONS: { value: RecurrenceFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export default function RecurrenceSelector({
  value,
  onChange,
  startDate = new Date(),
}: RecurrenceSelectorProps) {
  // Default pattern if none provided
  const pattern = value || {
    frequency: 'weekly' as RecurrenceFrequency,
    interval: 1,
    daysOfWeek: [startDate.getDay()],
    endType: 'never' as const,
  }

  const updatePattern = (updates: Partial<RecurrencePattern>) => {
    onChange({ ...pattern, ...updates })
  }

  // Human-readable summary
  const summary = useMemo(() => {
    if (!value) return ''

    const { frequency, interval, daysOfWeek, endType, endDate, occurrences } = value

    let text = ''

    // Frequency part
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

    // Days of week (for weekly)
    if (frequency === 'weekly' && daysOfWeek && daysOfWeek.length > 0) {
      const dayNames = daysOfWeek
        .sort((a, b) => a - b)
        .map(d => DAYS_OF_WEEK[d].label)
      if (dayNames.length === 1) {
        text += ` on ${dayNames[0]}`
      } else if (dayNames.length === 7) {
        text = 'Every day'
      } else {
        text += ` on ${dayNames.slice(0, -1).join(', ')} and ${dayNames.slice(-1)}`
      }
    }

    // End part
    if (endType === 'until' && endDate) {
      text += `, until ${new Date(endDate).toLocaleDateString()}`
    } else if (endType === 'count' && occurrences) {
      text += `, ${occurrences} times`
    }

    return text
  }, [value])

  return (
    <div className="space-y-4">
      {/* Summary display */}
      {value && (
        <div className="flex items-center gap-2 p-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl">
          <Repeat className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-medium text-teal-700 dark:text-teal-300">{summary}</span>
        </div>
      )}

      {/* Frequency */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Repeat
        </label>
        <div className="grid grid-cols-4 gap-2">
          {FREQUENCY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => updatePattern({ frequency: option.value })}
              className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                pattern.frequency === option.value
                  ? 'bg-teal-500 text-white shadow-lg'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interval */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Every
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min="1"
            max="99"
            value={pattern.interval}
            onChange={(e) => updatePattern({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
            className="w-20 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-center text-lg font-medium"
          />
          <span className="text-slate-600 dark:text-slate-400">
            {pattern.frequency === 'daily' ? (pattern.interval === 1 ? 'day' : 'days')
              : pattern.frequency === 'weekly' ? (pattern.interval === 1 ? 'week' : 'weeks')
              : pattern.frequency === 'monthly' ? (pattern.interval === 1 ? 'month' : 'months')
              : (pattern.interval === 1 ? 'year' : 'years')}
          </span>
        </div>
      </div>

      {/* Days of Week (for weekly) */}
      {pattern.frequency === 'weekly' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            On these days
          </label>
          <div className="flex gap-2">
            {DAYS_OF_WEEK.map((day) => {
              const isSelected = pattern.daysOfWeek?.includes(day.id)
              return (
                <button
                  key={day.id}
                  type="button"
                  onClick={() => {
                    const current = pattern.daysOfWeek || []
                    const updated = isSelected
                      ? current.filter(d => d !== day.id)
                      : [...current, day.id]
                    // Ensure at least one day is selected
                    if (updated.length > 0) {
                      updatePattern({ daysOfWeek: updated })
                    }
                  }}
                  className={`w-11 h-11 rounded-xl text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-teal-500 text-white shadow-lg'
                      : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                  title={day.label}
                >
                  {day.short}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Day of Month (for monthly) */}
      {pattern.frequency === 'monthly' && (
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
            On day
          </label>
          <select
            value={pattern.dayOfMonth || startDate.getDate()}
            onChange={(e) => updatePattern({ dayOfMonth: parseInt(e.target.value) })}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <option key={day} value={day}>
                {day}{day === 1 ? 'st' : day === 2 ? 'nd' : day === 3 ? 'rd' : 'th'} of the month
              </option>
            ))}
          </select>
        </div>
      )}

      {/* End Options */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Ends
        </label>
        <div className="space-y-3">
          {/* Never */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
            <input
              type="radio"
              name="endType"
              checked={pattern.endType === 'never'}
              onChange={() => updatePattern({ endType: 'never', endDate: undefined, occurrences: undefined })}
              className="w-5 h-5 text-teal-500"
            />
            <span className="text-slate-700 dark:text-slate-300">Never</span>
          </label>

          {/* Until date */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
            <input
              type="radio"
              name="endType"
              checked={pattern.endType === 'until'}
              onChange={() => updatePattern({ endType: 'until', occurrences: undefined })}
              className="w-5 h-5 text-teal-500"
            />
            <span className="text-slate-700 dark:text-slate-300 flex-shrink-0">Until</span>
            {pattern.endType === 'until' && (
              <input
                type="date"
                value={pattern.endDate || ''}
                onChange={(e) => updatePattern({ endDate: e.target.value })}
                min={startDate.toISOString().split('T')[0]}
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100"
              />
            )}
          </label>

          {/* After X occurrences */}
          <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700">
            <input
              type="radio"
              name="endType"
              checked={pattern.endType === 'count'}
              onChange={() => updatePattern({ endType: 'count', endDate: undefined, occurrences: 10 })}
              className="w-5 h-5 text-teal-500"
            />
            <span className="text-slate-700 dark:text-slate-300 flex-shrink-0">After</span>
            {pattern.endType === 'count' && (
              <>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={pattern.occurrences || 10}
                  onChange={(e) => updatePattern({ occurrences: Math.max(1, parseInt(e.target.value) || 1) })}
                  className="w-20 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 text-center"
                />
                <span className="text-slate-700 dark:text-slate-300">times</span>
              </>
            )}
          </label>
        </div>
      </div>
    </div>
  )
}

// Compact recurrence badge for display
interface RecurrenceBadgeProps {
  pattern: RecurrencePattern
  className?: string
}

export function RecurrenceBadge({ pattern, className = '' }: RecurrenceBadgeProps) {
  const label = useMemo(() => {
    const { frequency, interval, daysOfWeek } = pattern

    if (frequency === 'daily') {
      return interval === 1 ? 'Daily' : `Every ${interval} days`
    }
    if (frequency === 'weekly') {
      if (interval === 1 && daysOfWeek?.length === 1) {
        return DAYS_OF_WEEK[daysOfWeek[0]].label
      }
      return interval === 1 ? 'Weekly' : `Every ${interval} weeks`
    }
    if (frequency === 'monthly') {
      return interval === 1 ? 'Monthly' : `Every ${interval} months`
    }
    return interval === 1 ? 'Yearly' : `Every ${interval} years`
  }, [pattern])

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 ${className}`}>
      <Repeat className="w-3 h-3" />
      {label}
    </span>
  )
}
