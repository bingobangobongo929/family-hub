# Family Hub - Project Context

## Overview
Family Hub is a family dashboard application designed for touchscreen displays (like wall-mounted tablets). It provides widgets for managing family schedules, chores, meals, shopping lists, and more. The design is inspired by Cozyla and Skylight with a modern, family-friendly aesthetic.

## Tech Stack
- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS with custom design system
- **Database:** Supabase (dual database architecture)
- **Drag/Resize:** react-grid-layout (desktop only)
- **Date Handling:** date-fns with locale support
- **Icons:** lucide-react
- **i18n:** Custom React Context solution (English/Danish)
- **Mobile App:** Capacitor (iOS with push notifications)

## Project Structure
```
family-hub/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout with fonts and providers
│   ├── page.tsx            # Main dashboard with widget grid
│   ├── globals.css         # Global styles and CSS variables
│   ├── api/
│   │   ├── calendar-ai/    # AI event extraction API (Claude/Gemini)
│   │   ├── f1/             # Formula 1 data APIs
│   │   │   ├── next/       # Next race info
│   │   │   ├── schedule/   # Season schedule
│   │   │   └── standings/  # Driver/constructor standings
│   │   ├── google-calendar/ # Google Calendar OAuth & sync
│   │   ├── google-photos/  # Google Photos integration
│   │   │   ├── albums/     # Album listing
│   │   │   ├── auth/       # OAuth flow
│   │   │   ├── callback/   # OAuth callback
│   │   │   └── photos/     # Photo fetching
│   │   └── notifications/  # Push notification APIs
│   │       ├── send/       # Send notifications
│   │       └── triggers/   # Cron-triggered notifications
│   │           ├── events/ # Event reminders (every 15 min)
│   │           ├── bins/   # Bin day reminders (7pm daily)
│   │           └── chores/ # Chore reminders (9am daily)
│   ├── bindicator/         # Bin collection schedule page
│   ├── calendar/           # Calendar page with AI smart add
│   ├── contacts/           # Contacts & birthdays management
│   ├── f1/                 # Formula 1 tracking page
│   ├── gallery/            # Google Photos gallery page
│   ├── login/              # Authentication page
│   ├── notes/              # Notes page
│   ├── rewards/            # Rewards/stars page
│   ├── routines/           # Routines page
│   ├── settings/           # Settings page
│   ├── shopping/           # Shopping list page
│   └── tasks/              # Chores/tasks page
├── components/
│   ├── AICalendarInput.tsx     # AI-powered event extraction modal
│   ├── AlbumSelector.tsx       # Google Photos album picker
│   ├── AppLayout.tsx           # Main app wrapper with sidebar
│   ├── Card.tsx                # Reusable card component
│   ├── CategorySelector.tsx    # Event category dropdown
│   ├── ContactMemberLink.tsx   # Link contacts to family members
│   ├── EmojiPicker.tsx         # Emoji selection component
│   ├── EventDetailModal.tsx    # Calendar event detail view/edit
│   ├── ImageCropper.tsx        # Avatar image cropping
│   ├── LanguageToggle.tsx      # EN/DA language switcher
│   ├── MemberAvatarStack.tsx   # Stacked member avatars display
│   ├── MemberMultiSelect.tsx   # Multi-member chip selector
│   ├── MemberProfileModal.tsx  # Family member profile editor
│   ├── PhotoLightbox.tsx       # Fullscreen photo viewer
│   ├── PhotoUpload.tsx         # Photo upload with cropping
│   ├── RecurrenceSelector.tsx  # Recurring event pattern selector
│   ├── Screensaver.tsx         # Idle screensaver (clock/photos/gradient)
│   ├── Sidebar.tsx             # Navigation sidebar with language toggle
│   ├── ui/
│   │   ├── Button.tsx          # Styled button component
│   │   └── Modal.tsx           # Modal dialog component
│   └── widgets/                # All dashboard widgets
│       ├── index.tsx           # Widget registry and config
│       ├── AnnouncementsWidget.tsx
│       ├── BindicatorWidget.tsx    # Bin collection countdown
│       ├── ChoresWidget.tsx
│       ├── ClockWidget.tsx
│       ├── CountdownWidget.tsx     # Birthday/event countdowns
│       ├── F1Widget.tsx            # Formula 1 next race
│       ├── GooglePhotosWidget.tsx  # Google Photos slideshow
│       ├── MealPlanWidget.tsx
│       ├── NotesWidget.tsx
│       ├── PhotoWidget.tsx
│       ├── QuickActionsWidget.tsx
│       ├── ScheduleWidget.tsx
│       ├── ShoppingWidget.tsx
│       ├── StarsWidget.tsx
│       ├── TimerWidget.tsx
│       └── WeatherWidget.tsx
├── lib/
│   ├── auth-context.tsx        # Authentication context
│   ├── bin-schedule.ts         # Bin collection schedule data & helpers
│   ├── categories-context.tsx  # Event categories context
│   ├── contacts-context.tsx    # Contacts & birthdays context
│   ├── database.types.ts       # TypeScript types for DB
│   ├── date-locale.ts          # date-fns locale mapping for i18n
│   ├── edit-mode-context.tsx   # Dashboard edit mode state
│   ├── encryption.ts           # Token encryption utilities
│   ├── f1-api.ts               # Formula 1 API client (Jolpica/OpenF1)
│   ├── family-context.tsx      # Family members context
│   ├── google-auth.ts          # Google OAuth helpers
│   ├── i18n-context.tsx        # Internationalization context (EN/DA)
│   ├── push-context.tsx        # Push notification context (iOS)
│   ├── push-notifications.ts   # Capacitor push notification utilities
│   ├── rrule.ts                # RFC 5545 recurrence rule utilities
│   ├── settings-context.tsx    # App settings context
│   ├── supabase.ts             # Supabase clients (dual DB)
│   ├── theme-context.tsx       # Light/dark/system theme context
│   └── useWidgetSize.ts        # Widget size detection hook
├── messages/                   # Translation files
│   ├── en.ts                   # English translations
│   └── da.ts                   # Danish translations
├── ios/                        # Capacitor iOS project
│   └── App/                    # Xcode project files
├── supabase/
│   └── migrations/             # Database migration files
│       ├── 001_family_hub_schema.sql
│       ├── 002_calendar_enhancements.sql
│       ├── 003_recurring_and_contacts.sql
│       ├── 004_contacts_avatar.sql
│       ├── 005_member_birthdays.sql
│       ├── 006_countdown_events.sql
│       ├── 007_user_integrations.sql
│       ├── 008_contact_display_name.sql
│       ├── 009_widget_layouts.sql      # Cross-device widget layout sync
│       └── 20240115_push_tokens.sql    # Push notification tokens
├── capacitor.config.ts         # Capacitor configuration for iOS
├── vercel.json                 # Vercel config with cron jobs
├── IOS_SETUP.md                # iOS app setup documentation
└── tailwind.config.ts          # Tailwind with custom theme
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
- `icon`: Emoji icon for widget picker
- `component`: React component name
- `minSize`: Minimum grid size `{ w: 1, h: 1 }` (all widgets support 1x1)
- `defaultSize`: Default grid size

### Available Widgets (17 total)
| ID | Name | Default Size | Description |
|----|------|--------------|-------------|
| clock | Clock | 2x2 | Current time display |
| weather | Weather | 2x2 | Weather forecast |
| schedule | Week Ahead | 2x3 | Upcoming calendar events |
| chores | Chores | 2x3 | Task/chore list |
| stars | Stars | 2x2 | Reward points tracker |
| notes | Notes | 2x2 | Pinned notes |
| countdown | Countdown | 2x2 | Birthday/event countdowns |
| meals | Meal Plan | 2x2 | Weekly meal planning |
| announcements | Announcements | 2x2 | Family announcements |
| quickactions | Quick Add | 2x2 | Quick add buttons |
| photo | Photos | 2x2 | Local photo display |
| shopping | Shopping | 2x2 | Shopping list |
| timer | Timer | 2x3 | Countdown timers |
| bindicator | Bindicator | 2x2 | Bin collection schedule |
| googlephotos | Google Photos | 2x2 | Google Photos slideshow |
| f1 | Formula 1 | 2x2 | Next F1 race countdown |
| routine | Routine | 4x2 | Morning/evening routine tracker |

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

### Mobile vs Desktop Layout
The dashboard uses different layout systems for mobile and desktop:

**Desktop (768px+):**
- Uses react-grid-layout with drag-and-drop
- Configurable widget positions and sizes
- Layout saved to database for cross-device sync

**Mobile (< 768px):**
- Uses simple CSS grid (1-2 columns)
- Widgets stack vertically with sensible min-heights
- No drag/resize (not practical on touch)
- Min-heights by widget type:
  - Tall (schedule, chores, f1, timer, routine): 280px
  - Medium (countdown, notes, shopping, bindicator): 220px
  - Compact (clock, weather, etc): 180px

## Internationalization (i18n)

### Setup
Custom React Context solution supporting English and Danish:

```tsx
// lib/i18n-context.tsx
const { t, locale, setLocale } = useTranslation()

