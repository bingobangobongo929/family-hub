# Family Hub iOS Widgets - Complete Implementation Plan

## Overview

Building 7 iOS widgets using WidgetKit (SwiftUI). Widgets read from a **shared local cache** (not Supabase directly) that the main app keeps updated.

---

## Widget Inventory

| Widget | Sizes | Data Source | Refresh Frequency |
|--------|-------|-------------|-------------------|
| Shopping List | Small, Medium | shopping_items | On change + 15 min |
| Today's Events | Medium, Large | calendar_events | Hourly + event times |
| Routine Status | Small | routines + completions | On change + 15 min |
| Next Event | Small | calendar_events | Every 15 min |
| F1 Countdown | Small | f1_schedule | Hourly (more on race weekend) |
| Bin Day | Small | bin_schedule | Daily |
| Quick Actions | Medium | None (buttons only) | Static |

---

## Architecture

### Data Flow
```
┌─────────────────────────────────────────────────────────────────┐
│                         YOUR PHONE                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐ │
│  │  Supabase    │────▶│   Family Hub    │────▶│   Shared     │ │
│  │  (Cloud)     │     │   Main App      │     │   Container  │ │
│  └──────────────┘     └─────────────────┘     └──────────────┘ │
│                              │                       │          │
│                              │ trigger               │ read     │
│                              ▼                       ▼          │
│                       ┌─────────────────────────────────┐       │
│                       │        iOS Widgets              │       │
│                       │  (Shopping, Events, F1, etc.)   │       │
│                       └─────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        WIFE'S PHONE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐     ┌─────────────────┐     ┌──────────────┐ │
│  │  Supabase    │────▶│   Family Hub    │────▶│   Shared     │ │
│  │  (Cloud)     │     │   Main App      │     │   Container  │ │
│  └──────────────┘     └─────────────────┘     └──────────────┘ │
│         │                    ▲                       │          │
│         │                    │                       │ read     │
│         │              ┌─────┴─────┐                 ▼          │
│         │              │  Silent   │         ┌──────────────┐   │
│         └─────────────▶│   Push    │────────▶│   Widgets    │   │
│          "data changed"│  (wakes)  │ refresh └──────────────┘   │
│                        └───────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Sync Triggers (When widgets update on wife's phone)

1. **She opens the app** → Immediate sync → Widget refresh
2. **Silent push notification** → Background sync → Widget refresh (15-30 min)
3. **iOS background app refresh** → Sync if app has permission (not guaranteed)
4. **Widget timeline** → Reads from cache (may be stale if app hasn't synced)

### Worst Case Scenario
Wife adds item → Your widget: updates in ~1 min
You add item → Wife's widget: updates when she opens app OR within ~30 min if silent push works

---

## Shared Data Storage

### App Group
```
group.com.familyhub.app
```

Both main app and widget extension must be in this App Group.

### Shared Container Files
```
/shared/
├── widget_shopping.json      # Shopping list items
├── widget_events.json        # Calendar events (today + tomorrow)
├── widget_routines.json      # Routines with completion status
├── widget_f1.json            # Next F1 session
├── widget_bins.json          # Next bin collection
└── widget_meta.json          # Last update timestamp, user info
```

### Data Models

```swift
// MARK: - Shopping
struct WidgetShoppingData: Codable {
    let items: [WidgetShoppingItem]
    let updatedAt: Date
}

struct WidgetShoppingItem: Codable {
    let id: String
    let name: String
    let checked: Bool
    let quantity: Int?
    let category: String?
    let emoji: String?
}

// MARK: - Events
struct WidgetEventsData: Codable {
    let today: [WidgetEvent]
    let tomorrow: [WidgetEvent]
    let updatedAt: Date
}

struct WidgetEvent: Codable {
    let id: String
    let title: String
    let startTime: Date
    let endTime: Date?
    let isAllDay: Bool
    let emoji: String?
    let color: String?
    let location: String?
}

// MARK: - Routines
struct WidgetRoutinesData: Codable {
    let routines: [WidgetRoutine]
    let updatedAt: Date
}

struct WidgetRoutine: Codable {
    let id: String
    let title: String
    let emoji: String
    let type: String  // "morning", "evening"
    let scheduleType: String  // "weekdays", "weekends", "daily"
    let scheduledTime: String?  // "07:00"
    let totalSteps: Int
    let completedSteps: Int
    let isActive: Bool  // Currently in progress
    let appliesToday: Bool
}

// MARK: - F1
struct WidgetF1Data: Codable {
    let nextSession: WidgetF1Session?
    let isRaceWeekend: Bool
    let updatedAt: Date
}

