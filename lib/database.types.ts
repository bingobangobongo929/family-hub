// Family Hub Database Types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ============================================
// FAMILY MEMBERS
// ============================================
export interface FamilyMember {
  id: string
  user_id: string
  name: string
  color: string
  role: 'parent' | 'child' | 'pet'
  avatar: string | null    // Emoji avatar
  photo_url: string | null // Uploaded photo URL
  date_of_birth: string | null // Birthday for profile display
  aliases: string[]        // Alternative names (e.g., "Mum", "Mama", "Chelina")
  description: string | null // Free-form context about this person
  points: number
  stars_enabled: boolean   // Whether stars/points are tracked for this member (can disable for young kids)
  sort_order: number
  created_at: string
  updated_at: string
}

export type InsertFamilyMember = Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>

// Family context for overall family description
export interface FamilyContext {
  id: string
  user_id: string
  context_text: string
  created_at: string
  updated_at: string
}
export type UpdateFamilyMember = Partial<InsertFamilyMember>

// ============================================
// EVENT CATEGORIES
// ============================================
export interface EventCategory {
  id: string
  user_id: string
  name: string
  emoji: string
  color: string
  is_archived: boolean
  is_background: boolean  // Background events show in "This week" section, not "Soon"
  sort_order: number
  created_at: string
  updated_at: string
}

export type InsertEventCategory = Omit<EventCategory, 'id' | 'created_at' | 'updated_at'>
export type UpdateEventCategory = Partial<InsertEventCategory>

export const DEFAULT_EVENT_CATEGORIES = [
  { name: 'Doctors/Hospital', emoji: '🏥', color: '#ef4444', is_background: false },
  { name: 'Guest Daycare', emoji: '👶', color: '#f97316', is_background: true },
  { name: 'Car Service', emoji: '🚗', color: '#6b7280', is_background: false },
  { name: 'Birthday', emoji: '🎂', color: '#ec4899', is_background: false },
  { name: 'School', emoji: '🎒', color: '#3b82f6', is_background: true },
  { name: 'Activities/Lessons', emoji: '🎭', color: '#8b5cf6', is_background: false },
  { name: 'Playdates', emoji: '🎈', color: '#22c55e', is_background: false },
  { name: 'Family Gathering', emoji: '👨‍👩‍👧‍👦', color: '#f59e0b', is_background: false },
  { name: 'Holiday/Vacation', emoji: '✈️', color: '#06b6d4', is_background: true },
  { name: 'Work', emoji: '💼', color: '#64748b', is_background: false },
  { name: 'Pet', emoji: '🐾', color: '#a855f7', is_background: false },
  { name: 'Home Maintenance', emoji: '🔧', color: '#78716c', is_background: false },
  { name: 'Reminder', emoji: '⏰', color: '#eab308', is_background: false },
  { name: 'Misc', emoji: '📌', color: '#94a3b8', is_background: false },
]

// ============================================
// EVENT MEMBERS (Junction Table)
// ============================================
export interface EventMember {
  id: string
  event_id: string
  member_id: string
  created_at: string
}

// ============================================
// CALENDAR EVENTS
// ============================================
export interface CalendarEvent {
  id: string
  user_id: string
  title: string
  description: string | null
  start_time: string
  end_time: string | null
  all_day: boolean
  color: string
  member_id: string | null // Deprecated - use event_members junction table
  category_id: string | null
  location: string | null
  source: 'manual' | 'google' | 'apple' | 'outlook'
  source_id: string | null
  recurrence_rule: string | null
  created_at: string
  updated_at: string
  // Joined data
  member?: FamilyMember // Deprecated
  members?: FamilyMember[] // Multiple board members via event_members
  category?: EventCategory
  contacts?: Contact[] // Extended contacts via event_contacts
}

export type InsertCalendarEvent = Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'member' | 'members' | 'category' | 'contacts'>
export type UpdateCalendarEvent = Partial<InsertCalendarEvent>

// ============================================
// CONTACTS (for birthdays and external people)
// ============================================
export type RelationshipGroup = 'family_us' | 'grandparents' | 'siblings' | 'aunts_uncles' | 'cousins' | 'friends' | 'other'

