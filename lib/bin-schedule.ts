// Bin collection schedule data and helper functions

export type BinType = 'bio' | 'main' | 'paper' | 'plastic'

export interface BinInfo {
  id: BinType
  name: string
  shortName: string
  emoji: string
  color: string       // Tailwind text color class
  bgColor: string     // Tailwind background color class
  borderColor: string // Tailwind border color class
  description: string
}

export const BIN_TYPES: BinInfo[] = [
  {
    id: 'bio',
    name: 'Bio Bin',
    shortName: 'Bio',
    emoji: '🌿',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-500',
    borderColor: 'border-green-500',
    description: 'Garden & Food Waste'
  },
  {
    id: 'main',
    name: 'Main Bin',
    shortName: 'Main',
    emoji: '🗑️',
    color: 'text-slate-600 dark:text-slate-300',
    bgColor: 'bg-slate-700',
    borderColor: 'border-slate-700',
    description: 'General Waste'
  },
  {
    id: 'paper',
    name: 'Paper Recycling',
    shortName: 'Paper',
    emoji: '📦',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500',
    borderColor: 'border-blue-500',
    description: 'Paper & Cardboard'
  },
  {
    id: 'plastic',
    name: 'PMG Recycling',
    shortName: 'PMG',
    emoji: '♻️',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500',
    borderColor: 'border-emerald-500',
    description: 'Plastic, Metal & Glass'
  },
]

// 2026 schedule - dates as DD/MM format
export const BIN_SCHEDULE_2026: Record<BinType, string[]> = {
  bio: [
    '06/01', '20/01', '03/02', '17/02', '03/03', '17/03', '31/03',
    '14/04', '28/04', '12/05', '26/05', '09/06', '23/06', '07/07',
    '21/07', '04/08', '18/08', '01/09', '15/09', '29/09', '13/10',
    '27/10', '09/11', '23/11', '07/12', '21/12'
  ],
  main: [
    '06/01', '20/01', '03/02', '17/02', '03/03', '17/03', '31/03',
    '14/04', '28/04', '12/05', '26/05', '09/06', '23/06', '07/07',
    '21/07', '04/08', '18/08', '01/09', '15/09', '29/09', '13/10',
    '27/10', '09/11', '23/11', '07/12', '21/12'
  ],
  paper: [
    '14/01', '11/02', '10/03', '07/04', '05/05', '02/06', '30/06',
    '28/07', '25/08', '22/09', '20/10', '17/11', '15/12'
  ],
  plastic: [
    '08/01', '22/01', '05/02', '19/02', '05/03', '19/03', '02/04',
    '16/04', '30/04', '14/05', '28/05', '11/06', '25/06', '09/07',
    '23/07', '06/08', '20/08', '03/09', '17/09', '01/10', '15/10',
    '29/10', '12/11', '26/11', '10/12'
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
export function formatCollectionDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    day: 'numeric',
    month: 'short'
  }
  return date.toLocaleDateString('en-GB', options)
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