// Usage
<h1>{t('dashboard.greeting.morning')}</h1>
<span>{t('common.more', { count: 5 })}</span> // "+5 more"
```

### Translation Files
Located in `messages/` folder:
- `en.ts` - English (default)
- `da.ts` - Danish

Organized by domain: `common`, `nav`, `dashboard`, `calendar`, `chores`, `shopping`, `bins`, `f1`, etc.

### Date Formatting with Locales
```tsx
import { format } from 'date-fns'
import { getDateLocale } from '@/lib/date-locale'

const { locale } = useTranslation()
format(date, 'EEEE, d MMMM', { locale: getDateLocale(locale) })
// English: "Monday, 14 January"
// Danish: "mandag 14. januar"
```

### Language Toggle
Flag button in sidebar header switches between EN/DA. Preference saved to localStorage.

## Database Architecture

### Dual Supabase Setup
1. **Family Hub Database** - Main app data (family members, chores, calendar, notes, etc.)
2. **Recipe Vault Database** - Shopping lists (shared with separate Recipe Vault app)

```tsx
// lib/supabase.ts
export const supabase = createClient(...)           // Family Hub
export const recipeVaultSupabase = createClient(...) // Recipe Vault
```

### Key Database Tables
- `family_members` - Family member profiles with colors, roles, photos, and birthdays
- `chores` - Chore definitions with assignments and points
- `calendar_events` - Calendar events with category, recurrence, and member associations
- `event_categories` - Customizable event categories with emoji and color
- `event_members` - Junction table for multiple members per event
- `event_contacts` - Junction table for tagging contacts on events
- `contacts` - External contacts with birthdays and relationship groups
- `contact_member_links` - Link contacts to family members (e.g., "Grandma" linked to "Olivia")
- `notes` - Pinned notes
- `app_settings` - User settings
- `user_integrations` - OAuth tokens for Google Calendar/Photos
- `widget_layouts` - Cross-device widget layout sync (user_id, active_widgets, layouts)
- `push_tokens` - iOS push notification tokens
- `shopping_list_items` - Shopping list (Recipe Vault DB)

### Storage Buckets
- `avatars` - Family member profile photos
- `contact-photos` - Contact profile photos

## iOS App (Capacitor)

### Setup
The app uses Capacitor to wrap the web app for iOS distribution:

```bash
npx cap sync ios    # Sync web assets to iOS
npx cap open ios    # Open in Xcode
```

### Configuration (`capacitor.config.ts`)
- **Server Mode**: Loads from Vercel URL (not bundled assets)
- **Push Notifications**: Configured for APNs
- **App ID**: `com.familyhub.app`

### Push Notifications
- Event reminders (15 min before)
- Bin day reminders (7pm night before)
- Chore reminders (9am daily)

See `IOS_SETUP.md` for complete setup guide.

## Contexts

### Provider Hierarchy (in layout.tsx)
```tsx
<ThemeProvider>
  <I18nProvider>
    <AuthProvider>
      <FamilyProvider>
        <SettingsProvider>
          <CategoriesProvider>
            <ContactsProvider>
              <EditModeProvider>
                <PushProvider>
                  {children}
                </PushProvider>
              </EditModeProvider>
            </ContactsProvider>
          </CategoriesProvider>
        </SettingsProvider>
      </FamilyProvider>
    </AuthProvider>
  </I18nProvider>
