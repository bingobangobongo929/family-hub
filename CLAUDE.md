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
│   ├── layout.tsx          # Root layout with fonts
│   ├── page.tsx            # Main dashboard with widget grid
│   ├── globals.css         # Global styles and CSS variables
│   ├── calendar/           # Calendar page
│   ├── tasks/              # Chores/tasks page
│   ├── shopping/           # Shopping list page
│   ├── notes/              # Notes page
│   ├── routines/           # Routines page
│   ├── rewards/            # Rewards/stars page
│   └── settings/           # Settings page
├── components/
│   ├── AppLayout.tsx       # Main app wrapper with sidebar
│   ├── Sidebar.tsx         # Navigation sidebar
│   └── widgets/            # All dashboard widgets
│       ├── index.tsx       # Widget registry and config
│       ├── ClockWidget.tsx
│       ├── WeatherWidget.tsx
│       ├── ScheduleWidget.tsx
│       ├── ChoresWidget.tsx
│       ├── CountdownWidget.tsx
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
│   └── useWidgetSize.ts    # Widget size detection hook
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
- `calendar_events` - Calendar events with member associations
- `notes` - Pinned notes
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
- `temperatureUnit` - 'celsius' | 'fahrenheit'

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