struct WidgetF1Session: Codable {
    let sessionType: String  // "Race", "Qualifying", "Sprint", "Practice 1"
    let grandPrix: String    // "Australian Grand Prix"
    let circuitName: String  // "Albert Park"
    let country: String      // "Australia"
    let countryCode: String  // "AU" for flag
    let startTime: Date
    let isLive: Bool
}

// MARK: - Bins
struct WidgetBinsData: Codable {
    let nextCollection: WidgetBinCollection?
    let updatedAt: Date
}

struct WidgetBinCollection: Codable {
    let binType: String      // "general", "recycling", "garden", "food"
    let displayName: String  // "Recycling"
    let emoji: String        // "♻️"
    let color: String        // "#22C55E"
    let collectionDate: Date
    let isToday: Bool
    let isTomorrow: Bool
}

// MARK: - Metadata
struct WidgetMeta: Codable {
    let lastFullSync: Date
    let userId: String?
    let familyId: String?
    let locale: String  // "en" or "da"
}
```

---

## Widget Designs

### 1. Shopping List Widget

**Small (2x2)** - Count only
```
┌─────────────────────┐
│ 🛒                  │
│                     │
│       7             │
│     items           │
│                     │
│ ───────────────     │
│ Updated 5 min ago   │
└─────────────────────┘
```

**Medium (4x2)** - List preview
```
┌─────────────────────────────────────────────┐
│ 🛒 Shopping                        7 items  │
│─────────────────────────────────────────────│
│ ○ Milk                                      │
│ ○ Bread                                     │
│ ○ Eggs                                      │
│ ○ Bananas                         +3 more   │
└─────────────────────────────────────────────┘
```

**Empty State:**
```
┌─────────────────────┐
│ 🛒                  │
│                     │
│       ✓             │
│   List empty        │
│                     │
└─────────────────────┘
```

**Deep Link:** `familyhub://shopping`

---

### 2. Today's Events Widget

**Medium (4x2)** - Today only
```
┌─────────────────────────────────────────────┐
│ 📅 Today                       Sun, Jan 19  │
│─────────────────────────────────────────────│
│ 09:00  🏥 Doctor appointment                │
│ 14:00  👶 Playdate with Emma                │
│ 18:00  🍕 Pizza night                       │
└─────────────────────────────────────────────┘
```

**Large (4x4)** - Today + Tomorrow
```
┌─────────────────────────────────────────────┐
│ 📅 Today                       Sun, Jan 19  │
│─────────────────────────────────────────────│
│ 09:00  🏥 Doctor appointment                │
│ 14:00  👶 Playdate with Emma                │
│ 18:00  🍕 Pizza night                       │
│─────────────────────────────────────────────│
│ Tomorrow                                    │
│ 10:00  🛒 Grocery shopping                  │
│ 15:00  🎂 Birthday party                    │
│                                             │
└─────────────────────────────────────────────┘
```

**Empty State:**
```
┌─────────────────────────────────────────────┐
│ 📅 Today                       Sun, Jan 19  │
│─────────────────────────────────────────────│
│                                             │
│            No events today                  │
│            Enjoy your free day! 🎉          │
│                                             │
└─────────────────────────────────────────────┘
```

**Deep Link:** `familyhub://calendar`

---

### 3. Routine Status Widget

**Small (2x2)** - Active routine
```
┌─────────────────────┐
│ ☀️ Morning          │
│                     │
│    ●●●○○           │
│    3/5 done         │
│                     │
│ Tap to continue     │
└─────────────────────┘
```

**Small (2x2)** - Next routine (none active)
```
┌─────────────────────┐
│ 🌙 Bedtime          │
│                     │
│   Starts at         │
│    7:30 PM          │
│                     │
│    in 2h 15m        │
└─────────────────────┘
```

**Small (2x2)** - All done
```
┌─────────────────────┐
│ ✨ Routines         │
│                     │
│       ✓             │
│   All done          │
│   for today!        │
│                     │
└─────────────────────┘
```

**Deep Link:** `familyhub://routines`

---

### 4. Next Event Countdown Widget

**Small (2x2)**
```
┌─────────────────────┐
│ ⏰ Up Next          │
│                     │
│ 🏥 Doctor           │
│                     │
│   2h 15m            │
│                     │
└─────────────────────┘
```

**Now/Soon variant:**
```
┌─────────────────────┐
│ ⏰ NOW              │
│                     │
│ 🏥 Doctor           │
│  appointment        │
│                     │
│ Started 5m ago      │
└─────────────────────┘
```

