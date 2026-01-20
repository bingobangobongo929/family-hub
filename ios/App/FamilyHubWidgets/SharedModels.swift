import Foundation

// MARK: - App Group Constants
struct AppGroupConstants {
    static let suiteName = "group.app.familyhub.home"
    static let shoppingDataKey = "shopping_widget_data"
    static let eventsDataKey = "events_widget_data"
    static let routinesDataKey = "routines_widget_data"
    static let f1DataKey = "f1_widget_data"
    static let binDataKey = "bin_widget_data"
}

// MARK: - Shopping List Models
struct ShoppingWidgetData: Codable {
    var items: [ShoppingItem]
    var lastUpdated: Date

    static let placeholder = ShoppingWidgetData(
        items: [
            ShoppingItem(id: "1", name: "Milk", quantity: 2, unit: "L", isCompleted: false, category: "dairy"),
            ShoppingItem(id: "2", name: "Bread", quantity: 1, unit: nil, isCompleted: false, category: "bakery"),
            ShoppingItem(id: "3", name: "Apples", quantity: 6, unit: nil, isCompleted: true, category: "produce")
        ],
        lastUpdated: Date()
    )
}

struct ShoppingItem: Codable, Identifiable {
    let id: String
    let name: String
    let quantity: Int?
    let unit: String?
    var isCompleted: Bool
    let category: String?
}

// MARK: - Events Models
struct EventsWidgetData: Codable {
    let events: [CalendarEvent]
    let lastUpdated: Date

    static let placeholder = EventsWidgetData(
        events: [
            CalendarEvent(id: "1", title: "Team Meeting", startTime: Date().addingTimeInterval(3600), endTime: Date().addingTimeInterval(7200), isAllDay: false, color: "#14b8a6"),
            CalendarEvent(id: "2", title: "Lunch with Sarah", startTime: Date().addingTimeInterval(14400), endTime: Date().addingTimeInterval(18000), isAllDay: false, color: "#f97316"),
            CalendarEvent(id: "3", title: "Olivia's Birthday", startTime: Date(), endTime: nil, isAllDay: true, color: "#ec4899")
        ],
        lastUpdated: Date()
    )
}

struct CalendarEvent: Codable, Identifiable {
    let id: String
    let title: String
    let startTime: Date
    let endTime: Date?
    let isAllDay: Bool
    let color: String?

    var displayTime: String {
        if isAllDay {
            return "All day"
        }
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: startTime)
    }
}

// MARK: - Routines Models
struct RoutinesWidgetData: Codable {
    var routines: [RoutineStatus]
    var lastUpdated: Date

    static let placeholder = RoutinesWidgetData(
        routines: [
            RoutineStatus(id: "1", title: "Morning Routine", emoji: "☀️", completedSteps: 3, totalSteps: 5, memberName: "Olivia", memberColor: "#f472b6"),
            RoutineStatus(id: "2", title: "Bedtime Routine", emoji: "🌙", completedSteps: 0, totalSteps: 5, memberName: "Olivia", memberColor: "#f472b6")
        ],
        lastUpdated: Date()
    )
}

struct RoutineStatus: Codable, Identifiable {
    let id: String
    let title: String
    let emoji: String
    var completedSteps: Int
    let totalSteps: Int
    let memberName: String
    let memberColor: String

    var progress: Double {
        guard totalSteps > 0 else { return 0 }
        return Double(completedSteps) / Double(totalSteps)
    }

    var isComplete: Bool {
        completedSteps >= totalSteps
    }
}

// MARK: - F1 Models
struct F1WidgetData: Codable {
    let nextSession: F1Session?
    let nextRace: F1Race?
    let lastUpdated: Date

    static let placeholder = F1WidgetData(
        nextSession: F1Session(
            name: "Qualifying",
            raceName: "Monaco Grand Prix",
            startTime: Date().addingTimeInterval(86400),
            circuitName: "Circuit de Monaco",
            countryFlag: "🇲🇨"
        ),
        nextRace: F1Race(
            name: "Monaco Grand Prix",
            startTime: Date().addingTimeInterval(172800),
            circuitName: "Circuit de Monaco",
            countryFlag: "🇲🇨"
        ),
        lastUpdated: Date()
    )
}

struct F1Session: Codable {
    let name: String
    let raceName: String
    let startTime: Date
    let circuitName: String
    let countryFlag: String
}

struct F1Race: Codable {
    let name: String
    let startTime: Date
    let circuitName: String
    let countryFlag: String
}

// MARK: - Bin Day Models
struct BinWidgetData: Codable {
    let collections: [BinCollection]
    let lastUpdated: Date

    static let placeholder = BinWidgetData(
        collections: [
            BinCollection(id: "1", type: "madaffald", name: "Food Waste", emoji: "🥬", nextDate: Date().addingTimeInterval(86400), daysUntil: 1),
            BinCollection(id: "2", type: "restaffald", name: "General Waste", emoji: "🗑️", nextDate: Date().addingTimeInterval(259200), daysUntil: 3),
            BinCollection(id: "3", type: "papir_pap", name: "Paper & Cardboard", emoji: "📦", nextDate: Date().addingTimeInterval(604800), daysUntil: 7)
        ],
        lastUpdated: Date()
    )
}

struct BinCollection: Codable, Identifiable {
    let id: String
    let type: String
    let name: String
    let emoji: String
    let nextDate: Date
    let daysUntil: Int

    var urgencyLevel: UrgencyLevel {
        switch daysUntil {
        case 0: return .today
        case 1: return .tomorrow
        case 2...3: return .soon
        default: return .later
        }
    }

    enum UrgencyLevel {
        case today, tomorrow, soon, later
    }
}

// MARK: - Deep Link URLs
struct DeepLinks {
    static let base = "familyhub://"

    static let shopping = "\(base)shopping"
    static let shoppingAdd = "\(base)shopping/add"
    static let calendar = "\(base)calendar"
    static let routines = "\(base)routines"
    static let f1 = "\(base)f1"
    static let bindicator = "\(base)bindicator"
    static let dashboard = "\(base)"
}

// MARK: - Color Extensions
extension String {
    var asColor: (red: Double, green: Double, blue: Double)? {
        let hex = self.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if hex.count == 6 {
            var rgbValue: UInt64 = 0
            Scanner(string: hex).scanHexInt64(&rgbValue)
            return (
                red: Double((rgbValue & 0xFF0000) >> 16) / 255.0,
                green: Double((rgbValue & 0x00FF00) >> 8) / 255.0,
                blue: Double(rgbValue & 0x0000FF) / 255.0
            )
        }
        return nil
    }
}
