# Family Hub - Project Context

## Overview
Family Hub is a family dashboard application designed for touchscreen displays (like wall-mounted tablets). It provides widgets for managing family schedules, chores, meals, shopping lists, and more. The design is inspired by Cozyla and Skylight with a modern, family-friendly aesthetic.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom design system
- **Database:** Supabase (dual database architecture)
- **Drag/Resize:** react-grid-layout
- **Date Handling:** date-fns
- **Icons:** lucide-react

## Project Structure
```
family-hub/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with fonts and providers
│   ├── page.tsx            # Main dashboard with widget grid
│   ├── globals.css         # Global styles and CSS variables
│   ├── api/
│   │   ├── calendar-ai/    # AI event extraction API (Claude/Gemini)
│   │   └── google-calendar/ # Google Calendar OAuth & sync
│   ├── calendar/           # Calendar page with AI smart add
│   ├── contacts/           # Contacts & birthdays management
│   ├── tasks/              # Chores/tasks page
│   ├── shopping/           # Shopping list page
│   ├── notes/              # Notes page
│   ├── routines/           # Routines page
│   ├── rewards/            # Rewards/stars page
│   └── settings/           # Settings page
├── components/
│   ├── AppLayout.tsx       # Main app wrapper with sidebar
│   ├── Sidebar.tsx         # Navigation sidebar
│   ├── AICalendarInput.tsx # AI-powered event extraction modal
│   ├── CategorySelector.tsx # Event category dropdown
│   ├── MemberMultiSelect.tsx # Multi-member chip selector
│   ├── MemberAvatarStack.tsx # Stacked member avatars display
│   └── widgets/            # All dashboard widgets
│       ├── index.tsx       # Widget registry and config
│       ├── ClockWidget.tsx
│       ├── WeatherWidget.tsx
│       ├── ScheduleWidget.tsx
│       ├── ChoresWidget.tsx
│       ├── CountdownWidget.tsx # Uses contacts for birthdays
│       ├── NotesWidget.tsx
│       ├── StarsWidget.tsx
│       ├── MealPlanWidget.tsx
│       ├── AnnouncementsWidget.tsx
│       ├── QuickActionsWidget.tsx
│       ├── PhotoWidget.tsx
│       ├── ShoppingWidget.tsx
│       └── TimerWidget.tsx
├── lib/
│   ├── supabase.ts         # Supabase clients (dual DB)
│   ├── database.types.ts   # TypeScript types for DB
│   ├── auth-context.tsx    # Authentication context
│   ├── family-context.tsx  # Family members context
│   ├── settings-context.tsx # App settings context
│   ├── categories-context.tsx # Event categories context
│   ├── contacts-context.tsx # Contacts & birthdays context
│   └── useWidgetSize.ts    # Widget size detection hook
├── supabase/
│   └── migrations/         # Database migration files
│       ├── 001_initial.sql
│       └── 002_calendar_enhancements.sql
└── tailwind.config.ts      # Tailwind with custom theme
```

## Design System

### Color Palette
- **Primary Accent:** Teal (`teal-500: #14b8a6`)
- **Secondary Accent:** Coral/Orange (`#f97316`)
- **Light Background:** Warm off-white (`warm-50: #FFFEF9`)
- **Dark Background:** Slate (`slate-900` to `slate-800`)

### Theme-Specific Colors
| Widget Type | Theme Colors |
|-------------|--------------|
| Default/Info | Teal gradient |
| Rewards/Stars | Amber/Orange (kept for association) |
| Food (Meals, Shopping) | Orange/Amber gradient |
| Important alerts | Rose/Red |

### Typography
- **Display Font:** Poppins (headings, widget titles) - use `font-display` class
- **Body Font:** Inter (UI text, content)

### Shadows
- `shadow-widget` - Standard widget shadow
- `shadow-widget-hover` - Elevated hover state
- `shadow-widget-dark` - Dark mode shadow

### Border Radius
- Widgets/Cards: `rounded-3xl` (24px)
- Buttons/Inputs: `rounded-xl` (12px)
- Small elements: `rounded-lg` (8px)

### Touch Targets
- Minimum 44x44px for all interactive elements
- Generous padding on buttons and clickable areas

## Widget System

### Widget Registry (`components/widgets/index.tsx`)
All widgets are registered in `AVAILABLE_WIDGETS` with:
- `id`: Unique identifier
- `name`: Display name
- `component`: React component
- `minSize`: Minimum grid size `{ w: 1, h: 1 }` (all widgets support 1x1)
- `defaultSize`: Default grid size

### Widget Size Hook (`useWidgetSize`)
Widgets use `useWidgetSize()` hook for responsive behavior:
```tsx
const [ref, { size, isWide, isTall }] = useWidgetSize()
// size: 'small' | 'medium' | 'large' | 'xlarge'
// isWide: boolean (width > height)
// isTall: boolean (height > width)
```

### Widget Layout Pattern
```tsx
<div
  ref={ref}
  className="h-full flex flex-col p-4 bg-white dark:bg-slate-800 rounded-3xl shadow-widget dark:shadow-widget-dark"
>
  {/* Header */}
  <div className="flex items-center gap-2 mb-3">
    <Icon className="w-4 h-4 text-teal-500" />
    <h3 className="font-display font-semibold text-slate-800 dark:text-slate-100">Title</h3>
  </div>

  {/* Content */}
  <div className="flex-1 overflow-hidden">
    {/* Widget content */}
  </div>
</div>
```

