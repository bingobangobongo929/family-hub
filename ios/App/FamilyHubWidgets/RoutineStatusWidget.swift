import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct RoutineStatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> RoutineStatusEntry {
        RoutineStatusEntry(date: Date(), data: RoutinesWidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (RoutineStatusEntry) -> Void) {
        let data = WidgetDataProvider.shared.getRoutinesData()
        let entry = RoutineStatusEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<RoutineStatusEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getRoutinesData()
        let entry = RoutineStatusEntry(date: Date(), data: data)

        // Refresh every 15 minutes
        let nextUpdate = Date.widgetRefreshDate(minutes: 15)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct RoutineStatusEntry: TimelineEntry {
    let date: Date
    let data: RoutinesWidgetData
}

// MARK: - Widget Views
struct RoutineStatusWidgetEntryView: View {
    var entry: RoutineStatusEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallRoutineView(routines: entry.data.routines)
        case .systemMedium:
            MediumRoutineView(routines: entry.data.routines)
        case .systemLarge:
            LargeRoutineView(routines: entry.data.routines)
        default:
            SmallRoutineView(routines: entry.data.routines)
        }
    }
}

// MARK: - Small Widget
struct SmallRoutineView: View {
    let routines: [RoutineStatus]

    var activeRoutine: RoutineStatus? {
        routines.first { !$0.isComplete }
    }

    // Extract short type from title (e.g., "Morning Routine" -> "Morning")
    func shortTitle(_ title: String) -> String {
        let words = title.components(separatedBy: " ")
        if let first = words.first, first.count <= 8 {
            return first
        }
        return String(title.prefix(7))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Compact header
            HStack {
                Text(activeRoutine?.emoji ?? "✨")
                    .font(.title3)
                Spacer()
                if let routine = activeRoutine {
                    Text("\(routine.completedSteps)/\(routine.totalSteps)")
                        .font(.title3)
                        .fontWeight(.bold)
                        .foregroundColor(colorFromHex(routine.memberColor))
                }
            }

            if let routine = activeRoutine {
                // Short title only
                Text(shortTitle(routine.title))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(1)

                Spacer()

                // Progress bar - larger
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 6)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 12)

                        RoundedRectangle(cornerRadius: 6)
                            .fill(colorFromHex(routine.memberColor))
                            .frame(width: geometry.size.width * CGFloat(routine.progress), height: 12)
                    }
                }
                .frame(height: 12)

                // Member name
                HStack {
                    Circle()
                        .fill(colorFromHex(routine.memberColor))
                        .frame(width: 8, height: 8)
                    Text(routine.memberName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } else {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "checkmark.circle.fill")
                        .font(.largeTitle)
                        .foregroundColor(.green)
                    Text("All done!")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.routines))
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.pink
    }
}

// MARK: - Medium Widget
struct MediumRoutineView: View {
    let routines: [RoutineStatus]

    var body: some View {
        HStack(spacing: 16) {
            ForEach(routines.prefix(2)) { routine in
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(routine.emoji)
                            .font(.title2)
                        Spacer()
                        if routine.isComplete {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundColor(.green)
                        }
                    }

                    Text(routine.title)
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .lineLimit(1)

                    // Circular progress
                    ZStack {
                        Circle()
                            .stroke(Color.gray.opacity(0.2), lineWidth: 6)

                        Circle()
                            .trim(from: 0, to: CGFloat(routine.progress))
                            .stroke(colorFromHex(routine.memberColor), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                            .rotationEffect(.degrees(-90))

                        Text("\(routine.completedSteps)/\(routine.totalSteps)")
                            .font(.caption)
                            .fontWeight(.bold)
                    }
                    .frame(width: 50, height: 50)

                    HStack {
                        Circle()
                            .fill(colorFromHex(routine.memberColor))
                            .frame(width: 8, height: 8)
                        Text(routine.memberName)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    Spacer()
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
            }

            if routines.isEmpty {
                VStack {
                    Spacer()
                    Image(systemName: "sparkles")
                        .font(.title)
                        .foregroundColor(.yellow)
                    Text("No routines today")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.routines))
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.pink
    }
}

// MARK: - Large Widget
struct LargeRoutineView: View {
    let routines: [RoutineStatus]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "list.bullet.clipboard.fill")
                    .foregroundColor(.purple)
                    .font(.title2)
                Text("Routines")
                    .font(.title3)
                    .fontWeight(.semibold)
                Spacer()

                let completedCount = routines.filter { $0.isComplete }.count
                Text("\(completedCount)/\(routines.count) done")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            if routines.isEmpty {
                VStack {
                    Spacer()
                    Image(systemName: "sparkles")
                        .font(.system(size: 48))
                        .foregroundColor(.yellow)
                    Text("No routines scheduled")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ForEach(routines) { routine in
                    RoutineRow(routine: routine)
                }
            }

            Spacer()
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.routines))
    }
}

struct RoutineRow: View {
    let routine: RoutineStatus

    var body: some View {
        HStack(spacing: 12) {
            Text(routine.emoji)
                .font(.title2)

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(routine.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                    Spacer()
                    if routine.isComplete {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundColor(.green)
                    } else {
                        Text("\(routine.completedSteps)/\(routine.totalSteps)")
                            .font(.caption)
                            .fontWeight(.semibold)
                            .foregroundColor(colorFromHex(routine.memberColor))
                    }
                }

                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.gray.opacity(0.2))
                            .frame(height: 6)

                        RoundedRectangle(cornerRadius: 3)
                            .fill(routine.isComplete ? Color.green : colorFromHex(routine.memberColor))
                            .frame(width: geometry.size.width * CGFloat(routine.progress), height: 6)
                    }
                }
                .frame(height: 6)

                HStack {
                    Circle()
                        .fill(colorFromHex(routine.memberColor))
                        .frame(width: 6, height: 6)
                    Text(routine.memberName)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
        }
        .padding(.vertical, 6)
    }

    func colorFromHex(_ hex: String) -> Color {
        if let rgb = hex.asColor {
            return Color(red: rgb.red, green: rgb.green, blue: rgb.blue)
        }
        return Color.pink
    }
}

// MARK: - Widget Configuration
struct RoutineStatusWidget: Widget {
    let kind: String = "RoutineStatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: RoutineStatusProvider()) { entry in
            RoutineStatusWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Routine Status")
        .description("Track your family's daily routine progress.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Preview
#Preview(as: .systemMedium) {
    RoutineStatusWidget()
} timeline: {
    RoutineStatusEntry(date: Date(), data: RoutinesWidgetData.placeholder)
}
