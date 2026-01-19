import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct TodaysEventsProvider: TimelineProvider {
    func placeholder(in context: Context) -> TodaysEventsEntry {
        TodaysEventsEntry(date: Date(), data: EventsWidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (TodaysEventsEntry) -> Void) {
        let data = WidgetDataProvider.shared.getEventsData()
        let entry = TodaysEventsEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TodaysEventsEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getEventsData()
        let entry = TodaysEventsEntry(date: Date(), data: data)

        // Refresh every 30 minutes
        let nextUpdate = Date.widgetRefreshDate(minutes: 30)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct TodaysEventsEntry: TimelineEntry {
    let date: Date
    let data: EventsWidgetData
}

// MARK: - Widget Views
struct TodaysEventsWidgetEntryView: View {
    var entry: TodaysEventsEntry
    @Environment(\.widgetFamily) var family

    var todaysEvents: [CalendarEvent] {
        let calendar = Calendar.current
        return entry.data.events.filter { event in
            calendar.isDateInToday(event.startTime)
        }.sorted { $0.startTime < $1.startTime }
    }

    var body: some View {
        switch family {
        case .systemSmall:
            SmallEventsView(events: todaysEvents)
        case .systemMedium:
            MediumEventsView(events: todaysEvents)
        case .systemLarge:
            LargeEventsView(events: todaysEvents, allEvents: entry.data.events)
        default:
            SmallEventsView(events: todaysEvents)
        }
    }
}

// MARK: - Small Widget
struct SmallEventsView: View {
    let events: [CalendarEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Compact header - icon with count badge
            HStack(spacing: 4) {
                Image(systemName: "calendar")
                    .font(.title3)
                    .foregroundColor(.orange)
                Text("\(events.count)")
                    .font(.title3)
                    .fontWeight(.bold)
                    .foregroundColor(.orange)
                Spacer()
            }

            if events.isEmpty {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.largeTitle)
                        .foregroundColor(.green)
                    Text("Free day!")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            } else {
                Divider()

                VStack(alignment: .leading, spacing: 5) {
                    ForEach(events.prefix(3)) { event in
                        HStack(spacing: 6) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(colorFromHex(event.color ?? "#f97316"))
                                .frame(width: 3, height: 28)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(event.title)
                                    .font(.caption2)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                                Text(event.displayTime)
                                    .font(.system(size: 9))
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
                if events.count > 3 {
                    Text("+\(events.count - 3)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.calendar))
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.orange
    }
}

// MARK: - Medium Widget
struct MediumEventsView: View {
    let events: [CalendarEvent]

    var body: some View {
        HStack(spacing: 16) {
            // Left: Date display
            VStack(alignment: .center, spacing: 4) {
                Text(dayOfWeek())
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.orange)
                    .textCase(.uppercase)

                Text(dayNumber())
                    .font(.system(size: 42, weight: .bold))
                    .foregroundColor(.primary)

                Text(monthName())
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .frame(width: 80)

            Divider()

            // Right: Events list
            VStack(alignment: .leading, spacing: 8) {
                if events.isEmpty {
                    VStack {
                        Spacer()
                        Image(systemName: "calendar.badge.checkmark")
                            .font(.title2)
                            .foregroundColor(.green)
                        Text("No events today")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    ForEach(events.prefix(4)) { event in
                        HStack(spacing: 8) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(colorFromHex(event.color ?? "#f97316"))
                                .frame(width: 3, height: 24)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(event.title)
                                    .font(.subheadline)
                                    .fontWeight(.medium)
                                    .lineLimit(1)
                                Text(event.displayTime)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                    }
                    if events.count > 4 {
                        Text("+\(events.count - 4) more")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.calendar))
    }

    func dayOfWeek() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        return formatter.string(from: Date())
    }

    func dayNumber() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "d"
        return formatter.string(from: Date())
    }

    func monthName() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM"
        return formatter.string(from: Date())
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.orange
    }
}

// MARK: - Large Widget
struct LargeEventsView: View {
    let events: [CalendarEvent]
    let allEvents: [CalendarEvent]

    var upcomingEvents: [CalendarEvent] {
        let calendar = Calendar.current
        return allEvents.filter { event in
            !calendar.isDateInToday(event.startTime) && event.startTime > Date()
        }.sorted { $0.startTime < $1.startTime }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Image(systemName: "calendar")
                    .foregroundColor(.orange)
                    .font(.title2)
                Text("Calendar")
                    .font(.title3)
                    .fontWeight(.semibold)
                Spacer()
                Text(formattedDate())
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            // Today's events
            VStack(alignment: .leading, spacing: 8) {
                Text("TODAY")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.orange)

                if events.isEmpty {
                    HStack {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                        Text("No events scheduled")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 4)
                } else {
                    ForEach(events.prefix(4)) { event in
                        EventRow(event: event)
                    }
                }
            }

            if !upcomingEvents.isEmpty {
                Divider()

                // Upcoming events
                VStack(alignment: .leading, spacing: 8) {
                    Text("UPCOMING")
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundColor(.secondary)

                    ForEach(upcomingEvents.prefix(3)) { event in
                        HStack(spacing: 10) {
                            RoundedRectangle(cornerRadius: 2)
                                .fill(colorFromHex(event.color ?? "#f97316"))
                                .frame(width: 3, height: 32)
                            VStack(alignment: .leading, spacing: 0) {
                                Text(event.title)
                                    .font(.subheadline)
                                    .lineLimit(1)
                                Text(formatFutureDate(event.startTime))
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                        }
                    }
                }
            }

            Spacer()
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.calendar))
    }

    func formattedDate() -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d"
        return formatter.string(from: Date())
    }

    func formatFutureDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d • h:mm a"
        return formatter.string(from: date)
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.orange
    }
}

struct EventRow: View {
    let event: CalendarEvent

    var body: some View {
        HStack(spacing: 10) {
            RoundedRectangle(cornerRadius: 2)
                .fill(colorFromHex(event.color ?? "#f97316"))
                .frame(width: 4, height: 36)

            VStack(alignment: .leading, spacing: 2) {
                Text(event.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .lineLimit(1)
                Text(event.displayTime)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            Spacer()
        }
        .padding(.vertical, 2)
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.orange
    }
}

// MARK: - Widget Configuration
struct TodaysEventsWidget: Widget {
    let kind: String = "TodaysEventsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: TodaysEventsProvider()) { entry in
            TodaysEventsWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Today's Events")
        .description("See your family's events for today at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Preview
#Preview(as: .systemMedium) {
    TodaysEventsWidget()
} timeline: {
    TodaysEventsEntry(date: Date(), data: EventsWidgetData.placeholder)
}
