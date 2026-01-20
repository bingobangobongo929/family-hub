import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct BinDayProvider: TimelineProvider {
    func placeholder(in context: Context) -> BinDayEntry {
        BinDayEntry(date: Date(), data: BinWidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (BinDayEntry) -> Void) {
        let data = WidgetDataProvider.shared.getBinData()
        let entry = BinDayEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<BinDayEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getBinData()
        let entry = BinDayEntry(date: Date(), data: data)

        // Refresh at midnight when bin days change
        let calendar = Calendar.current
        let tomorrow = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: Date())!)
        let timeline = Timeline(entries: [entry], policy: .after(tomorrow))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct BinDayEntry: TimelineEntry {
    let date: Date
    let data: BinWidgetData
}

// MARK: - Widget Views
struct BinDayWidgetEntryView: View {
    var entry: BinDayEntry
    @Environment(\.widgetFamily) var family

    var sortedCollections: [BinCollection] {
        entry.data.collections.sorted { $0.daysUntil < $1.daysUntil }
    }

    var body: some View {
        switch family {
        case .systemSmall:
            SmallBinView(collections: sortedCollections)
        case .systemMedium:
            MediumBinView(collections: sortedCollections)
        case .accessoryRectangular:
            AccessoryBinView(collections: sortedCollections)
        default:
            SmallBinView(collections: sortedCollections)
        }
    }
}

// MARK: - Small Widget (Redesigned)
struct SmallBinView: View {
    let collections: [BinCollection]

    var nextCollection: BinCollection? {
        collections.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                Image(systemName: "trash.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundColor(WidgetColors.teal)
                Text("BINS")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(.secondary)
                Spacer()
            }

            if let bin = nextCollection {
                Spacer(minLength: 8)

                // Large emoji centered
                HStack {
                    Spacer()
                    Text(bin.emoji)
                        .font(.system(size: 52))
                    Spacer()
                }

                Spacer(minLength: 6)

                // Bin name - truncated if needed
                Text(bin.name)
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.primary)
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                    .frame(maxWidth: .infinity, alignment: .center)

                Spacer(minLength: 8)

                // Urgency badge at bottom
                HStack {
                    Spacer()
                    urgencyBadge(bin)
                    Spacer()
                }
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(WidgetColors.safeGreen)
                    Text("All clear!")
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding(14)
        .widgetURL(URL(string: DeepLinks.bindicator))
    }

    @ViewBuilder
    func urgencyBadge(_ bin: BinCollection) -> some View {
        let (text, color, icon) = urgencyInfo(bin)
        HStack(spacing: 4) {
            if let icon = icon {
                Image(systemName: icon)
                    .font(.system(size: 10, weight: .bold))
            }
            Text(text)
                .font(.system(size: 11, weight: .bold))
        }
        .foregroundColor(.white)
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(color)
        .cornerRadius(10)
    }

    func urgencyInfo(_ bin: BinCollection) -> (String, Color, String?) {
        switch bin.daysUntil {
        case 0:
            return ("TODAY!", WidgetColors.urgentRed, "exclamationmark.triangle.fill")
        case 1:
            return ("Tomorrow", WidgetColors.warningOrange, "clock.fill")
        case 2:
            return ("In 2 days", WidgetColors.teal, nil)
        default:
            return ("In \(bin.daysUntil) days", WidgetColors.teal, nil)
        }
    }
}

// MARK: - Medium Widget (Redesigned)
struct MediumBinView: View {
    let collections: [BinCollection]

    var body: some View {
        HStack(spacing: 0) {
            // Left side - Next collection with large emoji
            if let nextBin = collections.first {
                VStack(alignment: .leading, spacing: 0) {
                    // Header
                    HStack(spacing: 4) {
                        Image(systemName: "trash.fill")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundColor(WidgetColors.teal)
                        Text("NEXT")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(.secondary)
                    }

                    Spacer(minLength: 6)

                    // Large emoji
                    Text(nextBin.emoji)
                        .font(.system(size: 44))

                    Spacer(minLength: 4)

                    // Bin name
                    Text(nextBin.name)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundColor(.primary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    // Urgency text
                    HStack(spacing: 4) {
                        Image(systemName: urgencyIcon(nextBin))
                            .font(.system(size: 10, weight: .semibold))
                        Text(urgencyText(nextBin))
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundColor(urgencyColor(nextBin))

                    Spacer(minLength: 4)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.trailing, 8)
            }

            // Teal accent divider
            WidgetAccentBar(color: WidgetColors.teal.opacity(0.3), width: 2)

            // Right side - Upcoming list
            VStack(alignment: .leading, spacing: 6) {
                Text("UPCOMING")
                    .font(.system(size: 9, weight: .bold))
                    .foregroundColor(.secondary)
                    .padding(.bottom, 2)

                if collections.count > 1 {
                    ForEach(collections.dropFirst().prefix(3)) { bin in
                        HStack(spacing: 8) {
                            Text(bin.emoji)
                                .font(.system(size: 20))

                            VStack(alignment: .leading, spacing: 1) {
                                Text(bin.name)
                                    .font(.system(size: 12, weight: .medium))
                                    .foregroundColor(.primary)
                                    .lineLimit(1)
                                Text(shortUrgencyText(bin))
                                    .font(.system(size: 10, weight: .medium))
                                    .foregroundColor(urgencyColor(bin))
                            }
                            Spacer()
                        }
                    }
                } else {
                    Spacer()
                    HStack {
                        Spacer()
                        VStack(spacing: 4) {
                            Image(systemName: "checkmark.circle")
                                .font(.system(size: 20))
                                .foregroundColor(WidgetColors.safeGreen)
                            Text("Nothing else\nthis week")
                                .font(.system(size: 10, weight: .medium))
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.center)
                        }
                        Spacer()
                    }
                    Spacer()
                }

                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 12)
        }
        .padding(14)
        .widgetURL(URL(string: DeepLinks.bindicator))
    }

    func urgencyIcon(_ bin: BinCollection) -> String {
        switch bin.urgencyLevel {
        case .today: return "exclamationmark.triangle.fill"
        case .tomorrow: return "exclamationmark.circle.fill"
        case .soon: return "clock.fill"
        case .later: return "calendar"
        }
    }

    func urgencyText(_ bin: BinCollection) -> String {
        switch bin.daysUntil {
        case 0: return "Put out today!"
        case 1: return "Tomorrow morning"
        case 2: return "Day after tomorrow"
        default: return formatDate(bin.nextDate)
        }
    }

    func shortUrgencyText(_ bin: BinCollection) -> String {
        switch bin.daysUntil {
        case 0: return "Today"
        case 1: return "Tomorrow"
        default: return "In \(bin.daysUntil) days"
        }
    }

    func formatDate(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE, MMM d"
        return formatter.string(from: date)
    }

    func urgencyColor(_ bin: BinCollection) -> Color {
        switch bin.urgencyLevel {
        case .today: return WidgetColors.urgentRed
        case .tomorrow: return WidgetColors.warningOrange
        case .soon: return WidgetColors.cautionYellow
        case .later: return WidgetColors.teal
        }
    }
}

// MARK: - Lock Screen Widget (Redesigned)
struct AccessoryBinView: View {
    let collections: [BinCollection]

    var body: some View {
        if let bin = collections.first {
            HStack(spacing: 6) {
                // Emoji
                Text(bin.emoji)
                    .font(.system(size: 24))

                VStack(alignment: .leading, spacing: 1) {
                    // Bin name
                    Text(bin.name)
                        .font(.system(size: 13, weight: .semibold))
                        .lineLimit(1)

                    // Day indicator
                    HStack(spacing: 3) {
                        if bin.daysUntil <= 1 {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 9))
                        }
                        Text(shortUrgencyText(bin))
                            .font(.system(size: 11, weight: .medium))
                    }
                    .foregroundColor(.secondary)
                }

                Spacer()
            }
        } else {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.system(size: 20))
                VStack(alignment: .leading, spacing: 1) {
                    Text("Bins")
                        .font(.system(size: 13, weight: .semibold))
                    Text("All clear")
                        .font(.system(size: 11))
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
        }
    }

    func shortUrgencyText(_ bin: BinCollection) -> String {
        switch bin.daysUntil {
        case 0: return "Today!"
        case 1: return "Tomorrow"
        default: return "In \(bin.daysUntil) days"
        }
    }
}

// MARK: - Widget Configuration
struct BinDayWidget: Widget {
    let kind: String = "BinDayWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: BinDayProvider()) { entry in
            BinDayWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Bin Day")
        .description("Never forget to put the bins out.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

// MARK: - Preview
#Preview(as: .systemSmall) {
    BinDayWidget()
} timeline: {
    BinDayEntry(date: Date(), data: BinWidgetData.placeholder)
}

#Preview(as: .systemMedium) {
    BinDayWidget()
} timeline: {
    BinDayEntry(date: Date(), data: BinWidgetData.placeholder)
}