**Empty State:**
```
┌─────────────────────┐
│ ⏰ Up Next          │
│                     │
│       📭            │
│  Nothing planned    │
│                     │
└─────────────────────┘
```

**Deep Link:** `familyhub://calendar`

---

### 5. F1 Countdown Widget

**Small (2x2)** - Countdown
```
┌─────────────────────┐
│ 🏎️ F1               │
│                     │
│ 🇦🇺 Race            │
│                     │
│  3d 4h 22m          │
│                     │
└─────────────────────┘
```

**Small (2x2)** - Race weekend (session soon)
```
┌─────────────────────┐
│ 🏎️ F1               │
│                     │
│ 🇦🇺 Qualifying      │
│                     │
│   in 45m            │
│ Don't miss it!      │
└─────────────────────┘
```

**Small (2x2)** - Live now
```
┌─────────────────────┐
│ 🏎️ LIVE 🔴          │
│                     │
│ 🇦🇺 Race            │
│ Australian GP       │
│                     │
│ Watch now!          │
└─────────────────────┘
```

**Off-season:**
```
┌─────────────────────┐
│ 🏎️ F1               │
│                     │
│   Off Season        │
│                     │
│ Testing starts      │
│   Feb 26            │
└─────────────────────┘
```

**Deep Link:** `familyhub://f1`

---

### 6. Bin Day Widget

**Small (2x2)** - Tomorrow
```
┌─────────────────────┐
│ 🗑️ Bin Day          │
│                     │
│ ♻️ Recycling        │
│                     │
│   Tomorrow          │
│ Put out tonight     │
└─────────────────────┘
```

**Small (2x2)** - Today (urgent!)
```
┌─────────────────────┐
│ 🗑️ TODAY!           │
│  ─────────────      │
│                     │
│ ♻️ Recycling        │
│                     │
│ Put out NOW         │
└─────────────────────┘
```
(Background changes to bin color for urgency)

**Small (2x2)** - Not soon
```
┌─────────────────────┐
│ 🗑️ Bins             │
│                     │
│ ♻️ Recycling        │
│                     │
│   Thursday          │
│   in 4 days         │
└─────────────────────┘
```

**Deep Link:** `familyhub://bindicator`

---

### 7. Quick Actions Widget (iOS 17+)

**Medium (4x2)** - Interactive buttons
```
┌─────────────────────────────────────────────┐
│ Family Hub                                  │
│─────────────────────────────────────────────│
│  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │   📅   │  │   🛒   │  │   ✅   │        │
│  │  Event │  │  Shop  │  │  Task  │        │
│  └────────┘  └────────┘  └────────┘        │
└─────────────────────────────────────────────┘
```

Each button opens the app to add that item type.

**Deep Links:**
- Event: `familyhub://calendar/add`
- Shop: `familyhub://shopping/add`
- Task: `familyhub://tasks/add`

---

## Implementation Plan

### Phase 1: Foundation (Do First)

#### 1.1 App Group Setup
- [ ] Create App Group in Apple Developer portal: `group.com.familyhub.app`
- [ ] Add App Group capability to main app in Xcode
- [ ] Verify entitlements file

#### 1.2 Create Widget Extension
- [ ] Xcode: File → New → Target → Widget Extension
- [ ] Name: `FamilyHubWidgets`
- [ ] Add to same App Group
- [ ] Configure bundle ID: `com.familyhub.app.widgets`

#### 1.3 Shared Data Manager
```swift
// Shared/WidgetDataManager.swift
class WidgetDataManager {
    static let shared = WidgetDataManager()

    private let containerURL: URL? = FileManager.default
        .containerURL(forSecurityApplicationGroupIdentifier: "group.com.familyhub.app")

    func write<T: Encodable>(_ data: T, to filename: String) throws
    func read<T: Decodable>(_ type: T.Type, from filename: String) throws -> T?
}
```

#### 1.4 Capacitor Bridge
```swift
// Create native plugin to call from JavaScript
@objc(WidgetBridge)
class WidgetBridge: CAPPlugin {

    @objc func updateShoppingWidget(_ call: CAPPluginCall) {
        // Write data to shared container
        // Trigger widget refresh
        WidgetCenter.shared.reloadTimelines(ofKind: "ShoppingWidget")
    }

    @objc func updateAllWidgets(_ call: CAPPluginCall) {
        WidgetCenter.shared.reloadAllTimelines()
    }
}
```

### Phase 2: Implement Widgets

