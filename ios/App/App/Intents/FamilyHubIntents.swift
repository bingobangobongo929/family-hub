import AppIntents
import UIKit

// MARK: - App Intents for Siri Shortcuts

/// Intent to scan an event using AI
@available(iOS 16.0, *)
struct ScanEventIntent: AppIntent {
    static var title: LocalizedStringResource = "Scan Calendar Event"
    static var description = IntentDescription("Open Family Hub to scan an event from a photo or text")

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Open the app with deep link
        let url = URL(string: "familyhub://calendar/scan")!
        await UIApplication.shared.open(url)
        return .result(dialog: "Opening Family Hub to scan an event...")
    }
}

/// Intent to add a shopping item
@available(iOS 16.0, *)
struct AddShoppingItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Shopping Item"
    static var description = IntentDescription("Add an item to the Family Hub shopping list")

    @Parameter(title: "Item Name")
    var itemName: String

    static var openAppWhenRun: Bool = false

    func perform() async throws -> some IntentResult & ProvidesDialog {
        // Save to app group for the app to read
        if let defaults = UserDefaults(suiteName: "group.app.familyhub.home") {
            var pendingItems = defaults.array(forKey: "pending_shopping_items") as? [String] ?? []
            pendingItems.append(itemName)
            defaults.set(pendingItems, forKey: "pending_shopping_items")
            defaults.synchronize()
        }

        return .result(dialog: "Added '\(itemName)' to shopping list")
    }
}

/// Intent to check today's events
@available(iOS 16.0, *)
struct CheckEventsIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Today's Events"
    static var description = IntentDescription("View today's calendar events in Family Hub")

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "familyhub://calendar")!
        await UIApplication.shared.open(url)
        return .result(dialog: "Opening Family Hub calendar...")
    }
}

/// Intent to start a routine
@available(iOS 16.0, *)
struct StartRoutineIntent: AppIntent {
    static var title: LocalizedStringResource = "Start Routine"
    static var description = IntentDescription("Start a family routine in Family Hub")

    @Parameter(title: "Routine Type")
    var routineType: RoutineTypeEntity?

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let routineParam = routineType?.type ?? "morning"
        let url = URL(string: "familyhub://routines?start=\(routineParam)")!
        await UIApplication.shared.open(url)
        return .result(dialog: "Starting \(routineParam) routine...")
    }
}

/// Routine type entity for Siri
@available(iOS 16.0, *)
struct RoutineTypeEntity: AppEntity {
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Routine Type"
    static var defaultQuery = RoutineTypeQuery()

    var id: String
    var type: String

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(type.capitalized) Routine")
    }
}

@available(iOS 16.0, *)
struct RoutineTypeQuery: EntityQuery {
    func entities(for identifiers: [String]) async throws -> [RoutineTypeEntity] {
        return identifiers.compactMap { id in
            let types = ["morning", "evening", "bedtime"]
            guard types.contains(id) else { return nil }
            return RoutineTypeEntity(id: id, type: id)
        }
    }

    func suggestedEntities() async throws -> [RoutineTypeEntity] {
        return [
            RoutineTypeEntity(id: "morning", type: "morning"),
            RoutineTypeEntity(id: "evening", type: "evening"),
            RoutineTypeEntity(id: "bedtime", type: "bedtime")
        ]
    }
}

/// Intent to check bin collection
@available(iOS 16.0, *)
struct CheckBinsIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Bin Collection"
    static var description = IntentDescription("View upcoming bin collection days")

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "familyhub://bindicator")!
        await UIApplication.shared.open(url)
        return .result(dialog: "Opening bin collection schedule...")
    }
}

/// Intent to check F1 schedule
@available(iOS 16.0, *)
struct CheckF1Intent: AppIntent {
    static var title: LocalizedStringResource = "Check F1 Schedule"
    static var description = IntentDescription("View F1 race schedule and standings")

    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult & ProvidesDialog {
        let url = URL(string: "familyhub://f1")!
        await UIApplication.shared.open(url)
        return .result(dialog: "Opening F1 schedule...")
    }
}

// MARK: - App Shortcuts Provider

@available(iOS 16.0, *)
struct FamilyHubShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: ScanEventIntent(),
            phrases: [
                "Scan event with \(.applicationName)",
                "Add event to \(.applicationName)",
                "Scan calendar event in \(.applicationName)"
            ],
            shortTitle: "Scan Event",
            systemImageName: "doc.text.viewfinder"
        )

        AppShortcut(
            intent: AddShoppingItemIntent(),
            phrases: [
                "Add item to shopping list in \(.applicationName)",
                "Add to \(.applicationName) shopping list"
            ],
            shortTitle: "Add Shopping Item",
            systemImageName: "cart.badge.plus"
        )

        AppShortcut(
            intent: CheckEventsIntent(),
            phrases: [
                "Check today's events in \(.applicationName)",
                "What's on the calendar in \(.applicationName)"
            ],
            shortTitle: "Today's Events",
            systemImageName: "calendar"
        )

        AppShortcut(
            intent: StartRoutineIntent(),
            phrases: [
                "Start routine in \(.applicationName)",
                "Begin \(\.$routineType) routine in \(.applicationName)"
            ],
            shortTitle: "Start Routine",
            systemImageName: "list.bullet.clipboard"
        )

        AppShortcut(
            intent: CheckBinsIntent(),
            phrases: [
                "Check bin collection in \(.applicationName)",
                "When are the bins in \(.applicationName)"
            ],
            shortTitle: "Check Bins",
            systemImageName: "trash"
        )

        AppShortcut(
            intent: CheckF1Intent(),
            phrases: [
                "Check F1 in \(.applicationName)",
                "When is the next race in \(.applicationName)"
            ],
            shortTitle: "F1 Schedule",
            systemImageName: "flag.checkered"
        )
    }
}
