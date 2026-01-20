import WidgetKit
import SwiftUI

// MARK: - Design System (Inline for Widget Target)
// Note: Duplicated from BinDayWidget.swift since widgets can't share code easily
private struct F1WidgetColors {
    // Primary - Teal (matches tailwind teal-500, teal-600)
    static let teal = Color(red: 0.08, green: 0.72, blue: 0.65)      // #14b8a6
    static let tealDark = Color(red: 0.05, green: 0.58, blue: 0.53)  // #0d9488

    // F1 specific - keep red for brand recognition
    static let f1Red = Color(red: 0.89, green: 0.0, blue: 0.13)       // #e30022
}

private struct F1AccentBar: View {
    var color: Color = F1F1WidgetColors.teal
    var width: CGFloat = 3

    var body: some View {
        Rectangle()
            .fill(color)
            .frame(width: width)
            .cornerRadius(width / 2)
    }
}

// String extension for abbreviating race names
private extension String {
    func widgetAbbreviated() -> String {
        self.replacingOccurrences(of: "Grand Prix", with: "GP")
            .replacingOccurrences(of: "United States", with: "USA")
            .replacingOccurrences(of: "Great Britain", with: "British")
            .replacingOccurrences(of: "United Arab Emirates", with: "UAE")
            .replacingOccurrences(of: "Saudi Arabia", with: "Saudi")
    }
}

// Date extension for countdown formatting
private extension Date {
    func countdownStringFull() -> String {
        let now = Date()
        let interval = self.timeIntervalSince(now)

        if interval <= 0 {
            return "Now!"
        }

        let days = Int(interval) / 86400
        let hours = (Int(interval) % 86400) / 3600
        let minutes = (Int(interval) % 3600) / 60

        if days > 0 {
            return "\(days)D \(hours)H \(minutes)M"
        } else if hours > 0 {
            return "\(hours)H \(minutes)M"
        } else {
            return "\(minutes) MIN"
        }
    }
}

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
        case .systemLarge:
            LargeF1View(data: entry.data, currentDate: entry.date)
        case .accessoryRectangular:
            AccessoryF1View(data: entry.data, currentDate: entry.date)
        default:
            SmallF1View(data: entry.data, currentDate: entry.date)
        }
    }
}