#### 2.1 Shopping Widget
- [ ] ShoppingWidget.swift
- [ ] ShoppingWidgetProvider (Timeline)
- [ ] ShoppingWidgetEntryView (SwiftUI)
- [ ] Small and Medium sizes
- [ ] Empty state
- [ ] Deep link handling

#### 2.2 Events Widget
- [ ] EventsWidget.swift
- [ ] EventsWidgetProvider
- [ ] EventsWidgetEntryView
- [ ] Medium and Large sizes
- [ ] Time-based timeline (refresh at event times)
- [ ] Empty state
- [ ] Deep link handling

#### 2.3 Routine Widget
- [ ] RoutineWidget.swift
- [ ] RoutineWidgetProvider
- [ ] RoutineWidgetEntryView
- [ ] Progress indicator
- [ ] Active vs upcoming states
- [ ] Deep link handling

#### 2.4 Next Event Widget
- [ ] NextEventWidget.swift
- [ ] NextEventWidgetProvider
- [ ] NextEventWidgetEntryView
- [ ] Countdown formatting
- [ ] "Now" state
- [ ] Empty state

#### 2.5 F1 Widget
- [ ] F1Widget.swift
- [ ] F1WidgetProvider
- [ ] F1WidgetEntryView
- [ ] Country flags (SF Symbols or bundled)
- [ ] Live indicator
- [ ] Off-season state

#### 2.6 Bin Day Widget
- [ ] BinDayWidget.swift
- [ ] BinDayWidgetProvider
- [ ] BinDayWidgetEntryView
- [ ] Urgency states (today/tomorrow/later)
- [ ] Color theming per bin type

#### 2.7 Quick Actions Widget
- [ ] QuickActionsWidget.swift
- [ ] App Intents for buttons (iOS 17+)
- [ ] Deep link handling

### Phase 3: React Integration

#### 3.1 TypeScript Bridge
```typescript
// lib/widget-bridge.ts
import { Capacitor, registerPlugin } from '@capacitor/core';

interface WidgetBridgePlugin {
  updateShoppingWidget(data: { items: ShoppingItem[] }): Promise<void>;
  updateEventsWidget(data: { today: Event[]; tomorrow: Event[] }): Promise<void>;
  updateRoutinesWidget(data: { routines: Routine[] }): Promise<void>;
  updateF1Widget(data: { nextSession: F1Session | null }): Promise<void>;
  updateBinsWidget(data: { nextCollection: BinCollection | null }): Promise<void>;
  updateAllWidgets(): Promise<void>;
}

const WidgetBridge = registerPlugin<WidgetBridgePlugin>('WidgetBridge');

export async function syncWidgets(data: AllWidgetData): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  await Promise.all([
    WidgetBridge.updateShoppingWidget({ items: data.shoppingItems }),
    WidgetBridge.updateEventsWidget({ today: data.todayEvents, tomorrow: data.tomorrowEvents }),
    WidgetBridge.updateRoutinesWidget({ routines: data.routines }),
    WidgetBridge.updateF1Widget({ nextSession: data.nextF1Session }),
    WidgetBridge.updateBinsWidget({ nextCollection: data.nextBinCollection }),
  ]);
}
```

#### 3.2 Integration Points
- [ ] After Supabase sync completes → `syncWidgets()`
- [ ] On app foreground → `syncWidgets()`
- [ ] On shopping list change → `updateShoppingWidget()`
- [ ] On calendar change → `updateEventsWidget()`
- [ ] On routine completion → `updateRoutinesWidget()`

### Phase 4: Polish

#### 4.1 Dark Mode
- [ ] All widgets support dark mode
- [ ] Use semantic colors

#### 4.2 Localization
- [ ] English strings
- [ ] Danish strings
- [ ] Date/time formatting per locale

#### 4.3 Placeholders
- [ ] Loading/placeholder views for each widget

#### 4.4 Error Handling
- [ ] Graceful handling of missing/corrupt data
- [ ] "Tap to refresh" fallback

---

## File Structure

