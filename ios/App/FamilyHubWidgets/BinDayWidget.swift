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

// MARK: - Small Widget
struct SmallBinView: View {
    let collections: [BinCollection]

    var nextCollection: BinCollection? {
        collections.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "trash.fill")
                    .foregroundColor(.green)
                Text("Bins")
                    .font(.headline)
            }

            if let bin = nextCollection {
                Spacer()

                HStack {
                    Text(bin.emoji)
                        .font(.system(size: 40))

                    VStack(alignment: .leading, spacing: 2) {
                        Text(bin.name)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .lineLimit(1)

                        Text(urgencyText(bin))
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(urgencyColor(bin))
                    }
                }

                Spacer()

                // Alert badge if urgent
                if bin.daysUntil <= 1 {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption)
                        Text(bin.daysUntil == 0 ? "Put out now!" : "Tomorrow!")
                            .font(.caption)
                            .fontWeight(.bold)
                    }
                    .foregroundColor(.white)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(urgencyColor(bin))
                    .cornerRadius(8)
                }
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("All clear!")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.bindicator))
    }

    func urgencyText(_ bin: BinCollection) -> String {
        switch bin.daysUntil {
        case 0: return "Today!"
        case 1: return "Tomorrow"
        case 2: return "In 2 days"
        default: return "In \(bin.daysUntil) days"
        }
    }

    func urgencyColor(_ bin: BinCollection) -> Color {
        switch bin.urgencyLevel {
        case .today: return .red
        case .tomorrow: return .orange
        case .soon: return .yellow
        case .later: return .green
        }
    }
}

// MARK: - Medium Widget
struct MediumBinView: View {
    let collections: [BinCollection]

    var body: some View {
        HStack(spacing: 12) {
            // Left side - Next collection highlight
            if let nextBin = collections.first {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "trash.fill")
                            .foregroundColor(.green)
                        Text("Next Collection")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(.secondary)
                    }

                    Spacer()

                    Text(nextBin.emoji)
                        .font(.system(size: 48))

                    Text(nextBin.name)
                        .font(.subheadline)
                        .fontWeight(.bold)
                        .lineLimit(1)

                    HStack {
                        Image(systemName: urgencyIcon(nextBin))
                            .font(.caption)
                        Text(urgencyText(nextBin))
                            .font(.caption)
                            .fontWeight(.bold)
                    }
                    .foregroundColor(urgencyColor(nextBin))

                    Spacer()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Divider()

            // Right side - Other upcoming bins
            VStack(alignment: .leading, spacing: 8) {
                Text("UPCOMING")
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundColor(.secondary)

                ForEach(collections.dropFirst().prefix(3)) { bin in
                    HStack(spacing: 8) {
                        Text(bin.emoji)
                            .font(.title3)

                        VStack(alignment: .leading, spacing: 0) {
                            Text(bin.name)
                                .font(.caption)
                                .fontWeight(.medium)
                                .lineLimit(1)
                            Text(shortUrgencyText(bin))
                                .font(.caption2)
                                .foregroundColor(urgencyColor(bin))
                        }
                        Spacer()
                    }
                }

                if collections.count <= 1 {
                    Text("No other bins soon")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
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
        case .today: return .red
        case .tomorrow: return .orange
        case .soon: return .yellow
        case .later: return .green
        }
    }
}

// MARK: - Lock Screen Widget
struct AccessoryBinView: View {
    let collections: [BinCollection]

    var body: some View {
        if let bin = collections.first {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: "trash.fill")
                    Text("Bins")
                    Spacer()
                    if bin.daysUntil <= 1 {
                        Image(systemName: "exclamationmark.triangle.fill")
                    }
                }
                .font(.caption)

                HStack {
                    Text(bin.emoji)
                    Text(bin.name)
                        .fontWeight(.semibold)
                        .lineLimit(1)
                }
                .font(.headline)

                Text(shortUrgencyText(bin))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        } else {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Image(systemName: "trash.fill")
                    Text("Bins")
                }
                .font(.caption)

                Text("All clear")
                    .font(.headline)
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
#Preview(as: .systemMedium) {
    BinDayWidget()
} timeline: {
    BinDayEntry(date: Date(), data: BinWidgetData.placeholder)
}
