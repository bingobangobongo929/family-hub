import WidgetKit
import SwiftUI

// MARK: - Timeline Provider
struct ShoppingListProvider: TimelineProvider {
    func placeholder(in context: Context) -> ShoppingListEntry {
        ShoppingListEntry(date: Date(), data: ShoppingWidgetData.placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (ShoppingListEntry) -> Void) {
        let data = WidgetDataProvider.shared.getShoppingData()
        let entry = ShoppingListEntry(date: Date(), data: data)
        completion(entry)
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<ShoppingListEntry>) -> Void) {
        let data = WidgetDataProvider.shared.getShoppingData()
        let entry = ShoppingListEntry(date: Date(), data: data)

        // Refresh every 15 minutes
        let nextUpdate = Date.widgetRefreshDate(minutes: 15)
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
        completion(timeline)
    }
}

// MARK: - Timeline Entry
struct ShoppingListEntry: TimelineEntry {
    let date: Date
    let data: ShoppingWidgetData
}

// MARK: - Widget Views
struct ShoppingListWidgetEntryView: View {
    var entry: ShoppingListEntry
    @Environment(\.widgetFamily) var family

    var uncheckedItems: [ShoppingItem] {
        entry.data.items.filter { !$0.isCompleted }
    }

    var body: some View {
        switch family {
        case .systemSmall:
            SmallShoppingView(items: uncheckedItems)
        case .systemMedium:
            MediumShoppingView(items: uncheckedItems)
        case .systemLarge:
            LargeShoppingView(items: uncheckedItems)
        default:
            SmallShoppingView(items: uncheckedItems)
        }
    }
}

// MARK: - Small Widget
struct SmallShoppingView: View {
    let items: [ShoppingItem]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "cart.fill")
                    .foregroundColor(.teal)
                Text("Shopping")
                    .font(.headline)
                    .foregroundColor(.primary)
                Spacer()
                Text("\(items.count)")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundColor(.teal)
            }

            Divider()

            if items.isEmpty {
                VStack {
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .font(.title)
                        .foregroundColor(.green)
                    Text("All done!")
                        .font(.caption)
                        .foregroundColor(.secondary)
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(items.prefix(3)) { item in
                        HStack(spacing: 6) {
                            Circle()
                                .fill(Color.teal.opacity(0.3))
                                .frame(width: 6, height: 6)
                            Text(item.name)
                                .font(.caption)
                                .lineLimit(1)
                            if let qty = item.quantity, qty > 1 {
                                Text("×\(qty)")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    if items.count > 3 {
                        Text("+\(items.count - 3) more")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
                Spacer()
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.shopping))
    }
}

// MARK: - Medium Widget
struct MediumShoppingView: View {
    let items: [ShoppingItem]

    var body: some View {
        HStack(spacing: 16) {
            // Left: Summary
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    Image(systemName: "cart.fill")
                        .foregroundColor(.teal)
                        .font(.title2)
                    Text("Shopping")
                        .font(.headline)
                }

                Text("\(items.count) items")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                    .foregroundColor(.teal)

                Spacer()

                Link(destination: URL(string: DeepLinks.shoppingAdd)!) {
                    HStack {
                        Image(systemName: "plus.circle.fill")
                        Text("Add Item")
                    }
                    .font(.caption)
                    .foregroundColor(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(Color.teal)
                    .cornerRadius(16)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Divider()

            // Right: Item list
            VStack(alignment: .leading, spacing: 6) {
                if items.isEmpty {
                    VStack {
                        Image(systemName: "checkmark.circle.fill")
                            .font(.title)
                            .foregroundColor(.green)
                        Text("List empty!")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    ForEach(items.prefix(5)) { item in
                        HStack(spacing: 8) {
                            Circle()
                                .fill(Color.teal.opacity(0.3))
                                .frame(width: 8, height: 8)
                            Text(item.name)
                                .font(.subheadline)
                                .lineLimit(1)
                            Spacer()
                            if let qty = item.quantity, qty > 1 {
                                Text("×\(qty)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    if items.count > 5 {
                        Text("+\(items.count - 5) more items")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                }
            }
            .frame(maxWidth: .infinity)
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.shopping))
    }
}

// MARK: - Large Widget
struct LargeShoppingView: View {
    let items: [ShoppingItem]

    var groupedItems: [(String, [ShoppingItem])] {
        let grouped = Dictionary(grouping: items) { $0.category ?? "Other" }
        return grouped.sorted { $0.key < $1.key }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "cart.fill")
                    .foregroundColor(.teal)
                    .font(.title2)
                Text("Shopping List")
                    .font(.title3)
                    .fontWeight(.semibold)
                Spacer()
                Text("\(items.count) items")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Divider()

            if items.isEmpty {
                VStack(spacing: 12) {
                    Spacer()
                    Image(systemName: "checkmark.circle.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.green)
                    Text("Shopping list is empty!")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    Link(destination: URL(string: DeepLinks.shoppingAdd)!) {
                        HStack {
                            Image(systemName: "plus.circle.fill")
                            Text("Add Items")
                        }
                        .font(.subheadline)
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Color.teal)
                        .cornerRadius(20)
                    }
                    Spacer()
                }
                .frame(maxWidth: .infinity)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 12) {
                        ForEach(groupedItems.prefix(4), id: \.0) { category, categoryItems in
                            VStack(alignment: .leading, spacing: 6) {
                                Text(category.capitalized)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundColor(.secondary)
                                    .textCase(.uppercase)

                                ForEach(categoryItems.prefix(4)) { item in
                                    HStack(spacing: 10) {
                                        Circle()
                                            .fill(Color.teal.opacity(0.3))
                                            .frame(width: 8, height: 8)
                                        Text(item.name)
                                            .font(.subheadline)
                                            .lineLimit(1)
                                        Spacer()
                                        if let qty = item.quantity, qty > 1 {
                                            Text("×\(qty)")
                                                .font(.caption)
                                                .padding(.horizontal, 8)
                                                .padding(.vertical, 2)
                                                .background(Color.teal.opacity(0.1))
                                                .cornerRadius(8)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            Spacer()

            // Quick add button
            Link(destination: URL(string: DeepLinks.shoppingAdd)!) {
                HStack {
                    Spacer()
                    Image(systemName: "plus.circle.fill")
                    Text("Add Item")
                    Spacer()
                }
                .font(.subheadline)
                .foregroundColor(.white)
                .padding(.vertical, 10)
                .background(Color.teal)
                .cornerRadius(12)
            }
        }
        .padding()
        .widgetURL(URL(string: DeepLinks.shopping))
    }
}

// MARK: - Widget Configuration
struct ShoppingListWidget: Widget {
    let kind: String = "ShoppingListWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: ShoppingListProvider()) { entry in
            ShoppingListWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("Shopping List")
        .description("View and manage your family shopping list.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

// MARK: - Preview
#Preview(as: .systemSmall) {
    ShoppingListWidget()
} timeline: {
    ShoppingListEntry(date: Date(), data: ShoppingWidgetData.placeholder)
}

#Preview(as: .systemMedium) {
    ShoppingListWidget()
} timeline: {
    ShoppingListEntry(date: Date(), data: ShoppingWidgetData.placeholder)
}
