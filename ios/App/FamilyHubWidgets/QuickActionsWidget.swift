import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Quick Action Intents
struct AddShoppingItemIntent: AppIntent {
    static var title: LocalizedStringResource = "Add Shopping Item"
    static var description = IntentDescription("Opens Family Hub to add a shopping item")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct OpenCalendarIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Calendar"
    static var description = IntentDescription("Opens Family Hub calendar")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct OpenRoutinesIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Routines"
    static var description = IntentDescription("Opens Family Hub routines")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

struct OpenF1Intent: AppIntent {
    static var title: LocalizedStringResource = "Open F1"
    static var description = IntentDescription("Opens Family Hub F1 page")
    static var openAppWhenRun: Bool = true

    func perform() async throws -> some IntentResult {
        return .result()
    }
}

// MARK: - Timeline Provider
struct QuickActionsProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuickActionsEntry {
        QuickActionsEntry(date: Date())
    }

    func getSnapshot(in context: Context, completion: @escaping (QuickActionsEntry) -> Void) {
        let entry = QuickActionsEntry(date: Date())
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuickActionsEntry>) -> Void) {
        let entry = QuickActionsEntry(date: Date())
        // Static widget, refresh daily
        let tomorrow = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: Date())!)
        let timeline = Timeline(entries: [entry], policy: .after(tomorrow))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct QuickActionsEntry: TimelineEntry {
    let date: Date
}

// MARK: - Quick Action Button
struct QuickActionButton: View {
    let icon: String
    let label: String
    let color: Color
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            VStack(spacing: 6) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 44, height: 44)

                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(color)
                }

                Text(label)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .lineLimit(1)
            }
        }
    }
}

// MARK: - Widget Views
struct QuickActionsWidgetEntryView: View {
    var entry: QuickActionsEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallQuickActionsView()
        case .systemMedium:
            MediumQuickActionsView()
        default:
            SmallQuickActionsView()
        }
    }
}

// MARK: - Small Widget (2x2 grid)
struct SmallQuickActionsView: View {
    var body: some View {
        VStack(spacing: 12) {
            HStack(spacing: 20) {
                QuickActionButton(
                    icon: "cart.fill.badge.plus",
                    label: "Shopping",
                    color: .teal,
                    url: DeepLinks.shoppingAdd
                )

                QuickActionButton(
                    icon: "doc.text.viewfinder",
                    label: "Scan",
                    color: .purple,
                    url: "familyhub://calendar/scan"
                )
            }

            HStack(spacing: 20) {
                QuickActionButton(
                    icon: "list.bullet.clipboard",
                    label: "Routines",
                    color: .orange,
                    url: DeepLinks.routines
                )

                QuickActionButton(
                    icon: "flag.checkered",
                    label: "F1",
                    color: .red,
                    url: DeepLinks.f1
                )
            }
        }
        .padding()
    }
}

// MARK: - Medium Widget (horizontal row)
struct MediumQuickActionsView: View {
    var body: some View {
        VStack(spacing: 12) {
            HStack {
                Image(systemName: "bolt.fill")
                    .foregroundColor(.yellow)
                Text("Quick Actions")
                    .font(.headline)
                Spacer()
            }

            Divider()

            HStack(spacing: 0) {
                QuickActionLargeButton(
                    icon: "doc.text.viewfinder",
                    label: "Scan\nEvent",
                    color: .purple,
                    url: "familyhub://calendar/scan"
                )

                Divider()
                    .frame(height: 60)

                QuickActionLargeButton(
                    icon: "cart.fill.badge.plus",
                    label: "Add to\nShopping",
                    color: .teal,
                    url: DeepLinks.shoppingAdd
                )

                Divider()
                    .frame(height: 60)

                QuickActionLargeButton(
                    icon: "list.bullet.clipboard",
                    label: "Start\nRoutine",
                    color: .orange,
                    url: DeepLinks.routines
                )

                Divider()
                    .frame(height: 60)

                QuickActionLargeButton(
                    icon: "trash.fill",
                    label: "Check\nBins",
                    color: .green,
                    url: DeepLinks.bindicator
                )
            }

            Spacer()
        }
        .padding()
    }
}

struct QuickActionLargeButton: View {
    let icon: String
    let label: String
    let color: Color
    let url: String

    var body: some View {
        Link(destination: URL(string: url)!) {
            VStack(spacing: 8) {
                ZStack {
                    Circle()
                        .fill(color.opacity(0.15))
                        .frame(width: 40, height: 40)

                    Image(systemName: icon)
                        .font(.title3)
                        .foregroundColor(color)
                }

                Text(label)
                    .font(.caption2)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Widget Configuration
struct QuickActionsWidget: Widget {
    let kind: String = "QuickActionsWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QuickActionsProvider()) { entry in
            QuickActionsWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Quick Actions")
        .description("Quick access to common Family Hub actions.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview
#Preview(as: .systemSmall) {
    QuickActionsWidget()
} timeline: {
    QuickActionsEntry(date: Date())
}

#Preview(as: .systemMedium) {
    QuickActionsWidget()
} timeline: {
    QuickActionsEntry(date: Date())
}