```
ios/App/
├── App/
│   ├── AppDelegate.swift           # Modify for widget refresh triggers
│   ├── WidgetBridge.swift          # NEW: Capacitor plugin
│   ├── WidgetBridge.m              # NEW: Plugin registration
│   └── ...
├── FamilyHubWidgets/               # NEW: Widget Extension
│   ├── FamilyHubWidgets.swift      # Widget bundle definition
│   ├── Models/
│   │   └── WidgetModels.swift      # All Codable structs
│   ├── Shared/
│   │   ├── WidgetDataManager.swift # Read from shared container
│   │   ├── WidgetColors.swift      # Brand colors
│   │   └── WidgetFormatters.swift  # Date/time formatting
│   ├── Widgets/
│   │   ├── ShoppingWidget.swift
│   │   ├── EventsWidget.swift
│   │   ├── RoutineWidget.swift
│   │   ├── NextEventWidget.swift
│   │   ├── F1Widget.swift
│   │   ├── BinDayWidget.swift
│   │   └── QuickActionsWidget.swift
│   ├── Views/
│   │   ├── ShoppingWidgetViews.swift
│   │   ├── EventsWidgetViews.swift
│   │   └── ... (SwiftUI views)
│   ├── Assets.xcassets/
│   │   ├── WidgetBackground.colorset
│   │   ├── AccentColor.colorset
│   │   └── Flags/                  # Country flag images
│   ├── Localizable.strings         # English
│   ├── da.lproj/
│   │   └── Localizable.strings     # Danish
│   ├── Info.plist
│   └── FamilyHubWidgets.entitlements
└── App.xcodeproj/
    └── project.pbxproj             # Updated with widget target
```

---

## Deep Link URL Scheme

Register `familyhub://` URL scheme in Info.plist.

| Widget | Deep Link |
|--------|-----------|
| Shopping | `familyhub://shopping` |
| Events | `familyhub://calendar` |
| Routine | `familyhub://routines` |
| Next Event | `familyhub://calendar` |
| F1 | `familyhub://f1` |
| Bin Day | `familyhub://bindicator` |
| Quick Actions (Event) | `familyhub://calendar/add` |
| Quick Actions (Shop) | `familyhub://shopping/add` |
| Quick Actions (Task) | `familyhub://tasks/add` |

---

## Silent Push for Real-Time Sync

To get wife's phone to update when you change something:

1. **Backend**: When data changes, send silent push:
```json
{
  "aps": {
    "content-available": 1
  },
  "data_type": "shopping_updated"
}
```

2. **App receives push** (even in background):
```swift
func application(_ application: UIApplication,
                 didReceiveRemoteNotification userInfo: [AnyHashable: Any],
                 fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void) {
    // Sync from Supabase
    // Update shared container
    // Refresh widgets
    WidgetCenter.shared.reloadAllTimelines()
    completionHandler(.newData)
}
```

**Note**: This requires APNs to be configured (which you mentioned isn't done yet).

---

## Testing Checklist

- [ ] All widgets appear in widget gallery
- [ ] Each widget displays correctly in all sizes
- [ ] Dark mode works for all widgets
- [ ] Tapping widget opens correct screen
- [ ] Data updates when app syncs
- [ ] Empty states display correctly
- [ ] Placeholders show during load
- [ ] Widgets refresh on timeline
- [ ] Memory usage stays under limits

---

## Estimated Effort

| Phase | Effort |
|-------|--------|
| Foundation (App Group, Extension, Bridge) | 2-3 hours |
| Shopping Widget | 1-2 hours |
| Events Widget | 2-3 hours |
| Routine Widget | 1-2 hours |
| Next Event Widget | 1 hour |
| F1 Widget | 1-2 hours |
| Bin Day Widget | 1 hour |
| Quick Actions Widget | 1-2 hours |
| React Integration | 2-3 hours |
| Polish & Testing | 2-3 hours |
| **Total** | **~15-20 hours** |

---

## Questions Before Starting

1. **App Group ID**: Is `group.com.familyhub.app` acceptable, or do you have a specific bundle ID structure?

2. **iOS Version Target**: What's the minimum iOS version? (iOS 14 for basic widgets, iOS 17 for interactive Quick Actions)

3. **Bin Schedule**: How is the bin schedule stored? Is it in Supabase or hardcoded somewhere?

4. **F1 Data**: The F1 schedule comes from the API - should the widget show off-season message when no races are scheduled?

5. **Priority**: If we hit issues, which widgets are most important? My suggestion:
   - P0: Shopping, Events (daily use)
   - P1: Routine, Next Event (family routine)
   - P2: F1, Bin Day (nice to have)
   - P3: Quick Actions (requires iOS 17)

---

## Ready to Implement?

This plan covers:
✅ All 7 widgets with designs
✅ Data architecture and sync strategy
✅ Native Swift implementation structure
✅ Capacitor bridge for React integration
✅ Deep linking
✅ Dark mode and localization
✅ Empty states and error handling
✅ Silent push for cross-device sync

Shall I proceed with implementation?