export interface Contact {
  id: string
  user_id: string
  name: string
  display_name: string | null  // Name shown on calendar/board (e.g., "Mormor" instead of "Hannah")
  date_of_birth: string | null
  relationship_group: RelationshipGroup
  notes: string | null
  color: string
  photo_url: string | null  // Uploaded photo URL
  avatar: string | null     // Emoji avatar
  show_birthday_countdown: boolean  // Show in countdown widget
  created_at: string
  updated_at: string
  // Joined data
  linked_members?: ContactMemberLink[]
}

export type InsertContact = Omit<Contact, 'id' | 'created_at' | 'updated_at' | 'linked_members'>
export type UpdateContact = Partial<InsertContact>

// ============================================
// CONTACT MEMBER LINKS (link contacts to board members)
// ============================================
export interface ContactMemberLink {
  id: string
  contact_id: string
  member_id: string
  relationship_type: string  // User-defined: "Mormor", "Grandma", "Uncle", etc.
  created_at: string
  // Joined data
  member?: FamilyMember
}

export type InsertContactMemberLink = Omit<ContactMemberLink, 'id' | 'created_at' | 'member'>

// ============================================
// EVENT CONTACTS (tag contacts on calendar events)
// ============================================
export interface EventContact {
  id: string
  event_id: string
  contact_id: string
  created_at: string
  // Joined data
  contact?: Contact
}

export type InsertEventContact = Omit<EventContact, 'id' | 'created_at' | 'contact'>

// ============================================
// RECURRENCE PATTERNS (for recurring events)
// ============================================
export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface RecurrencePattern {
  frequency: RecurrenceFrequency
  interval: number           // Every X days/weeks/months (default 1)
  daysOfWeek?: number[]      // 0=Sun, 1=Mon, 2=Tue, etc. (for weekly)
  dayOfMonth?: number        // 1-31 (for monthly)
  endType: 'never' | 'until' | 'count'
  endDate?: string           // ISO date string
  occurrences?: number       // Number of occurrences (for 'count' endType)
}

// Day of week labels for UI
export const DAYS_OF_WEEK = [
  { id: 0, short: 'S', label: 'Sunday' },
  { id: 1, short: 'M', label: 'Monday' },
  { id: 2, short: 'T', label: 'Tuesday' },
  { id: 3, short: 'W', label: 'Wednesday' },
  { id: 4, short: 'T', label: 'Thursday' },
  { id: 5, short: 'F', label: 'Friday' },
  { id: 6, short: 'S', label: 'Saturday' },
]

export const RELATIONSHIP_GROUPS = [
  { id: 'family_us' as const, label: 'Our Family', emoji: '👨‍👩‍👧‍👦' },
  { id: 'grandparents' as const, label: 'Grandparents', emoji: '👴' },
  { id: 'siblings' as const, label: 'Siblings', emoji: '👫' },
  { id: 'aunts_uncles' as const, label: 'Aunts & Uncles', emoji: '👨‍👩‍👧' },
  { id: 'cousins' as const, label: 'Cousins', emoji: '🧒' },
  { id: 'friends' as const, label: 'Friends', emoji: '🤝' },
  { id: 'other' as const, label: 'Other', emoji: '👤' },
]

// ============================================
// COUNTDOWN EVENTS (custom holidays/events)
// ============================================
export type CountdownEventType = 'holiday' | 'event' | 'trip' | 'school' | 'other'

export interface CountdownEvent {
  id: string
  user_id: string
  title: string
  date: string           // ISO date string
  emoji: string
  event_type: CountdownEventType
  is_recurring: boolean  // Repeats annually
  is_active: boolean     // Can be disabled without deleting
  sort_order: number
  created_at: string
  updated_at: string
}

export type InsertCountdownEvent = Omit<CountdownEvent, 'id' | 'created_at' | 'updated_at'>
export type UpdateCountdownEvent = Partial<InsertCountdownEvent>