</ThemeProvider>
```

### AuthContext (`useAuth`)
- `user` - Current Supabase user (null for demo mode)
- `signIn`, `signOut` - Auth methods

### ThemeContext (`useTheme`)
- `theme` - Current theme: 'light' | 'dark' | 'system'
- `toggleTheme` - Toggle between light/dark
- `setTheme` - Set specific theme

### I18nContext (`useTranslation`)
- `t(key, params?)` - Get translated string
- `locale` - Current locale: 'en' | 'da'
- `setLocale` - Change language

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
- `googlePhotosAlbumId` - Selected Google Photos album
- `googlePhotosAlbumTitle` - Album display name
- `googlePhotosRotationInterval` - Slideshow interval (seconds)
- `sidebarNavOrder` - Custom sidebar navigation order

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

### EditModeContext (`useEditMode`)
- `isEditMode` - Whether dashboard is in edit mode
- `toggleEditMode` - Toggle edit mode on/off

Note: In edit mode, widgets have `pointer-events-none` to prevent accidental clicks while dragging. Close button is enlarged (w-10 h-10) for easy tapping.

## Environment Variables
```env
# Supabase - Family Hub Database
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Supabase - Recipe Vault Database (shared shopping list)
NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_URL=
NEXT_PUBLIC_RECIPE_VAULT_SUPABASE_ANON_KEY=

