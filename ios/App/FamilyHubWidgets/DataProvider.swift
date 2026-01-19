import Foundation
import WidgetKit

/// Reads widget data from the shared App Group container
class WidgetDataProvider {
    static let shared = WidgetDataProvider()

    private let sharedDefaults: UserDefaults?
    private let jsonDecoder: JSONDecoder

    private init() {
        sharedDefaults = UserDefaults(suiteName: AppGroupConstants.suiteName)
        jsonDecoder = JSONDecoder()
        jsonDecoder.dateDecodingStrategy = .iso8601
    }

    // MARK: - Shopping Data
    func getShoppingData() -> ShoppingWidgetData {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: AppGroupConstants.shoppingDataKey),
              let decoded = try? jsonDecoder.decode(ShoppingWidgetData.self, from: data) else {
            return ShoppingWidgetData.placeholder
        }
        return decoded
    }

    // MARK: - Events Data
    func getEventsData() -> EventsWidgetData {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: AppGroupConstants.eventsDataKey),
              let decoded = try? jsonDecoder.decode(EventsWidgetData.self, from: data) else {
            return EventsWidgetData.placeholder
        }
        return decoded
    }

    // MARK: - Routines Data
    func getRoutinesData() -> RoutinesWidgetData {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: AppGroupConstants.routinesDataKey),
              let decoded = try? jsonDecoder.decode(RoutinesWidgetData.self, from: data) else {
            return RoutinesWidgetData.placeholder
        }
        return decoded
    }

    // MARK: - F1 Data
    func getF1Data() -> F1WidgetData {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: AppGroupConstants.f1DataKey),
              let decoded = try? jsonDecoder.decode(F1WidgetData.self, from: data) else {
            return F1WidgetData.placeholder
        }
        return decoded
    }

    // MARK: - Bin Data
    func getBinData() -> BinWidgetData {
        guard let defaults = sharedDefaults,
              let data = defaults.data(forKey: AppGroupConstants.binDataKey),
              let decoded = try? jsonDecoder.decode(BinWidgetData.self, from: data) else {
            return BinWidgetData.placeholder
        }
        return decoded
    }
}

// MARK: - Timeline Helpers
extension Date {
    /// Returns the next refresh time for widgets
    /// - Parameter minutes: Minutes until next refresh
    static func widgetRefreshDate(minutes: Int = 15) -> Date {
        return Calendar.current.date(byAdding: .minute, value: minutes, to: Date()) ?? Date()
    }

    /// Format time for display
    func formattedTime() -> String {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        return formatter.string(from: self)
    }

    /// Format date for display
    func formattedDate() -> String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: self)
    }

    /// Returns countdown string
    func countdownString() -> String {
        let now = Date()
        let interval = self.timeIntervalSince(now)

        if interval < 0 {
            return "Started"
        }

        let days = Int(interval / 86400)
        let hours = Int((interval.truncatingRemainder(dividingBy: 86400)) / 3600)
        let minutes = Int((interval.truncatingRemainder(dividingBy: 3600)) / 60)

        if days > 0 {
            return "\(days)d \(hours)h"
        } else if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes)m"
        }
    }
}