// Default Danish events to seed for new users
// Note: is_recurring = true means same date every year (e.g., Dec 25)
// is_recurring = false means the date changes yearly (Easter-based, "2nd Sunday of May", etc.)
export const DEFAULT_DANISH_EVENTS: Omit<InsertCountdownEvent, 'user_id'>[] = [
  // Fixed dates (same every year)
  { title: 'Valentinsdag', date: '2026-02-14', emoji: '💕', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 0 },
  { title: 'Grundlovsdag', date: '2026-06-05', emoji: '🇩🇰', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 1 },
  { title: 'Sankt Hans Aften', date: '2026-06-23', emoji: '🔥', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 2 },
  { title: 'Halloween', date: '2026-10-31', emoji: '🎃', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 3 },
  { title: 'Mortensaften', date: '2026-11-10', emoji: '🦆', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 4 },
  { title: 'Luciadag', date: '2026-12-13', emoji: '🕯️', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 5 },
  { title: 'Juleaften', date: '2026-12-24', emoji: '🎄', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 6 },
  { title: 'Nytårsaften', date: '2026-12-31', emoji: '🎆', event_type: 'holiday', is_recurring: true, is_active: true, sort_order: 7 },
  // Floating dates (change yearly - these are 2026 dates, user should update for future years)
  { title: 'Fastelavn', date: '2026-02-15', emoji: '🎭', event_type: 'holiday', is_recurring: false, is_active: true, sort_order: 8 },
  { title: 'Mors Dag', date: '2026-05-10', emoji: '💐', event_type: 'holiday', is_recurring: false, is_active: true, sort_order: 9 },
  { title: 'J-dag', date: '2026-11-06', emoji: '🍺', event_type: 'holiday', is_recurring: false, is_active: true, sort_order: 10 },
  // School holidays (vary by year and municipality - 2026 estimates)
  { title: 'Vinterferie', date: '2026-02-14', emoji: '❄️', event_type: 'school', is_recurring: false, is_active: true, sort_order: 11 },
  { title: 'Efterårsferie', date: '2026-10-10', emoji: '🍂', event_type: 'school', is_recurring: false, is_active: true, sort_order: 12 },
  { title: 'Sommerferie', date: '2026-06-27', emoji: '☀️', event_type: 'school', is_recurring: false, is_active: true, sort_order: 13 },
]

export const COUNTDOWN_EVENT_TYPES = [
  { id: 'holiday' as const, label: 'Holiday', emoji: '🎉' },
  { id: 'event' as const, label: 'Event', emoji: '📅' },
  { id: 'trip' as const, label: 'Trip', emoji: '✈️' },
  { id: 'school' as const, label: 'School', emoji: '🎒' },
  { id: 'other' as const, label: 'Other', emoji: '📌' },
]

// ============================================
// CHORES / TASKS
// ============================================
export interface Chore {
  id: string
  user_id: string
  title: string
  emoji: string
  description: string | null
  assigned_to: string | null
  points: number
  due_date: string | null
  due_time: string | null
  repeat_frequency: 'none' | 'daily' | 'weekly' | 'monthly' | 'custom' | null
  repeat_interval: number
  repeat_days: number[] | null
  status: 'pending' | 'completed' | 'expired' | 'skipped'
  category: string
  sort_order: number
  created_at: string
  completed_at: string | null
  completed_by: string | null
  updated_at: string
  // Joined data
  assignee?: FamilyMember
}

export type InsertChore = Omit<Chore, 'id' | 'created_at' | 'updated_at' | 'assignee'>
export type UpdateChore = Partial<InsertChore>

