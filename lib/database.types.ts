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
  avatar: string | null
  points: number
  sort_order: number
  created_at: string
  updated_at: string
}

export type InsertFamilyMember = Omit<FamilyMember, 'id' | 'created_at' | 'updated_at'>
export type UpdateFamilyMember = Partial<InsertFamilyMember>

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
  member_id: string | null
  location: string | null
  source: 'manual' | 'google' | 'apple' | 'outlook'
  source_id: string | null
  recurrence_rule: string | null
  created_at: string
  updated_at: string
  // Joined data
  member?: FamilyMember
}

export type InsertCalendarEvent = Omit<CalendarEvent, 'id' | 'created_at' | 'updated_at' | 'member'>
export type UpdateCalendarEvent = Partial<InsertCalendarEvent>

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
export interface Routine {
  id: string
  user_id: string
  title: string
  emoji: string
  type: 'morning' | 'evening' | 'custom'
  assigned_to: string | null
  scheduled_time: string | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // Joined data
  steps?: RoutineStep[]
  assignee?: FamilyMember
}

export type InsertRoutine = Omit<Routine, 'id' | 'created_at' | 'updated_at' | 'steps' | 'assignee'>
export type UpdateRoutine = Partial<InsertRoutine>

export interface RoutineStep {
  id: string
  routine_id: string
  title: string
  emoji: string
  duration_minutes: number
  sort_order: number
  created_at: string
}

export type InsertRoutineStep = Omit<RoutineStep, 'id' | 'created_at'>

export interface RoutineCompletion {
  id: string
  routine_id: string
  step_id: string
  completed_date: string
  completed_by: string | null
  completed_at: string
}

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
  screensaver_mode: 'clock',
  sleep_start: '22:00',
  sleep_end: '06:00',
  weather_location: 'Randers, Denmark',
  weather_unit: 'celsius',
  dashboard_background: 'default',
  dashboard_gradient: 'warm',
  rewards_enabled: false, // Star/points reward system for kids
  ai_model: 'claude', // 'claude' or 'gemini' for calendar AI
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
]