## Database Architecture

### Dual Supabase Setup
1. **Family Hub Database** - Main app data (family members, chores, calendar, notes, etc.)
2. **Recipe Vault Database** - Shopping lists (shared with separate Recipe Vault app)

```tsx
// lib/supabase.ts
export const supabase = createClient(...)           // Family Hub
export const recipeVaultSupabase = createClient(...) // Recipe Vault
```

### Environment Variables
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL=
NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_ANON_KEY=
```

### Key Database Tables
- `family_members` - Family member profiles with colors and roles
- `chores` - Chore definitions with assignments and points
- `calendar_events` - Calendar events with category and member associations
- `event_categories` - Customizable event categories with emoji and color
- `event_members` - Junction table for multiple members per event
- `contacts` - External contacts with birthdays and relationship groups
- `notes` - Pinned notes
- `app_settings` - User settings (AI model, auto-push, etc.)
- `user_integrations` - OAuth tokens for Google Calendar
- `shopping_list_items` - Shopping list (Recipe Vault DB)

## Contexts

### AuthContext (`useAuth`)
- `user` - Current Supabase user (null for demo mode)
- `signIn`, `signOut` - Auth methods

### FamilyContext (`useFamily`)
- `members` - Array of family members
- `getMember(id)` - Get member by ID
- `updateMemberPoints(id, delta)` - Update reward points

### SettingsContext (`useSettings`)
- `rewardsEnabled` - Toggle for rewards/stars system
- `aiModel` - 'claude' | 'gemini' for AI event extraction
- `googleCalendarAutoPush` - Auto-sync events to Google Calendar
- `showBirthdaysOnCalendar` - Display contact birthdays on calendar
- `countdownRelationshipGroups` - Which contacts appear in birthday widget

### CategoriesContext (`useCategories`)
- `categories` - Array of event categories
- `getCategory(id)` - Get category by ID
- `getCategoryByName(name)` - Get category by name (for AI matching)
- `addCategory`, `updateCategory`, `archiveCategory` - CRUD operations

### ContactsContext (`useContacts`)
- `contacts` - Array of contacts
- `getContactsByGroup(group)` - Filter contacts by relationship group
- `getUpcomingBirthdays(days, groups)` - Get birthdays within N days
- `addContact`, `updateContact`, `deleteContact` - CRUD operations

## Demo Mode
When no user is authenticated, widgets display demo data (defined as `DEMO_*` constants in each widget). This allows the app to be showcased without a database connection.

## Key Patterns

### Component Styling
- Always use `dark:` variants for dark mode support
- Use `transition-colors` or `transition-all` for smooth interactions
- Interactive elements: `hover:scale-[1.02] active:scale-[0.98]`

### Data Fetching
- Use `useCallback` for fetch functions
- Use `useEffect` with fetch function as dependency
- Fallback to demo data on error

### Responsive Widgets
- Check `size` from `useWidgetSize()` to adjust content
- Use `compactMode` boolean for small widgets
- Limit items shown based on size (`maxItems` pattern)

## Development Notes

### Running Locally
```bash
npm install
npm run dev
```

### Building
```bash
npm run build
```

### Target Device
Primary target is touchscreen tablets/displays, but fully functional with mouse/keyboard for development.

## Recent Changes (January 2025)
- Complete UI redesign with teal color scheme
- Changed from sage-green/coral to teal-primary palette
- Added Poppins font for headings
- Updated all 13 widgets with consistent styling
- Changed widget minimum size from 2x2 to 1x1
- Added custom shadow system

## Recent Changes (January 2026)
### AI Calendar Enhancements
- **Smart Add**: AI-powered event extraction from text or images (screenshots)
- **AI Model Selection**: Choose between Claude Sonnet 4.5 or Gemini 3 Flash in settings
- **Category System**: 14 default categories (Doctors, School, Birthday, etc.) with emoji and color
- **Multi-Member Events**: Assign multiple family members to a single event
- **Google Calendar Auto-Push**: Automatically sync new events to Google Calendar

### Contacts & Birthdays
- New `/contacts` page for managing birthdays and external contacts
- Relationship groups: Our Family, Grandparents, Siblings, Aunts/Uncles, Cousins, Friends, Other
- CountdownWidget now uses contacts for birthday countdowns
- Settings to filter which groups appear in birthday countdown widget

### New Components
- `CategorySelector` - Dropdown with emoji and color display
- `MemberMultiSelect` - Multi-select chip component for family members
- `MemberAvatarStack` - Stacked avatar display for multiple members
- `CategoryPill` - Compact category indicator with emoji

### Database Migration (002_calendar_enhancements.sql)
Run in Supabase SQL Editor to add:
- `event_categories` table with default categories seeding
- `event_members` junction table for multi-member support
- `contacts` table with relationship groups
- `category_id` column on `calendar_events`

### New Environment Variables
```env
ANTHROPIC_API_KEY=         # For Claude AI
GOOGLE_AI_API_KEY=         # For Gemini AI
GOOGLE_CLIENT_ID=          # For Google Calendar OAuth
GOOGLE_CLIENT_SECRET=      # For Google Calendar OAuth
```
