// Bin collection schedule data and helper functions

// Randers Kommune waste collection types
// Based on actual containers at Ebbeshøjvej 3, Virring, 8960 Randers SØ
export type BinType = 'madaffald' | 'restaffald' | 'papir_pap' | 'plast_metal_glas'

export interface BinInfo {
  id: BinType
  name: string
  shortName: string
  emoji: string
  color: string       // Tailwind text color class
  bgColor: string     // Tailwind background color class
  borderColor: string // Tailwind border color class
  description: string
  frequency: string   // Collection frequency description
}

export const BIN_TYPES: BinInfo[] = [
  {
    id: 'madaffald',
    name: 'Madaffald',
    shortName: 'Mad',
    emoji: '🍎',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-500',
    description: 'Food waste',
    frequency: 'Every 14 days (Mondays)'
  },
  {
    id: 'restaffald',
    name: 'Restaffald',
    shortName: 'Rest',
    emoji: '🗑️',
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-700',
    borderColor: 'border-slate-700',
    description: 'General waste',
    frequency: 'Every 14 days (Mondays)'
  },
  {
    id: 'papir_pap',
    name: 'Papir & Pap',
    shortName: 'Papir',
    emoji: '📦',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-500',
    description: 'Paper & cardboard',
    frequency: 'Every 4 weeks (Tuesdays)'
  },
  {
    id: 'plast_metal_glas',
    name: 'Plast, Metal & Glas',
    shortName: 'PMG',
    emoji: '♻️',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    description: 'Plastic, metal & glass',
    frequency: 'Every 3-4 weeks (Wednesdays)'
  },
]

// 2026 schedule - dates as DD/MM format
// Actual dates from AffaldRanders app for Ebbeshøjvej 3, 8960 Randers SØ
// Last updated: January 2026
export const BIN_SCHEDULE_2026: Record<BinType, string[]> = {
  // Madaffald - Mondays, every 14 days
  madaffald: [
    '12/01', '26/01', '09/02', '23/02', '09/03', '23/03', '06/04',
    '20/04', '04/05', '18/05', '01/06', '15/06', '29/06', '13/07',
    '27/07', '10/08', '24/08', '07/09', '21/09', '05/10', '19/10',
    '02/11', '16/11', '30/11', '14/12', '28/12'
  ],
  // Restaffald - Mondays, every 14 days (same as madaffald)
  restaffald: [
    '12/01', '26/01', '09/02', '23/02', '09/03', '23/03', '06/04',
    '20/04', '04/05', '18/05', '01/06', '15/06', '29/06', '13/07',
    '27/07', '10/08', '24/08', '07/09', '21/09', '05/10', '19/10',
    '02/11', '16/11', '30/11', '14/12', '28/12'
  ],
  // Papir & Pap - Tuesdays, every 4 weeks
  papir_pap: [
    '27/01', '24/02', '24/03', '21/04', '19/05', '16/06', '14/07',
    '11/08', '08/09', '06/10', '03/11', '01/12', '29/12'
  ],
  // Plast, Metal & Glas - Wednesdays, every 3 weeks
  plast_metal_glas: [
    '14/01', '04/02', '25/02', '18/03', '08/04', '29/04', '20/05',
    '10/06', '01/07', '22/07', '12/08', '02/09', '23/09', '14/10',
    '04/11', '25/11', '16/12'
  ],
}

// Helper to get BinInfo by id
export function getBinInfo(binType: BinType): BinInfo {
  return BIN_TYPES.find(b => b.id === binType)!
}

// Parse DD/MM date string to Date object for 2026
function parseDate(dateStr: string): Date {
  const [day, month] = dateStr.split('/').map(Number)
  return new Date(2026, month - 1, day)
}

// Get the next collection date for a specific bin type
export function getNextCollection(binType: BinType): Date | null {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const schedule = BIN_SCHEDULE_2026[binType]

  for (const dateStr of schedule) {
    const date = parseDate(dateStr)
    if (date >= today) {
      return date
    }
  }

  return null
}

// Get days until next collection for a specific bin type
export function getDaysUntilCollection(binType: BinType): number {
  const nextDate = getNextCollection(binType)
  if (!nextDate) return -1

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffTime = nextDate.getTime() - today.getTime()
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// Check if a specific date is a collection day for a bin type
export function isCollectionDay(date: Date, binType: BinType): boolean {
  const schedule = BIN_SCHEDULE_2026[binType]
  const dateStr = `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
  return schedule.includes(dateStr)
}

// Get all bin types being collected on a specific date
export function getBinsForDate(date: Date): BinType[] {
  const bins: BinType[] = []
  for (const binType of BIN_TYPES) {
    if (isCollectionDay(date, binType.id)) {
      bins.push(binType.id)
    }
  }
  return bins
}

// Interface for upcoming collection
export interface UpcomingCollection {
  date: Date
  bins: BinType[]
}

// Get upcoming collections for the next N days
export function getUpcomingCollections(days: number): UpcomingCollection[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const collections: UpcomingCollection[] = []

  for (let i = 0; i <= days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)

    const bins = getBinsForDate(date)
    if (bins.length > 0) {
      collections.push({ date, bins })
    }
  }

  return collections
}

// Get all collections for a specific bin type
export function getAllCollections(binType: BinType): Date[] {
  return BIN_SCHEDULE_2026[binType].map(parseDate)
}

// Format date for display
export function formatCollectionDate(date: Date, locale: string = 'en'): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  }
  return date.toLocaleDateString(locale === 'da' ? 'da-DK' : 'en-GB', options)
}

// Get urgency level based on days until collection
export type UrgencyLevel = 'today' | 'tomorrow' | 'soon' | 'later'

export function getUrgencyLevel(daysUntil: number): UrgencyLevel {
  if (daysUntil === 0) return 'today'
  if (daysUntil === 1) return 'tomorrow'
  if (daysUntil <= 3) return 'soon'
  return 'later'
}

// Get urgency styling based on level
export function getUrgencyStyles(level: UrgencyLevel): { bg: string; text: string; border: string } {
  switch (level) {
    case 'today':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-300 dark:border-red-700'
      }
    case 'tomorrow':
      return {
        bg: 'bg-orange-100 dark:bg-orange-900/30',
        text: 'text-orange-700 dark:text-orange-300',
        border: 'border-orange-300 dark:border-orange-700'
      }
    case 'soon':
      return {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-300 dark:border-amber-700'
      }
    default:
      return {
        bg: 'bg-slate-100 dark:bg-slate-700/50',
        text: 'text-slate-700 dark:text-slate-300',
        border: 'border-slate-200 dark:border-slate-600'
      }
  }
}