# AI Services
ANTHROPIC_API_KEY=              # For Claude AI calendar parsing
GOOGLE_AI_API_KEY=              # For Gemini AI calendar parsing

# Google OAuth (Calendar & Photos)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Security
ENCRYPTION_KEY=                 # For encrypting OAuth tokens

# App
NEXT_PUBLIC_APP_URL=            # App URL for OAuth callbacks

# Push Notifications (iOS)
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_AUTH_KEY=                  # Contents of .p8 file
CRON_SECRET=                    # Secret for cron job auth
```

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

### Recurring Events (RRULE)
Events support RFC 5545 recurrence rules via `lib/rrule.ts`:
- `patternToRRule(pattern, startDate)` - Convert UI pattern to RRULE string
- `rruleToPattern(rrule)` - Parse RRULE to UI pattern
- `generateOccurrences(rrule, startDate, rangeStart, rangeEnd)` - Expand occurrences

### Widget Layout Sync
Widget layouts are synced to database for cross-device consistency:
- Saved to `widget_layouts` table with user_id
- Debounced saves (500ms) to prevent excessive writes
- Falls back to localStorage for non-logged-in users
- Migration from localStorage to DB on first login

## Calendar Views
The calendar supports multiple view modes:
- **Month**: Traditional month grid
- **Week**: 7-day view
- **Day**: Single day focus
- **Agenda**: Scrollable list of upcoming events (30 days)

On mobile, defaults to Agenda view for better usability. Month view is optimized to fit screen without scrolling.

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

### iOS Development
```bash
npx cap sync ios    # Sync after web changes
npx cap open ios    # Open Xcode
```

### Target Device
Primary target is touchscreen tablets/displays, but fully functional with mouse/keyboard for development.

## Feature Summary

### Core Features
- **Dashboard**: Customizable widget grid with drag-and-drop layout (desktop) / CSS grid (mobile)
- **Calendar**: Event management with AI-powered natural language input, multiple view modes
- **Chores/Tasks**: Task assignments with optional reward points
- **Shopping List**: Shared with Recipe Vault app
- **Contacts**: Manage birthdays and relationships

### Integrations
- **Google Calendar**: Two-way sync with auto-push option
- **Google Photos**: Album slideshow widget and gallery page
- **AI Calendar Input**: Parse events from text/images using Claude or Gemini

### Specialty Features
- **Bindicator**: Bin collection schedule for 2026 (configurable in `lib/bin-schedule.ts`)
- **Formula 1**: Race calendar, countdowns, and standings via Jolpica/OpenF1 APIs
- **Screensaver**: Idle screen with clock, photo slideshow, or gradient modes
- **Push Notifications**: iOS notifications for events, bins, and chores

### User Experience
- **Dark Mode**: System-aware with manual toggle
- **Internationalization**: English and Danish language support
- **Edit Mode**: Lock/unlock dashboard for safe touchscreen use
- **Responsive Widgets**: Adapt content based on widget size
- **Touch-Optimized**: Large tap targets for touchscreen use
- **Cross-Device Sync**: Widget layouts sync across devices when logged in
