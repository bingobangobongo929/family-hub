import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct F1CountdownProvider: TimelineProvider {
    func placeholder(in context: Context) -> F1CountdownEntry {
        F1CountdownEntry(date: Date(), data: F1WidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (F1CountdownEntry) -> Void) {
        let data = WidgetDataProvider.shared.getF1Data()
        let entry = F1CountdownEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<F1CountdownEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getF1Data()
        var entries: [F1CountdownEntry] = []

        // Create entries every hour for countdown accuracy
        let currentDate = Date()
        for hourOffset in 0..<12 {
            let entryDate = Calendar.current.date(byAdding: .hour, value: hourOffset, to: currentDate)!
            let entry = F1CountdownEntry(date: entryDate, data: data)
            entries.append(entry)
        }

        let timeline = Timeline(entries: entries, policy: .atEnd)
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct F1CountdownEntry: TimelineEntry {
    let date: Date
    let data: F1WidgetData
}

// MARK: - Widget Views
struct F1CountdownWidgetEntryView: View {
    var entry: F1CountdownEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallF1View(data: entry.data, currentDate: entry.date)
        case .systemMedium:
            MediumF1View(data: entry.data, currentDate: entry.date)
        case .accessoryRectangular:
            AccessoryF1View(data: entry.data, currentDate: entry.date)
        default:
            SmallF1View(data: entry.data, currentDate: entry.date)
        }
    }
}

// MARK: - Small Widget
struct SmallF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // F1 Header with racing red
            HStack {
                Text("F1")
                    .font(.title3)
                    .fontWeight(.black)
                    .foregroundColor(.red)
                Spacer()
                if let session = data.nextSession {
                    Text(session.countryFlag)
                        .font(.title2)
                }
            }

            if let session = data.nextSession {
                Spacer()

                // Session type (Qualifying, Race, etc)
                Text(session.name)
                    .font(.subheadline)
                    .fontWeight(.bold)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Spacer()

                // Countdown - larger and more prominent
                HStack {
                    Image(systemName: "timer")
                        .font(.caption)
                    Text(countdownText(to: session.startTime))
                        .font(.system(.subheadline, design: .monospaced))
                        .fontWeight(.bold)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .frame(maxWidth: .infinity)
                .background(Color.red)
                .cornerRadius(10)
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "flag.checkered")
                        .font(.title)
                        .foregroundColor(.secondary)
                    Text("Off-season")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.f1))
    }

    func countdownText(to date: Date) -> String {
        date.countdownString()
    }
}

// MARK: - Medium Widget
struct MediumF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        HStack(spacing: 16) {
            // Left: Next Session
            if let session = data.nextSession {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("F1")
                            .font(.headline)
                            .fontWeight(.black)
                            .foregroundColor(.red)
                        Spacer()
                        Text(session.countryFlag)
                            .font(.title)
                    }

                    Spacer()

                    Text(session.name.uppercased())
                        .font(.caption)
                        .fontWeight(.bold)
                        .foregroundColor(.red)

                    Text(session.raceName)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(2)

                    Text(session.circuitName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer()

                    // Countdown badge
                    HStack {
                        Image(systemName: "timer")
                            .font(.caption)
                        Text(countdownText(to: session.startTime))
                            .font(.system(.caption, design: .monospaced))
                            .fontWeight(.bold)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.red)
                    .cornerRadius(8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Divider()

            // Right: Session time details
            if let session = data.nextSession {
                VStack(alignment: .leading, spacing: 12) {
                    Text("SESSION TIME")
                        .font(.caption2)
                        .fontWeight(.bold)
                        .foregroundColor(.secondary)

                    VStack(alignment: .leading, spacing: 4) {
                        Text(formatDate(session.startTime))
                            .font(.subheadline)
                            .fontWeight(.medium)

                        Text(formatTime(session.startTime))
                            .font(.title2)
                            .fontWeight(.bold)
                            .foregroundColor(.red)

                        Text("Local time")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    if let race = data.nextRace, race.name != session.raceName {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("RACE")
                                .font(.caption2)
                                .fontWeight(.bold)
                                .foregroundColor(.secondary)
                            Text(formatDate(race.startTime))
                                .font(.caption)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                VStack {
                    Spacer()
                    Image(systemName: "flag.checkered")
                        .font(.largeTitle)
                        .foregroundColor(.secondary)
                    Text("Off-season")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.f1))
    }

    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    func countdownText(to date: Date) -> String {
        date.countdownString()
    }
}

// MARK: - Lock Screen Widget
struct AccessoryF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        if let session = data.nextSession {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("F1")
                        .fontWeight(.black)
                    Text(session.countryFlag)
                    Spacer()
                    Text(countdownText(to: session.startTime))
                        .fontWeight(.semibold)
                }
                .font(.caption)

                Text(session.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(formatTime(session.startTime))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        } else {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text("F1")
                        .fontWeight(.black)
                    Image(systemName: "flag.checkered")
                }
                .font(.caption)

                Text("Off-season")
                    .font(.headline)
            }
        }
    }

    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE HH:mm"
        return formatter.string(from: date)
    }

    func countdownText(to date: Date) -> String {
        date.countdownString()
    }
}

// MARK: - Widget Configuration
struct F1CountdownWidget: Widget {
    let kind: String = "F1CountdownWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: F1CountdownProvider()) { entry in
            F1CountdownWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("F1 Countdown")
        .description("Countdown to the next Formula 1 session.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

// MARK: - Preview
#Preview(as: .systemMedium) {
    F1CountdownWidget()
} timeline: {
    F1CountdownEntry(date: Date(), data: F1WidgetData.placeholder)
}