export const CHORE_CATEGORIES = [
  { id: 'bedroom', emoji: '🛏️', label: 'Bedroom', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300' },
  { id: 'tidying', emoji: '🧹', label: 'Tidying', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  { id: 'meals', emoji: '🍽️', label: 'Meals', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300' },
  { id: 'pets', emoji: '🐾', label: 'Pets', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300' },
  { id: 'gardening', emoji: '🌱', label: 'Garden', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
  { id: 'baby', emoji: '👶', label: 'Baby', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300' },
  { id: 'health', emoji: '💊', label: 'Health', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  { id: 'home', emoji: '🏠', label: 'Home', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { id: 'general', emoji: '✨', label: 'General', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300' },
]

export function getChoreCategoryConfig(categoryId: string) {
  return CHORE_CATEGORIES.find(c => c.id === categoryId) || CHORE_CATEGORIES[CHORE_CATEGORIES.length - 1]
}

// ============================================
// ROUTINES
// ============================================
export type ScheduleType = 'daily' | 'weekdays' | 'weekends' | 'custom' | 'manual'
export type CompletionMode = 'sequential' | 'flexible'

export interface Routine {
  id: string
  user_id: string
  title: string
  emoji: string
  type: 'morning' | 'evening' | 'custom'
  scheduled_time: string | null  // e.g., "19:30" for bedtime
  points_reward: number          // Stars awarded when all steps completed
  is_active: boolean
  sort_order: number
  schedule_type: ScheduleType    // When routine applies: daily, weekdays, weekends, custom, manual
  schedule_days: number[] | null // For custom schedules: [0,1,2,3,4,5,6] where 0=Sun
  completion_mode: CompletionMode // sequential = must complete in order, flexible = any order
  created_at: string
  updated_at: string
  // Legacy field - use routine_members junction table for multi-member support
  assigned_to?: string | null
  // Joined data
  steps?: RoutineStep[]
  members?: FamilyMember[]       // Multiple members can be assigned
  scenarios?: RoutineScenario[]  // Available scenarios for this routine
}

export const SCHEDULE_TYPES = [
  { id: 'daily' as const, label: 'Every Day', emoji: '📅' },
  { id: 'weekdays' as const, label: 'Weekdays (Mon-Fri)', emoji: '💼' },
  { id: 'weekends' as const, label: 'Weekends (Sat-Sun)', emoji: '🌅' },
  { id: 'custom' as const, label: 'Custom Days', emoji: '⚙️' },
  { id: 'manual' as const, label: 'Manual (On Demand)', emoji: '👆' },
]

export const COMPLETION_MODES = [
  { id: 'sequential' as const, label: 'In Order', emoji: '1️⃣', description: 'Steps must be done in sequence' },
  { id: 'flexible' as const, label: 'Any Order', emoji: '🔀', description: 'Complete steps in any order' },
]

export type InsertRoutine = Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'steps' | 'members'>
export type UpdateRoutine = Partial<InsertRoutine>

// Junction table for routine members (who participates in this routine)
export interface RoutineMember {
  id: string
  routine_id: string
  member_id: string
  created_at: string
  // Joined data
  member?: FamilyMember
}

export type InsertRoutineMember = Omit<RoutineMember, 'id' | 'created_at' | 'member'>

export interface RoutineStep {
  id: string
  routine_id: string
  title: string
  emoji: string
  duration_minutes: number       // Optional timer per step (0 = no timer)
  sort_order: number
  scenario_ids: string[] | null  // NULL = always show, array = only for these scenarios
  member_ids: string[] | null    // NULL = all members, array = only for these members
  created_at: string
}

export type InsertRoutineStep = Omit<RoutineStep, 'id' | 'created_at'>

// ============================================
// ROUTINE SCENARIOS
// ============================================
export interface RoutineScenario {
  id: string
  routine_id: string
  name: string
  emoji: string
  is_going_out: boolean         // Used for outdoor-related steps
  is_default_weekday: boolean   // Auto-select on Mon-Fri
  is_default_weekend: boolean   // Auto-select on Sat-Sun
  sort_order: number
  created_at: string
}

export type InsertRoutineScenario = Omit<RoutineScenario, 'id' | 'created_at'>

// ============================================
// ROUTINE DAILY STATE
// Remembers selected scenarios for each day
// ============================================
export interface RoutineDailyState {
  id: string
  routine_id: string
  date: string                  // YYYY-MM-DD
  selected_scenario_ids: string[]
  created_at: string
  updated_at: string
}

export type InsertRoutineDailyState = Omit<RoutineDailyState, 'id' | 'created_at' | 'updated_at'>

// ============================================
// ACTIVE ROUTINE STATE
// Which routine is currently being worked on (synced across devices)
// ============================================
export interface ActiveRoutineState {
  id: string
  user_id: string
  routine_id: string | null
  date: string                  // YYYY-MM-DD
  started_at: string
  started_by: string | null     // User who selected this routine
  updated_at: string
}

export type InsertActiveRoutineState = Omit<ActiveRoutineState, 'id' | 'started_at' | 'updated_at'>

// Track per-member, per-step, per-day completions
export interface RoutineCompletion {
  id: string
  routine_id: string
  step_id: string
  member_id: string              // Which member completed this step
  completed_date: string         // Date string YYYY-MM-DD
  completed_at: string           // Timestamp
}

export type InsertRoutineCompletion = Omit<RoutineCompletion, 'id'>

export const ROUTINE_TYPES = [
  { id: 'morning' as const, label: 'Morning', emoji: '🌅' },
  { id: 'evening' as const, label: 'Bedtime', emoji: '🌙' },
  { id: 'custom' as const, label: 'Custom', emoji: '📋' },
]

// ============================================
// REWARDS
// ============================================
export interface Reward {
  id: string
  user_id: string
  title: string
  emoji: string
  description: string | null
  point_cost: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export type InsertReward = Omit<Reward, 'id' | 'created_at' | 'updated_at'>
export type UpdateReward = Partial<InsertReward>

export interface RewardRedemption {
  id: string
  reward_id: string
  member_id: string
  points_spent: number
  redeemed_at: string
  // Joined data
  reward?: Reward
  member?: FamilyMember
}

// ============================================
// NOTES
// ============================================
export interface Note {
  id: string
  user_id: string
  title: string | null
  content: string
  color: string
  pinned: boolean
  author_id: string | null
  created_at: string
  updated_at: string
  // Joined data
  author?: FamilyMember
}

export type InsertNote = Omit<Note, 'id' | 'created_at' | 'updated_at' | 'author'>
export type UpdateNote = Partial<InsertNote>

export const NOTE_COLORS = [
  { id: 'yellow', color: '#fef3c7', label: 'Yellow' },
  { id: 'blue', color: '#dbeafe', label: 'Blue' },
  { id: 'green', color: '#dcfce7', label: 'Green' },
  { id: 'pink', color: '#fce7f3', label: 'Pink' },
  { id: 'purple', color: '#e0e7ff', label: 'Purple' },
  { id: 'orange', color: '#ffedd5', label: 'Orange' },
]

// ============================================
// DASHBOARD
// ============================================
export interface DashboardPage {
  id: string
  user_id: string
  name: string
  sort_order: number
  created_at: string
  updated_at: string
  // Joined data
  widgets?: DashboardWidget[]
}

export interface WidgetLayout {
  x: number
  y: number
  w: number
  h: number
}

export interface DashboardWidget {
  id: string
  page_id: string
  widget_type: string
  title: string | null
  config: Record<string, unknown>
  layout_lg: WidgetLayout
  layout_md: WidgetLayout
  layout_sm: WidgetLayout
  created_at: string
  updated_at: string
}

export type InsertDashboardWidget = Omit<DashboardWidget, 'id' | 'created_at' | 'updated_at'>
export type UpdateDashboardWidget = Partial<InsertDashboardWidget>

export const WIDGET_TYPES = [
  { id: 'clock', name: 'Clock', icon: '🕐', description: 'Large digital clock with date', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
  { id: 'weather', name: 'Weather', icon: '🌤️', description: 'Current weather conditions', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
  { id: 'schedule', name: 'Daily Schedule', icon: '📅', description: "Today's events timeline", minW: 2, minH: 3, defaultW: 2, defaultH: 4 },
  { id: 'calendar', name: 'Calendar', icon: '📆', description: 'Mini calendar view', minW: 2, minH: 3, defaultW: 3, defaultH: 4 },
  { id: 'chores', name: 'Chores', icon: '✅', description: "Today's chores list", minW: 2, minH: 2, defaultW: 2, defaultH: 3 },
  { id: 'routines', name: 'Routines', icon: '📋', description: 'Active routine progress', minW: 2, minH: 2, defaultW: 2, defaultH: 3 },
  { id: 'rewards', name: 'Stars & Rewards', icon: '⭐', description: 'Points leaderboard', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
  { id: 'notes', name: 'Pinboard', icon: '📌', description: 'Pinned family notes', minW: 2, minH: 2, defaultW: 2, defaultH: 3 },
  { id: 'shopping', name: 'Shopping', icon: '🛒', description: 'Shopping list preview', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
  { id: 'timer', name: 'Timer', icon: '⏱️', description: 'Fun countdown timers with sounds', minW: 2, minH: 2, defaultW: 2, defaultH: 3 },
  { id: 'countdown', name: 'Countdown', icon: '🎂', description: 'Days until birthdays & events', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
  { id: 'streaks', name: 'Streaks', icon: '🔥', description: 'Routine completion streaks', minW: 2, minH: 2, defaultW: 2, defaultH: 2 },
]

export function getWidgetType(id: string) {
  return WIDGET_TYPES.find(w => w.id === id)
}

// ============================================
// APP SETTINGS
// ============================================
export interface AppSetting {
  id: string
  user_id: string
  key: string
  value: Json
  updated_at: string
}

export const DEFAULT_SETTINGS: Record<string, Json> = {
  theme: 'light',
  screensaver_enabled: true,
  screensaver_timeout: 300,
  screensaver_mode: 'dashboard',
  sleep_start: '22:00',
  sleep_end: '06:00',
  weather_location: 'Randers, Denmark',
  weather_unit: 'celsius',
  dashboard_background: 'default',
  dashboard_gradient: 'warm',
  rewards_enabled: false, // Star/points reward system for kids
  ai_model: 'claude', // 'claude' or 'gemini' for calendar AI
  google_calendar_auto_push: false, // Auto-push events to Google Calendar
  countdown_relationship_groups: ['family_us', 'grandparents', 'friends'], // Filter for birthday widget
  show_birthdays_on_calendar: true, // Show birthday events on calendar
  // Google Photos settings
  google_photos_album_id: null, // Selected album for widget and gallery
  google_photos_album_title: null, // Album title for display
  google_photos_rotation_interval: 10, // Seconds between photo rotation in widget
  // Sidebar settings
  sidebar_nav_order: null, // Custom order for sidebar navigation items (array of hrefs)
}

// Preset gradient options for dashboard backgrounds
export const DASHBOARD_GRADIENTS = [
  { id: 'default', name: 'Default', class: '' },
  { id: 'warm', name: 'Warm Sunset', class: 'from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20' },
  { id: 'cool', name: 'Cool Ocean', class: 'from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20' },
  { id: 'nature', name: 'Fresh Nature', class: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20' },
  { id: 'lavender', name: 'Lavender Dreams', class: 'from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20' },
  { id: 'rose', name: 'Rose Garden', class: 'from-rose-50 to-pink-50 dark:from-rose-950/20 dark:to-pink-950/20' },
  { id: 'sage', name: 'Sage Calm', class: 'from-sage-50 to-emerald-50 dark:from-sage-950/20 dark:to-emerald-950/20' },
]

// ============================================
// SHOPPING LIST (from recipe-vault integration)
// ============================================
export interface ShoppingList {
  id: string
  user_id: string
  name: string
  share_token: string | null
  is_shared: boolean
  created_at: string
  updated_at: string
}

export interface ShoppingListItem {
  id: string
  list_id: string
  item_name: string
  quantity: number | null
  unit: string | null
  category: string | null
  recipe_id: string | null
  recipe_name: string | null
  recipe_quantities: Json | null
  is_checked: boolean
  is_pantry_staple: boolean
  is_manual: boolean
  sort_order: number
  created_at: string
}

export type InsertShoppingListItem = Omit<ShoppingListItem, 'id' | 'created_at'>

export interface RecipeQuantity {
  recipe_name: string
  quantity: number
  unit: string
}

export interface ShoppingItemWithBreakdown extends ShoppingListItem {
  recipe_breakdown?: RecipeQuantity[]
}

// Category display configuration
export const CATEGORY_CONFIG: Record<string, { color: string; emoji: string }> = {
  produce: { color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300', emoji: '🥬' },
  dairy: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', emoji: '🥛' },
  meat: { color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300', emoji: '🥩' },
  seafood: { color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300', emoji: '🐟' },
  bakery: { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', emoji: '🍞' },
  pantry: { color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', emoji: '🥫' },
  frozen: { color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300', emoji: '🧊' },
  beverages: { color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300', emoji: '🥤' },
  household: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', emoji: '🧹' },
  health: { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', emoji: '💊' },
  baby: { color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/50 dark:text-pink-300', emoji: '👶' },
  pet: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', emoji: '🐾' },
  other: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300', emoji: '📦' },
}

export function getCategoryConfig(category: string | null) {
  const key = (category || 'other').toLowerCase()
  return CATEGORY_CONFIG[key] || CATEGORY_CONFIG.other
}

// ============================================
// USER PREFERENCES (synced per-user settings)
// ============================================
export type ThemePreference = 'light' | 'dark' | 'system'
export type LocalePreference = 'en' | 'da'

export interface UserPreferences {
  id: string
  user_id: string
  theme: ThemePreference
  locale: LocalePreference
  created_at: string
  updated_at: string
}

export type InsertUserPreferences = Omit<UserPreferences, 'id' | 'created_at' | 'updated_at'>
export type UpdateUserPreferences = Partial<InsertUserPreferences>

// ============================================
// ROUTINE COMPLETION LOG (immutable audit trail)
// ============================================
export type CompletionAction = 'completed' | 'uncompleted' | 'skipped'

export interface RoutineCompletionLog {
  id: string
  routine_id: string
  step_id: string
  member_id: string
  completed_date: string        // Date string YYYY-MM-DD
  completed_at: string          // Timestamp
  completed_by: string | null   // User who marked it (parent tracking for child)
  action: CompletionAction
  notes: string | null          // Optional context: "sick day", "forgot", etc.
  // Joined data
  routine?: Routine
  step?: RoutineStep
  member?: FamilyMember
}

export type InsertRoutineCompletionLog = Omit<RoutineCompletionLog, 'id' | 'routine' | 'step' | 'member'>

// ============================================
// MEMBER STREAKS (cached streak calculations)
// ============================================
export interface MemberStreak {
  id: string
  member_id: string
  routine_id: string
  current_streak: number
  longest_streak: number
  last_completed_date: string | null
  streak_started_date: string | null
  updated_at: string
  // Joined data
  member?: FamilyMember
  routine?: Routine
}

export type InsertMemberStreak = Omit<MemberStreak, 'id' | 'updated_at' | 'member' | 'routine'>
export type UpdateMemberStreak = Partial<InsertMemberStreak>

// ============================================
// POINTS HISTORY (audit trail for all point changes)
// ============================================
export type PointsReason =
  | 'routine_completed'
  | 'chore_completed'
  | 'reward_redeemed'
  | 'manual_adjustment'
  | 'streak_bonus'

export type PointsReferenceType = 'routine' | 'chore' | 'reward' | null

export interface PointsHistory {
  id: string
  member_id: string
  points_change: number         // Positive or negative
  reason: PointsReason
  reference_id: string | null   // routine_id, chore_id, reward_id, or null
  reference_type: PointsReferenceType
  notes: string | null          // Optional description
  created_at: string
  created_by: string | null     // User who made the change
  // Joined data
  member?: FamilyMember
}

export type InsertPointsHistory = Omit<PointsHistory, 'id' | 'created_at' | 'member'>

// ============================================
// MEMBER COLORS (for assignment)
// ============================================
export const MEMBER_COLORS = [
  { id: 'blue', color: '#3b82f6', label: 'Blue' },
  { id: 'pink', color: '#ec4899', label: 'Pink' },
  { id: 'purple', color: '#8b5cf6', label: 'Purple' },
  { id: 'green', color: '#22c55e', label: 'Green' },
  { id: 'orange', color: '#f97316', label: 'Orange' },
  { id: 'red', color: '#ef4444', label: 'Red' },
  { id: 'teal', color: '#14b8a6', label: 'Teal' },
  { id: 'amber', color: '#f59e0b', label: 'Amber' },
  { id: 'indigo', color: '#6366f1', label: 'Indigo' },
  { id: 'cyan', color: '#06b6d4', label: 'Cyan' },
  { id: 'lime', color: '#84cc16', label: 'Lime' },
  { id: 'rose', color: '#f43f5e', label: 'Rose' },
  { id: 'violet', color: '#7c3aed', label: 'Violet' },
  { id: 'sky', color: '#0ea5e9', label: 'Sky' },
  { id: 'emerald', color: '#10b981', label: 'Emerald' },
  { id: 'fuchsia', color: '#d946ef', label: 'Fuchsia' },
  { id: 'slate', color: '#64748b', label: 'Slate' },
  { id: 'stone', color: '#78716c', label: 'Stone' },
  { id: 'coral', color: '#ff6b6b', label: 'Coral' },
  { id: 'mint', color: '#4ecdc4', label: 'Mint' },
]
