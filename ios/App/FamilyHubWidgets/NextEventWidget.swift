import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct NextEventProvider: TimelineProvider {
    func placeholder(in context: Context) -> NextEventEntry {
        NextEventEntry(date: Date(), data: EventsWidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (NextEventEntry) -> Void) {
        let data = WidgetDataProvider.shared.getEventsData()
        let entry = NextEventEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<NextEventEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getEventsData()
        var entries: [NextEventEntry] = []

        // Create entries for the next few hours to keep countdown accurate
        let currentDate = Date()
        for hourOffset in 0..<6 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = NextEventEntry(date: entryDate, data: data)
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct NextEventEntry: TimelineEntry {
    let date: Date
    let data: EventsWidgetData

    var nextEvent: CalendarEvent? {
        data.events
            .filter { $0.startTime > date }
            .sorted { $0.startTime < $1.startTime }
            .first
    }
}

// MARK: - Widget Views
struct NextEventWidgetEntryView: View {
    var entry: NextEventEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallNextEventView(event: entry.nextEvent, currentDate: entry.date)
        case .accessoryRectangular:
            AccessoryNextEventView(event: entry.nextEvent, currentDate: entry.date)
        case .accessoryCircular:
            CircularNextEventView(event: entry.nextEvent, currentDate: entry.date)
        default:
            SmallNextEventView(event: entry.nextEvent, currentDate: entry.date)
        }
    }
}

// MARK: - Small Widget
struct SmallNextEventView: View {
    let event: CalendarEvent?
    let currentDate: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "clock.fill")
                    .foregroundColor(.blue)
                Text("Next Event")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)
            }

            if let event = event {
                Spacer()

                VStack(alignment: .leading, spacing: 4) {
                    Text(event.title)
                        .font(.headline)
                        .lineLimit(2)
                        .fixedSize(horizontal: false, vertical: true)

                    HStack {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(colorFromHex(event.color ?? "#3b82f6"))
                            .frame(width: 3, height: 20)

                        VStack(alignment: .leading, spacing: 0) {
                            Text(formatDate(event.startTime))
                                .font(.caption)
                                .foregroundColor(.secondary)
                            Text(event.displayTime)
                                .font(.caption)
                                .fontWeight(.semibold)
                        }
                    }
                }

                Spacer()

                // Countdown
                HStack {
                    Image(systemName: "timer")
                        .font(.caption)
                        .foregroundColor(.blue)
                    Text(countdownText(to: event.startTime))
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.blue)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 4)
                .background(Color.blue.opacity(0.1))
                .cornerRadius(12)
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "calendar.badge.checkmark")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("No upcoming events")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.calendar))
    }

    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    func countdownText(to date: Date) -> String {
        date.countdownString()
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.blue
    }
}

// MARK: - Lock Screen Rectangular Widget
struct AccessoryNextEventView: View {
    let event: CalendarEvent?
    let currentDate: Date

    var body: some View {
        if let event = event {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: "calendar")
                    Text(countdownText(to: event.startTime))
                        .fontWeight(.semibold)
                }
                .font(.caption)

                Text(event.title)
                    .font(.headline)
                    .lineLimit(1)

                Text("\(formatDate(event.startTime)) • \(event.displayTime)")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        } else {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: "calendar.badge.checkmark")
                    Text("Calendar")
                }
                .font(.caption)

                Text("No upcoming")
                    .font(.headline)
            }
        }
    }

    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: date)
    }

    func countdownText(to date: Date) -> String {
        date.countdownString()
    }
}

// MARK: - Lock Screen Circular Widget
struct CircularNextEventView: View {
    let event: CalendarEvent?
    let currentDate: Date

    var body: some View {
        if let event = event {
            VStack(spacing: 2) {
                Image(systemName: "calendar")
                    .font(.title3)
                Text(shortCountdown(to: event.startTime))
                    .font(.caption2)
                    .fontWeight(.bold)
            }
        } else {
            VStack(spacing: 2) {
                Image(systemName: "calendar.badge.checkmark")
                    .font(.title3)
                Text("Free")
                    .font(.caption2)
            }
        }
    }

    func shortCountdown(to date: Date) -> String {
        let interval = date.timeIntervalSince(currentDate)
        let hours = Int(interval / 3600)
        let days = hours / 24

        if days > 0 {
            return "\(days)d"
        } else if hours > 0 {
            return "\(hours)h"
        } else {
            let minutes = Int(interval / 60)
            return "\(max(0, minutes))m"
        }
    }
}

// MARK: - Widget Configuration
struct NextEventWidget: Widget {
    let kind: String = "NextEventWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: NextEventProvider()) { entry in
            NextEventWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Next Event Countdown")
        .description("Countdown to your next family event.")
        .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryCircular])
    }
}

// MARK: - Preview
#Preview(as: .systemSmall) {
    NextEventWidget()
} timeline: {
    NextEventEntry(date: Date(), data: EventsWidgetData.placeholder)
}
