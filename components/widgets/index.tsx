export { default as ClockWidget } from './ClockWidget'
export { default as WeatherWidget } from './WeatherWidget'
export { default as ScheduleWidget } from './ScheduleWidget'
export { default as ChoresWidget } from './ChoresWidget'
export { default as StarsWidget } from './StarsWidget'
export { default as NotesWidget } from './NotesWidget'
export { default as CountdownWidget } from './CountdownWidget'
export { default as MealPlanWidget } from './MealPlanWidget'
export { default as AnnouncementsWidget } from './AnnouncementsWidget'
export { default as QuickActionsWidget } from './QuickActionsWidget'
export { default as PhotoWidget } from './PhotoWidget'
export { default as ShoppingWidget } from './ShoppingWidget'
export { default as TimerWidget } from './TimerWidget'
export { default as BindicatorWidget } from './BindicatorWidget'

// Widget type definitions for the dashboard
export const AVAILABLE_WIDGETS = [
  { id: 'clock', name: 'Clock', icon: '🕐', component: 'ClockWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'weather', name: 'Weather', icon: '🌤️', component: 'WeatherWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'schedule', name: 'Schedule', icon: '📅', component: 'ScheduleWidget', defaultSize: { w: 2, h: 3 }, minSize: { w: 1, h: 1 } },
  { id: 'chores', name: 'Chores', icon: '✅', component: 'ChoresWidget', defaultSize: { w: 2, h: 3 }, minSize: { w: 1, h: 1 } },
  { id: 'stars', name: 'Stars', icon: '⭐', component: 'StarsWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'notes', name: 'Notes', icon: '📌', component: 'NotesWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'countdown', name: 'Countdown', icon: '🎉', component: 'CountdownWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'meals', name: 'Meal Plan', icon: '🍽️', component: 'MealPlanWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'announcements', name: 'Announcements', icon: '📢', component: 'AnnouncementsWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'quickactions', name: 'Quick Add', icon: '➕', component: 'QuickActionsWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'photo', name: 'Photos', icon: '📷', component: 'PhotoWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'routine', name: 'Routine', icon: '☀️', component: 'QuickRoutineWidget', defaultSize: { w: 4, h: 2 }, minSize: { w: 2, h: 1 } },
  { id: 'shopping', name: 'Shopping', icon: '🛒', component: 'ShoppingWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
  { id: 'timer', name: 'Timer', icon: '⏱️', component: 'TimerWidget', defaultSize: { w: 2, h: 3 }, minSize: { w: 1, h: 2 } },
  { id: 'bindicator', name: 'Bins', icon: '🗑️', component: 'BindicatorWidget', defaultSize: { w: 2, h: 2 }, minSize: { w: 1, h: 1 } },
]

// Default layout for new users
export const DEFAULT_LAYOUT = [
  { i: 'clock', x: 0, y: 0, w: 2, h: 2 },
  { i: 'weather', x: 2, y: 0, w: 2, h: 2 },
  { i: 'countdown', x: 4, y: 0, w: 2, h: 2 },
  { i: 'schedule', x: 0, y: 2, w: 2, h: 3 },
  { i: 'chores', x: 2, y: 2, w: 2, h: 3 },
  { i: 'stars', x: 4, y: 2, w: 2, h: 2 },
  { i: 'quickactions', x: 4, y: 4, w: 2, h: 2 },
]