// MARK: - Small Widget (Redesigned)
struct SmallF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header with F1 logo style
            HStack {
                Text("F1")
                    .font(.system(size: 16, weight: .black, design: .rounded))
                    .foregroundColor(F1WidgetColors.f1Red)
                Spacer()
                if let session = data.nextSession {
                    Text(session.countryFlag)
                        .font(.system(size: 22))
                }
            }

            if let session = data.nextSession {
                Spacer(minLength: 8)

                // Large countdown centered
                Text(session.startTime.countdownStringFull())
                    .font(.system(size: 20, weight: .bold, design: .monospaced))
                    .foregroundColor(.primary)
                    .minimumScaleFactor(0.7)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .center)

                Spacer(minLength: 6)

                // Race name abbreviated
                Text(session.raceName.widgetAbbreviated())
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .center)

                Spacer(minLength: 8)

                // Session type badge
                HStack {
                    Spacer()
                    sessionBadge(session.name)
                    Spacer()
                }
            } else {
                Spacer()
                offSeasonView()
                Spacer()
            }
        }
        .padding(14)
        .widgetURL(URL(string: DeepLinks.f1))
    }

    @ViewBuilder
    func sessionBadge(_ name: String) -> some View {
        Text(name.uppercased())
            .font(.system(size: 10, weight: .bold))
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 5)
            .background(F1WidgetColors.f1Red)
            .cornerRadius(8)
    }

    @ViewBuilder
    func offSeasonView() -> some View {
        VStack(spacing: 8) {
            Image(systemName: "flag.checkered")
                .font(.system(size: 28))
                .foregroundColor(.secondary)
            Text("Off-season")
                .font(.system(size: 12, weight: .medium))
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Medium Widget (Redesigned)
struct MediumF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        HStack(spacing: 0) {
            // Left side - Session info
            if let session = data.nextSession {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack(spacing: 6) {
                        Text("F1")
                            .font(.system(size: 14, weight: .black, design: .rounded))
                            .foregroundColor(F1WidgetColors.f1Red)
                        Text(session.countryFlag)
                            .font(.system(size: 18))
                    }

                    Spacer(minLength: 4)

                    // Session type
                    Text(session.name.uppercased())
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(F1WidgetColors.f1Red)

                    // Race name
                    Text(session.raceName.widgetAbbreviated())
                        .font(.system(size: 15, weight: .bold))
                        .foregroundColor(.primary)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)

                    // Circuit
                    Text(session.circuitName)
                        .font(.system(size: 11, weight: .medium))
                        .foregroundColor(.secondary)
                        .lineLimit(1)

                    Spacer(minLength: 4)

                    // Countdown badge
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.system(size: 10, weight: .semibold))
                        Text(session.startTime.countdownString())
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 5)
                    .background(F1WidgetColors.f1Red)
                    .cornerRadius(8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.trailing, 8)
            }

            // Teal accent divider
            F1AccentBar(color: F1WidgetColors.teal.opacity(0.3), width: 2)

            // Right side - Time details
            if let session = data.nextSession {
                VStack(alignment: .leading, spacing: 4) {
                    Text("SESSION")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundColor(.secondary)

                    Text(formatDate(session.startTime))
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.primary)

                    Text(formatTime(session.startTime))
                        .font(.system(size: 24, weight: .bold))
                        .foregroundColor(F1WidgetColors.f1Red)

                    Text("Local time")
                        .font(.system(size: 9, weight: .medium))
                        .foregroundColor(.secondary)

                    Spacer()

                    if let race = data.nextRace, race.name != session.raceName || session.name != "Race" {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("RACE")
                                .font(.system(size: 9, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(formatDateTime(race.startTime))
                                .font(.system(size: 11, weight: .medium))
                                .foregroundColor(.primary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 12)
            } else {
                VStack {
                    Spacer()
                    Image(systemName: "flag.checkered")
                        .font(.system(size: 32))
                        .foregroundColor(.secondary)
                    Text("Off-season")
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding(14)
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

    func formatDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - Large Widget (NEW)
struct LargeF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    // Mock session schedule - in real app this would come from data
    var sessionSchedule: [(name: String, day: String, time: String, isNext: Bool, isComplete: Bool)] {
        guard let session = data.nextSession else { return [] }
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE"
        let dayName = formatter.string(from: session.startTime)
        formatter.dateFormat = "HH:mm"
        let timeStr = formatter.string(from: session.startTime)

        // Return the next session info
        return [
            (name: session.name, day: dayName, time: timeStr, isNext: true, isComplete: false)
        ]
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let session = data.nextSession {
                // Header
                HStack {
                    HStack(spacing: 8) {
                        Text("F1")
                            .font(.system(size: 18, weight: .black, design: .rounded))
                            .foregroundColor(F1WidgetColors.f1Red)
                        Text(session.countryFlag)
                            .font(.system(size: 24))
                    }
                    Spacer()
                    // Countdown badge
                    HStack(spacing: 4) {
                        Image(systemName: "timer")
                            .font(.system(size: 11, weight: .semibold))
                        Text(session.startTime.countdownString())
                            .font(.system(size: 13, weight: .bold, design: .monospaced))
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(F1WidgetColors.f1Red)
                    .cornerRadius(10)
                }

                Spacer(minLength: 12)

                // Race name and circuit
                Text(session.raceName)
                    .font(.system(size: 20, weight: .bold))
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(session.circuitName)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                Spacer(minLength: 12)

                // Divider
                Rectangle()
                    .fill(F1WidgetColors.teal.opacity(0.2))
                    .frame(height: 2)
                    .cornerRadius(1)

                Spacer(minLength: 12)

                // Next session highlight
                VStack(alignment: .leading, spacing: 8) {
                    Text("NEXT SESSION")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.secondary)

                    HStack {
                        // Session icon
                        ZStack {
                            Circle()
                                .fill(F1WidgetColors.f1Red)
                                .frame(width: 36, height: 36)
                            Image(systemName: sessionIcon(session.name))
                                .font(.system(size: 16, weight: .semibold))
                                .foregroundColor(.white)
                        }

                        VStack(alignment: .leading, spacing: 2) {
                            Text(session.name)
                                .font(.system(size: 16, weight: .bold))
                                .foregroundColor(.primary)
                            Text(formatFullDateTime(session.startTime))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.secondary)
                        }

                        Spacer()

                        // Large time
                        VStack(alignment: .trailing, spacing: 0) {
                            Text(formatTime(session.startTime))
                                .font(.system(size: 28, weight: .bold))
                                .foregroundColor(F1WidgetColors.f1Red)
                            Text("local")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Spacer(minLength: 12)

                // Race info if different from current session
                if let race = data.nextRace, session.name != "Race" {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text("RACE")
                                .font(.system(size: 10, weight: .bold))
                                .foregroundColor(.secondary)
                            Text(formatFullDateTime(race.startTime))
                                .font(.system(size: 13, weight: .medium))
                                .foregroundColor(.primary)
                        }

                        Spacer()

                        Image(systemName: "flag.checkered")
                            .font(.system(size: 20))
                            .foregroundColor(F1WidgetColors.f1Red)
                    }
                    .padding(12)
                    .background(Color.secondary.opacity(0.1))
                    .cornerRadius(12)
                }

                Spacer(minLength: 0)
            } else {
                // Off-season
                Spacer()
                VStack(spacing: 16) {
                    Image(systemName: "flag.checkered")
                        .font(.system(size: 48))
                        .foregroundColor(.secondary)
                    Text("Off-season")
                        .font(.system(size: 18, weight: .semibold))
                        .foregroundColor(.secondary)
                    Text("No upcoming races scheduled")
                        .font(.system(size: 13))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding(16)
        .widgetURL(URL(string: DeepLinks.f1))
    }

    func sessionIcon(_ name: String) -> String {
        switch name.lowercased() {
        case "race": return "flag.checkered"
        case "qualifying", "sprint qualifying": return "timer"
        case "sprint": return "hare"
        default: return "car" // Practice sessions
        }
    }

    func formatTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "HH:mm"
        return formatter.string(from: date)
    }

    func formatFullDateTime(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEEE, MMM d 'at' HH:mm"
        return formatter.string(from: date)
    }
}

// MARK: - Lock Screen Widget (Redesigned)
struct AccessoryF1View: View {
    let data: F1WidgetData
    let currentDate: Date

    var body: some View {
        if let session = data.nextSession {
            HStack(spacing: 6) {
                // Flag emoji
                Text(session.countryFlag)
                    .font(.system(size: 22))

                VStack(alignment: .leading, spacing: 1) {
                    // Race name abbreviated
                    Text(session.raceName.widgetAbbreviated())
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)

                    // Countdown
                    HStack(spacing: 4) {
                        Text(session.name)
                            .font(.system(size: 10, weight: .medium))
                        Text("in")
                            .font(.system(size: 10))
                            .foregroundColor(.secondary)
                        Text(session.startTime.countdownString())
                            .font(.system(size: 10, weight: .bold, design: .monospaced))
                    }
                    .foregroundColor(.secondary)
                }

                Spacer()
            }
        } else {
            HStack(spacing: 6) {
                Image(systemName: "flag.checkered")
                    .font(.system(size: 20))
                VStack(alignment: .leading, spacing: 1) {
                    Text("F1")
                        .font(.system(size: 13, weight: .bold))
                    Text("Off-season")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
        }
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
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular])
    }
}

// MARK: - Preview
#Preview(as: .systemSmall) {
    F1CountdownWidget()
} timeline: {
    F1CountdownEntry(date: Date(), data: F1WidgetData.placeholder)
}

#Preview(as: .systemMedium) {
    F1CountdownWidget()
} timeline: {
    F1CountdownEntry(date: Date(), data: F1WidgetData.placeholder)
}

#Preview(as: .systemLarge) {
    F1CountdownWidget()
} timeline: {
    F1CountdownEntry(date: Date(), data: F1WidgetData.placeholder)
}
